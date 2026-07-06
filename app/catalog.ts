import type { Laptop } from "./laptop-data";

export type FilterOption = {
  value: string;
  label: string;
};

export const moneyFormatter = new Intl.NumberFormat("zh-TW", {
  style: "currency",
  currency: "TWD",
  maximumFractionDigits: 0,
});

export const compareFields = [
  { key: "cpu", label: "CPU" },
  { key: "memory", label: "RAM" },
  { key: "storage", label: "SSD" },
  { key: "display", label: "LCD" },
  { key: "gpu", label: "顯示卡" },
  { key: "eduPrice", label: "教育價" },
  { key: "marketPrice", label: "市價" },
  { key: "discount", label: "目前最高折扣" },
  { key: "weight", label: "重量" },
  { key: "warranty", label: "保固" },
] as const;

export const purposeOptions: FilterOption[] = [
  { value: "all", label: "所有用途" },
  { value: "study", label: "學習 / 上課" },
  { value: "office", label: "文書 / 商務" },
  { value: "portable", label: "輕薄攜帶" },
  { value: "gaming", label: "遊戲" },
  { value: "creator", label: "創作 / AI" },
  { value: "budget", label: "入門預算" },
  { value: "large", label: "大螢幕" },
];

export const cpuOptions: FilterOption[] = [
  { value: "all", label: "所有 CPU" },
  { value: "intel-core-i5", label: "Intel Core i5" },
  { value: "intel-core-i7", label: "Intel Core i7" },
  { value: "intel-core-i9", label: "Intel Core i9" },
  { value: "intel-core-ultra", label: "Intel Core Ultra" },
  { value: "amd-ryzen-5", label: "AMD Ryzen 5" },
  { value: "amd-ryzen-7", label: "AMD Ryzen 7" },
  { value: "amd-ryzen-9", label: "AMD Ryzen 9" },
  { value: "amd-ryzen-ai", label: "AMD Ryzen AI" },
];

export const ramOptions: FilterOption[] = [
  { value: "all", label: "所有 RAM" },
  { value: "8g", label: "8G" },
  { value: "16g", label: "16G" },
  { value: "16g-2", label: "16G*2" },
  { value: "32g", label: "32G" },
  { value: "32g-2", label: "32G*2" },
  { value: "64g", label: "64G" },
];

export const storageOptions: FilterOption[] = [
  { value: "all", label: "所有 SSD" },
  { value: "512", label: "512G" },
  { value: "1024", label: "1T" },
  { value: "2048", label: "2T" },
];

export const screenOptions: FilterOption[] = [
  { value: "all", label: "所有尺寸" },
  { value: "13", label: "13 吋" },
  { value: "14", label: "14 吋" },
  { value: "15", label: "15 吋" },
  { value: "16", label: "16 吋" },
  { value: "other", label: "其他尺寸" },
];

export const gpuOptions: FilterOption[] = [
  { value: "all", label: "所有顯示卡" },
  { value: "igpu", label: "內顯" },
  { value: "rtx-4050", label: "RTX 4050" },
  { value: "rtx-4060", label: "RTX 4060" },
  { value: "rtx-4070", label: "RTX 4070" },
  { value: "rtx-5060", label: "RTX 5060" },
  { value: "rtx-5070", label: "RTX 5070" },
  { value: "other", label: "其他等級" },
];

export const budgetOptions: FilterOption[] = [
  { value: "all", label: "所有預算" },
  { value: "under-25000", label: "25000以下" },
  { value: "25001-35000", label: "25001~35000" },
  { value: "35001-45000", label: "35001~45000" },
  { value: "45001-55000", label: "45001~55000" },
  { value: "55001-80000", label: "55001~80000" },
  { value: "80001-plus", label: "80001以上" },
];

export function getBudgetRange(value: string) {
  switch (value) {
    case "under-25000":
      return { min: 0, max: 25000 };
    case "25001-35000":
      return { min: 25001, max: 35000 };
    case "35001-45000":
      return { min: 35001, max: 45000 };
    case "45001-55000":
      return { min: 45001, max: 55000 };
    case "55001-80000":
      return { min: 55001, max: 80000 };
    case "80001-plus":
      return { min: 80001, max: Number.POSITIVE_INFINITY };
    default:
      return { min: 0, max: Number.POSITIVE_INFINITY };
  }
}

export function formatMoney(value: number) {
  return moneyFormatter.format(value);
}

export function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, " ")
    .trim();
}

export function splitList(value: string[] | string | undefined | null) {
  if (!value) return [];
  return Array.isArray(value)
    ? value.flatMap((item) =>
        String(item)
          .split(/[、,，\n|/]+/)
          .map((part) => part.trim())
          .filter(Boolean),
      )
    : String(value)
        .split(/[、,，\n|/]+/)
        .map((item) => item.trim())
        .filter(Boolean);
}

export function buildSearchText(laptop: Laptop) {
  return normalizeText(
    [
      laptop.model,
      laptop.title,
      laptop.family,
      laptop.cpu,
      laptop.memory,
      laptop.storage,
      laptop.gpu,
      laptop.display,
      laptop.warranty,
      laptop.bundle,
      laptop.barcode,
      ...splitList(laptop.highlights),
      ...splitList(laptop.tags),
      ...splitList(laptop.purposes),
    ]
      .filter(Boolean)
      .join(" "),
  );
}

