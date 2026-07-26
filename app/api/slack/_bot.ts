import crypto from "node:crypto";
import {
  buildSearchText,
  formatDiscountFold,
  formatMoney,
  getModelDisplayName,
  normalizeText,
} from "../../catalog";
import { getCatalogState, summarizeCatalog } from "../../catalog-service";
import { laptops as fallbackLaptops, type Laptop } from "../../laptop-data";

export type SlackEventEnvelope = {
  type?: string;
  challenge?: string;
  event?: {
    type?: string;
    subtype?: string;
    channel?: string;
    channel_type?: string;
    text?: string;
    ts?: string;
    thread_ts?: string;
    bot_id?: string;
    user?: string;
  };
};

type SlackBlock =
  | { type: "header"; text: { type: "plain_text"; text: string } }
  | { type: "section"; text: { type: "mrkdwn"; text: string } }
  | { type: "divider" };

export function verifySlackRequest(rawBody: string, timestamp: string | null, signature: string | null) {
  const signingSecret = process.env.SLACK_SIGNING_SECRET;
  if (!signingSecret) return false;
  if (!timestamp || !signature) return false;

  const requestTime = Number(timestamp);
  if (!Number.isFinite(requestTime)) return false;
  if (Math.abs(Date.now() / 1000 - requestTime) > 60 * 5) return false;

  const baseString = `v0:${timestamp}:${rawBody}`;
  const expected =
    "v0=" + crypto.createHmac("sha256", signingSecret).update(baseString).digest("hex");

  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(signature);
  if (expectedBuffer.length !== providedBuffer.length) return false;

  return crypto.timingSafeEqual(expectedBuffer, providedBuffer);
}

function normalizeQuery(value: string) {
  return normalizeText(value).replace(/\s+/g, " ").trim();
}

function extractBudgetRange(query: string) {
  const compact = query.replace(/\s+/g, "");

  const rangeMatch = compact.match(/(\d+(?:\.\d+)?)(萬|元|塊)?[~\-到至](\d+(?:\.\d+)?)(萬|元|塊)?/);
  if (rangeMatch) {
    const left = Number(rangeMatch[1]) * (rangeMatch[2] === "萬" ? 10000 : 1);
    const right = Number(rangeMatch[3]) * (rangeMatch[4] === "萬" ? 10000 : 1);
    return { min: Math.min(left, right), max: Math.max(left, right) };
  }

  const underMatch = compact.match(/(\d+(?:\.\d+)?)(萬|元|塊)?以下/);
  if (underMatch) {
    const value = Number(underMatch[1]) * (underMatch[2] === "萬" ? 10000 : 1);
    return { min: 0, max: value };
  }

  const overMatch = compact.match(/(\d+(?:\.\d+)?)(萬|元|塊)?以上/);
  if (overMatch) {
    const value = Number(overMatch[1]) * (overMatch[2] === "萬" ? 10000 : 1);
    return { min: value, max: Number.POSITIVE_INFINITY };
  }

  return null;
}

function inferGpuPreference(query: string) {
  const text = normalizeQuery(query);
  if (text.includes("內顯") || text.includes("igpu") || text.includes("integrated")) return "igpu";
  if (text.includes("獨顯") || text.includes("dgpu")) return "dgpu";
  if (text.includes("rtx") || text.includes("geforce") || text.includes("radeon") || text.includes("arc")) {
    return "dgpu";
  }
  return null;
}

function inferScreenPreference(query: string) {
  const text = normalizeQuery(query);
  if (text.includes("13吋") || text.includes("13寸")) return "13";
  if (text.includes("14吋") || text.includes("14寸")) return "14";
  if (text.includes("15吋") || text.includes("15寸")) return "15";
  if (text.includes("16吋") || text.includes("16寸")) return "16";
  return null;
}

function getGpuMode(laptop: Laptop): "igpu" | "dgpu" {
  const text = `${laptop.gpu} ${laptop.title} ${laptop.model}`.toLowerCase();
  if (
    text.includes("rtx") ||
    text.includes("geforce") ||
    text.includes("radeon") ||
    text.includes("arc") ||
    text.includes("iris")
  ) {
    return "dgpu";
  }
  return "igpu";
}

