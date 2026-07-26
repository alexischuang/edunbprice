import { Chat } from "chat";
import { createTeamsAdapter } from "@chat-adapter/teams";
import { createMemoryState } from "@chat-adapter/state-memory";
import {
  buildSearchText,
  formatDiscountFold,
  formatMoney,
  getModelDisplayName,
  normalizeText,
} from "../../catalog";
import { getCatalogState, summarizeCatalog } from "../../catalog-service";
import { laptops as fallbackLaptops, type Laptop } from "../../laptop-data";

const teamsAdapter = createTeamsAdapter({
  appType: "SingleTenant",
});

export const bot = new Chat({
  userName: "edunbprice",
  adapters: {
    teams: teamsAdapter,
  },
  state: createMemoryState(),
  streamingUpdateIntervalMs: 1000,
  dedupeTtlMs: 10_000,
  fallbackStreamingPlaceholderText: "思考中...",
});

function cleanQuery(value: string) {
  return normalizeText(value).replace(/\s+/g, " ").trim();
}

function parseAmount(value: string, unit?: string) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return null;

  switch ((unit ?? "").toLowerCase()) {
    case "萬":
    case "w":
      return amount * 10000;
    case "k":
    case "千":
      return amount * 1000;
    default:
      return amount;
  }
}

function extractBudgetRange(query: string) {
  const compact = query.replace(/[,\s]/g, "");

  const rangeMatch = compact.match(
    /(\d+(?:\.\d+)?)(萬|w|k|千)?(?:~|-|到|至)(\d+(?:\.\d+)?)(萬|w|k|千)?/i,
  );
  if (rangeMatch) {
    const min = parseAmount(rangeMatch[1], rangeMatch[2]);
    const max = parseAmount(rangeMatch[3], rangeMatch[4]);
    if (min !== null && max !== null) {
      return { min: Math.min(min, max), max: Math.max(min, max) };
    }
  }

  const underMatch = compact.match(/(\d+(?:\.\d+)?)(萬|w|k|千)?以下/i);
  if (underMatch) {
    const max = parseAmount(underMatch[1], underMatch[2]);
    if (max !== null) return { min: 0, max };
  }

  const overMatch = compact.match(/(\d+(?:\.\d+)?)(萬|w|k|千)?以上/i);
  if (overMatch) {
    const min = parseAmount(overMatch[1], overMatch[2]);
    if (min !== null) return { min, max: Number.POSITIVE_INFINITY };
  }

  return null;
}

function inferGpuPreference(query: string) {
  const text = cleanQuery(query);
  if (text.includes("內顯") || text.includes("integrated") || text.includes("igpu")) {
    return "igpu" as const;
  }
  if (text.includes("獨顯") || text.includes("dgpu") || text.includes("rtx") || text.includes("geforce")) {
    return "dgpu" as const;
  }
  return null;
}

function inferScreenPreference(query: string) {
  const text = cleanQuery(query);
  if (text.includes("13")) return "13";
  if (text.includes("14")) return "14";
  if (text.includes("15")) return "15";
  if (text.includes("16")) return "16";
  return null;
}

function getGpuMode(laptop: Laptop): "igpu" | "dgpu" {
  const text = `${laptop.gpu} ${laptop.title} ${laptop.model}`.toLowerCase();
  if (text.includes("rtx") || text.includes("geforce") || text.includes("radeon") || text.includes("arc")) {
    return "dgpu";
  }
  return "igpu";
}

function matchScore(laptop: Laptop, query: string) {
  const normalizedQuery = cleanQuery(query);
  const searchText = buildSearchText(laptop);
  const terms = normalizedQuery.split(" ").filter((term) => term.length >= 2);

  if (!normalizedQuery) {
    return laptop.valueScore;
  }

  let score = laptop.valueScore;

  if (searchText.includes(normalizedQuery)) score += 120;
  if (cleanQuery(laptop.model).includes(normalizedQuery)) score += 140;
  if (cleanQuery(laptop.title).includes(normalizedQuery)) score += 90;
  if (cleanQuery(laptop.family).includes(normalizedQuery)) score += 30;

  for (const term of terms) {
    if (searchText.includes(term)) score += 14;
    if (cleanQuery(laptop.model).includes(term)) score += 25;
    if (cleanQuery(laptop.title).includes(term)) score += 16;
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
  const title = getModelDisplayName(laptop);
  const eduPrice = formatMoney(laptop.eduPrice);
  const marketPrice = formatMoney(laptop.marketPrice);
  const saving = formatMoney(laptop.discount);
  const fold = laptop.discountRate ? `，${formatDiscountFold(laptop.discountRate)}` : "";

  return `- ${title}｜教育價 ${eduPrice}｜市價 ${marketPrice}｜省下 ${saving}${fold}`;
}

function buildHelpMessage() {
  return [
    "我可以幫你查筆電推薦與篩選。",
    "",
    "可直接輸入：",
    "- help",
    "- stats",
    "- UX5606SA",
    "- 14吋 內顯 3萬以下",
    "- RTX 4060 16G",
  ].join("\n");
}

export async function buildTeamsReply(rawText: string) {
  const query = rawText.replace(/<@[^>]+>/g, " ").trim();
  const normalized = cleanQuery(query);
  const state = await getCatalogState();
  const laptops = state.laptops.length ? state.laptops : fallbackLaptops;

  if (
    !normalized ||
    ["help", "說明", "怎麼用", "hello", "hi", "你好", "哈囉"].includes(normalized)
  ) {
    return buildHelpMessage();
  }

  if (["stats", "狀態", "目前狀態", "總覽"].includes(normalized)) {
    const summary = summarizeCatalog(state, fallbackLaptops);
    return [
      `目前可用機型：${summary.nextCount} 台`,
      `已配對圖片：${summary.matchedImageCount} 台`,
      `缺少圖片：${summary.missingImageCount} 台`,
      summary.removedCount > 0 ? `已移除機型：${summary.removedCount} 台` : "",
    ]
      .filter(Boolean)
      .join("\n");
  }

  const ranked = laptops
    .map((laptop) => ({ laptop, score: matchScore(laptop, query) }))
    .sort((a, b) => b.score - a.score)
    .filter(({ score }) => score > -500)
    .slice(0, 5);

  if (!ranked.length) {
    return [
      `找不到符合「${query}」的結果。`,
      "你可以改輸入：型號、CPU、顯卡、預算或螢幕尺寸。",
      "例如：14吋 內顯 3萬以下",
    ].join("\n");
  }

  return [
    `找到 ${ranked.length} 台符合「${query}」的機型：`,
    ...ranked.map(({ laptop }) => formatLaptopLine(laptop)),
  ].join("\n");
}