export function getCpuCategory(cpu: string) {
  const value = cpu.toLowerCase();

  if (value.includes("ryzen") && value.includes("ai")) return "amd-ryzen-ai";
  if (value.includes("core ultra")) return "intel-core-ultra";
  if (value.includes("core i9")) return "intel-core-i9";
  if (value.includes("core i7")) return "intel-core-i7";
  if (value.includes("core i5")) return "intel-core-i5";
  if (value.includes("ryzen 9")) return "amd-ryzen-9";
  if (value.includes("ryzen 7")) return "amd-ryzen-7";
  if (value.includes("ryzen 5")) return "amd-ryzen-5";

  return "other";
}

export function getRamCategory(laptop: Laptop) {
  const memory = laptop.memory.toLowerCase();
  const ramGB = laptop.ramGB ?? null;

  if (memory.includes("*2") || memory.includes("2x") || memory.includes("雙通道")) {
    if (ramGB === 16) return "16g-2";
    if (ramGB === 32) return "32g-2";
  }

  if (ramGB === 8) return "8g";
  if (ramGB === 16) return "16g";
  if (ramGB === 32) return "32g";
  if (ramGB === 64) return "64g";

  if (memory.includes("8g")) return "8g";
  if (memory.includes("16g")) return memory.includes("*2") ? "16g-2" : "16g";
  if (memory.includes("32g")) return memory.includes("*2") ? "32g-2" : "32g";
  if (memory.includes("64g")) return "64g";

  return "other";
}

export function getStorageCategory(laptop: Laptop) {
  const storageGB = laptop.storageGB ?? 0;

  if (storageGB >= 1800) return "2048";
  if (storageGB >= 900) return "1024";
  if (storageGB >= 450) return "512";

  const text = laptop.storage.toLowerCase();
  if (text.includes("2t")) return "2048";
  if (text.includes("1t")) return "1024";
  if (text.includes("512")) return "512";

  return "other";
}

export function getScreenCategory(laptop: Laptop) {
  const size = laptop.screenSize ?? null;
  if (!size) return "other";
  if (size < 13.5) return "13";
  if (size < 14.5) return "14";
  if (size < 15.5) return "15";
  if (size < 16.5) return "16";
  return "other";
}

export function getGpuCategory(laptop: Laptop) {
  const value = `${laptop.gpu} ${laptop.gpuTier ?? ""}`.toLowerCase();
  if (!laptop.rtx && !value.includes("radeon") && !value.includes("arc") && !value.includes("iris")) {
    return "igpu";
  }
  if (value.includes("rtx 4050") || value.includes("rtx4050")) return "rtx-4050";
  if (value.includes("rtx 4060") || value.includes("rtx4060")) return "rtx-4060";
  if (value.includes("rtx 4070") || value.includes("rtx4070")) return "rtx-4070";
  if (value.includes("rtx 5060") || value.includes("rtx5060")) return "rtx-5060";
  if (value.includes("rtx 5070") || value.includes("rtx5070")) return "rtx-5070";
  if (!laptop.rtx) return "igpu";
  return "other";
}

export function getPurposeLabel(value: string) {
  const labels: Record<string, string> = {
    study: "學習 / 上課",
    office: "文書 / 商務",
    portable: "輕薄攜帶",
    gaming: "遊戲",
    creator: "創作 / AI",
    budget: "入門預算",
    large: "大螢幕",
  };

  return labels[value] ?? value;
}

export function getPurposeColor(value: string) {
  const colors: Record<string, string> = {
    study: "var(--teal)",
    office: "var(--teal)",
    portable: "var(--sky)",
    gaming: "var(--rose)",
    creator: "var(--gold)",
    budget: "var(--olive)",
    large: "var(--violet)",
  };

  return colors[value] ?? "var(--muted)";
}

export function getGalleryCandidates(laptop: Laptop) {
  const folder = laptop.model;
  const candidates = [
    laptop.image,
    `/laptop-images/model-gallery/${folder}/01.webp`,
    `/laptop-images/model-gallery/${folder}/02.webp`,
    `/laptop-images/model-gallery/${folder}/03.webp`,
    `/laptop-images/model-gallery/${folder}/04.webp`,
  ].filter(Boolean) as string[];

  return Array.from(new Set(candidates));
}

export function getEducationPriceText(showEducationPrice: boolean, eduPrice: number) {
  return showEducationPrice ? formatMoney(eduPrice) : "報價請洽服務人員";
}

export function getBudgetLimit(value: string) {
  return getBudgetRange(value).max;
}

export function getBestDiscount(laptops: Laptop[]) {
  return laptops.reduce((best, item) => (item.discount > best.discount ? item : best), laptops[0]);
}

export function selectRecommended(laptops: Laptop[], count = 6) {
  const target = laptops
    .filter((item) => item.eduPrice >= 23000 && item.eduPrice <= 30000)
    .sort((a, b) => {
      const aGap = Math.abs(a.eduPrice - 26500);
      const bGap = Math.abs(b.eduPrice - 26500);
      return aGap - bGap || b.valueScore - a.valueScore || a.eduPrice - b.eduPrice;
    });

  if (target.length >= count) return target.slice(0, count);

  const fallback = [...laptops]
    .sort(
      (a, b) =>
        Math.abs(a.eduPrice - 26500) - Math.abs(b.eduPrice - 26500) ||
        a.eduPrice - b.eduPrice ||
        b.valueScore - a.valueScore,
    )
    .filter((item) => !target.includes(item));

  return [...target, ...fallback].slice(0, count);
}

export function selectMobileRecommendations(laptops: Laptop[], count = 3) {
  return [...laptops]
    .sort((a, b) => a.eduPrice - b.eduPrice || b.valueScore - a.valueScore)
    .slice(0, count);
}

export function compareMatchCount(selected: string[], target: string) {
  return selected.some((item) => item === target);
}