function matchScore(laptop: Laptop, query: string) {
  const normalizedQuery = normalizeQuery(query);
  const searchText = buildSearchText(laptop);
  const terms = normalizedQuery.split(" ").filter((term) => term.length >= 2);

  if (!normalizedQuery) {
    return laptop.valueScore;
  }

  let score = 0;

  if (searchText.includes(normalizedQuery)) score += 120;
  if (normalizeQuery(laptop.model).includes(normalizedQuery)) score += 140;
  if (normalizeQuery(laptop.title).includes(normalizedQuery)) score += 90;
  if (normalizeQuery(laptop.family).includes(normalizedQuery)) score += 30;

  for (const term of terms) {
    if (searchText.includes(term)) score += 14;
    if (normalizeQuery(laptop.model).includes(term)) score += 25;
    if (normalizeQuery(laptop.title).includes(term)) score += 16;
  }

  const budgetRange = extractBudgetRange(query);
  if (budgetRange) {
    if (laptop.eduPrice < budgetRange.min || laptop.eduPrice > budgetRange.max) {
      score -= 1000;
    } else {
      score += 80;
    }
  }

  const gpuPreference = inferGpuPreference(query);
  if (gpuPreference && getGpuMode(laptop) !== gpuPreference) {
    score -= 150;
  } else if (gpuPreference) {
    score += 60;
  }

  const screenPreference = inferScreenPreference(query);
  if (screenPreference && laptop.screenSize) {
    if (String(Math.round(laptop.screenSize)) === screenPreference) {
      score += 40;
    } else {
      score -= 20;
    }
  }

  score += Math.max(0, 60 - Math.abs(laptop.eduPrice / 1000 - 30));
  score += laptop.discountRate * 2;
  return score;
}

function formatLaptopLine(laptop: Laptop) {
  const eduPrice = formatMoney(laptop.eduPrice);
  const marketPrice = formatMoney(laptop.marketPrice);
  const saving = formatMoney(laptop.discount);
  const fold = laptop.discountRate ? ` · ${formatDiscountFold(laptop.discountRate)}` : "";

  return `• *${getModelDisplayName(laptop)}*  ${eduPrice} ｜ 市價 ${marketPrice} ｜ 省下 ${saving}${fold}`;
}

function buildHelpMessage() {
  return [
    "可以直接傳型號、CPU、用途或價格給我，我會幫你找對應機型。",
    "",
    "範例：",
    "• `UX5606SA`",
    "• `14吋 內顯 3萬以下`",
    "• `RTX 4060`",
    "• `Core Ultra 7`",
  ].join("\n");
}

export async function buildSlackReply(rawText: string) {
  const query = rawText.replace(/<@[^>]+>/g, " ").trim();
  const normalized = normalizeQuery(query);
  const state = await getCatalogState();
  const laptops = state.laptops.length ? state.laptops : fallbackLaptops;

  if (!normalized || ["help", "說明", "怎麼用", "hello", "hi", "哈囉", "你好"].includes(normalized)) {
    return {
      text: buildHelpMessage(),
      blocks: [
        { type: "header", text: { type: "plain_text", text: "EDUNBPRICE Slack Bot" } },
        { type: "section", text: { type: "mrkdwn", text: buildHelpMessage() } },
      ] satisfies SlackBlock[],
    };
  }

  if (["stats", "狀態", "目前狀態", "總覽"].includes(normalized)) {
    const summary = summarizeCatalog(state, fallbackLaptops);
    const text = [
      `目前共有 *${summary.nextCount} 台* 機型，`,
      `其中 *${summary.missingImageCount} 台* 還缺圖片。`,
      summary.removedCount > 0 ? `已移除 ${summary.removedCount} 台。` : "",
    ]
      .filter(Boolean)
      .join(" ");

    return {
      text,
      blocks: [
        { type: "header", text: { type: "plain_text", text: "目前狀態" } },
        { type: "section", text: { type: "mrkdwn", text } },
      ] satisfies SlackBlock[],
    };
  }

  const ranked = laptops
    .map((laptop) => ({ laptop, score: matchScore(laptop, query) }))
    .sort((a, b) => b.score - a.score)
    .filter(({ score }) => score > -500)
    .slice(0, 5);

  if (!ranked.length) {
    return {
      text: `找不到符合「${query}」的機型。`,
      blocks: [
        { type: "header", text: { type: "plain_text", text: "找不到符合的機型" } },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `找不到符合「${query}」的機型。你可以試試：\n• 型號\n• CPU\n• 顯示卡\n• 14吋 / 16吋\n• 3萬以下 / 4萬以上`,
          },
        },
      ] satisfies SlackBlock[],
    };
  }

  const intro = `找到 *${ranked.length} 台* 符合「${query}」的機型：`;
  return {
    text: [intro, ...ranked.map(({ laptop }) => formatLaptopLine(laptop))].join("\n"),
    blocks: [
      { type: "header", text: { type: "plain_text", text: "搜尋結果" } },
      { type: "section", text: { type: "mrkdwn", text: intro } },
      { type: "divider" },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: ranked.map(({ laptop }) => formatLaptopLine(laptop)).join("\n"),
        },
      },
    ] satisfies SlackBlock[],
  };
}

export async function postSlackMessage(channel: string, text: string, blocks?: SlackBlock[], threadTs?: string) {
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) {
    throw new Error("SLACK_BOT_TOKEN is required.");
  }

  const response = await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify({
      channel,
      text,
      ...(blocks?.length ? { blocks } : {}),
      ...(threadTs ? { thread_ts: threadTs } : {}),
    }),
  });

  if (!response.ok) {
    throw new Error(`Slack API HTTP ${response.status}`);
  }

  const payload = (await response.json()) as { ok?: boolean; error?: string };
  if (!payload.ok) {
    throw new Error(payload.error || "Slack API returned an error.");
  }
}
