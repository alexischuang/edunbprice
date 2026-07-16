import fs from "node:fs/promises";
import path from "node:path";
import * as XLSX from "xlsx";
import { kv } from "@vercel/kv";
import {
  buildSearchText,
  getCpuCategory,
  getGalleryCandidates,
  getGpuCategory,
  getPurposeLabel,
  getScreenCategory,
  getStorageCategory,
  normalizeText,
} from "./catalog";
import { laptops as fallbackLaptops, type Laptop } from "./laptop-data";

const CATALOG_STATE_KEY = "education:catalog-state:v1";
const CATALOG_STATE_FILE = path.join(process.cwd(), "temp", "catalog-state.json");

export type CatalogStatus = "default" | "custom" | "cleared";
export type CatalogStorageStatus = "connected" | "local" | "missing";

export type CatalogState = {
  status: CatalogStatus;
  storageStatus: CatalogStorageStatus;
  sourceFile: string | null;
  updatedAt: string | null;
  laptops: Laptop[];
  missingImages: string[];
  matchedImageModels: number;
  totalImageModels: number;
};

type StoredCatalogState = Omit<CatalogState, "storageStatus"> & {
  storageStatus?: CatalogStorageStatus;
  imageFiles?: Record<string, string[]>;
};

type ExcelRow = Record<string, unknown>;

function hasKvConfig() {
  return Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
}

function getStorageStatus(): CatalogStorageStatus {
  if (hasKvConfig()) return "connected";
  return process.env.NODE_ENV === "production" ? "missing" : "local";
}

async function readFileState(): Promise<StoredCatalogState | null> {
  try {
    const text = await fs.readFile(CATALOG_STATE_FILE, "utf8");
    return JSON.parse(text) as StoredCatalogState;
  } catch {
    return null;
  }
}

async function writeFileState(state: StoredCatalogState) {
  await fs.mkdir(path.dirname(CATALOG_STATE_FILE), { recursive: true });
  await fs.writeFile(CATALOG_STATE_FILE, JSON.stringify(state, null, 2), "utf8");
}

async function readStoredState(): Promise<StoredCatalogState | null> {
  if (hasKvConfig()) {
    try {
      const state = (await kv.get<StoredCatalogState>(CATALOG_STATE_KEY)) ?? null;
      if (state) return state;
    } catch {
      if (process.env.NODE_ENV !== "production") {
        // Fall back to the local file cache when KV is unavailable during local development.
        return readFileState();
      }
    }
  }

  if (process.env.NODE_ENV !== "production") {
    return readFileState();
  }

  return null;
}

async function writeStoredState(state: StoredCatalogState) {
  if (hasKvConfig()) {
    try {
      await kv.set(CATALOG_STATE_KEY, state);
      return;
    } catch {
      if (process.env.NODE_ENV !== "production") {
        // Fall back to the local file cache when KV write fails during local development.
        await writeFileState(state);
        return;
      }
    }
  }

  if (process.env.NODE_ENV !== "production") {
    await writeFileState(state);
    return;
  }

  throw new Error("Vercel KV 尚未連線，無法儲存更新。");
}

function getString(row: ExcelRow, keys: string[]) {
  for (const key of keys) {
    const value = row[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return String(value).trim();
    }
  }
  return "";
}

function getNumber(row: ExcelRow, keys: string[]) {
  const text = getString(row, keys).replace(/[^0-9.-]/g, "");
  return text ? Number(text) : 0;
}

function parseWeightKg(value: string) {
  const match = value.match(/([0-9]+(?:\.[0-9]+)?)/);
  return match ? Number(match[1]) : null;
}

function parseScreenSize(value: string) {
  const match = value.match(/(^|[^0-9])(\d{2}(?:\.\d)?|\d(?:\.\d)?)/);
  if (!match) return null;
  const size = Number(match[2]);
  if (!Number.isFinite(size)) return null;
  if (size < 10) return null;
  return size;
}

function parseRamGB(value: string) {
  const text = value.toLowerCase();
  const match = text.match(/(\d{1,3})\s*g/);
  if (!match) return null;
  return Number(match[1]);
}

function parseStorageGB(value: string) {
  const text = value.toLowerCase();
  const matchT = text.match(/(\d+(?:\.\d+)?)\s*t/);
  if (matchT) return Math.round(Number(matchT[1]) * 1000);
  const matchG = text.match(/(\d+(?:\.\d+)?)\s*g/);
  if (matchG) return Math.round(Number(matchG[1]));
  return null;
}

function deriveGpuTier(gpu: string) {
  const text = gpu.toLowerCase();
  if (text.includes("5070")) return 5070;
  if (text.includes("5060")) return 5060;
  if (text.includes("4070")) return 4070;
  if (text.includes("4060")) return 4060;
  if (text.includes("4050")) return 4050;
  if (text.includes("rtx")) return 1000;
  return 0;
}

function buildFeatureTags(row: ExcelRow, fallback?: Laptop) {
  const text = [
    getString(row, ["特色介紹", "重點特色"]),
    getString(row, ["CPU"]),
    getString(row, ["記憶體"]),
    getString(row, ["硬碟"]),
    getString(row, ["顯示卡"]),
    getString(row, ["螢幕"]),
  ]
    .filter(Boolean)
    .join(" ");

  const tags = new Set<string>(fallback ? (Array.isArray(fallback.tags) ? fallback.tags : []) : []);
  if (/ai|xdna/i.test(text)) tags.add("AI 加速");
  if (/rtx|radeon|arc/i.test(text)) tags.add("獨顯效能");
  if (/oled/i.test(text)) tags.add("OLED");
  if (/1t|1024|1000/i.test(text)) tags.add("1TB SSD");
  if (/16g\*2|32g\*2|2x/i.test(text)) tags.add("雙通道記憶體");
  if (/13|14/.test(text)) tags.add("輕薄便攜");
  return Array.from(tags).slice(0, 6);
}

function buildPurposes(row: ExcelRow, fallback?: Laptop) {
  if (fallback && Array.isArray(fallback.purposes) && fallback.purposes.length) {
    return fallback.purposes;
  }

  const text = `${getString(row, ["CPU"])} ${getString(row, ["顯示卡"])} ${getString(row, ["螢幕"])}`.toLowerCase();
  const purposes = new Set<string>(["study", "office"]);
  if (/rtx|gaming|顯示卡|geforce/.test(text)) purposes.add("gaming");
  if (/ai|creator|xDNA/i.test(text)) purposes.add("creator");
  if (parseScreenSize(getString(row, ["螢幕"])) && parseScreenSize(getString(row, ["螢幕"]))! >= 15) {
    purposes.add("large");
  }
  if (parseWeightKg(getString(row, ["重量"])) && parseWeightKg(getString(row, ["重量"]))! <= 1.6) {
    purposes.add("portable");
  }
  return Array.from(purposes);
}

function inferFamily(model: string, fallback?: Laptop) {
  if (fallback?.family) return fallback.family;
  const prefix = model.split("-")[0]?.trim();
  return prefix || "ASUS";
}

function resolvePrimaryImage(model: string, existingImage: string) {
  const candidates = getGalleryCandidates({
    ...fallbackLaptops[0],
    id: "",
    barcode: "",
    model,
    title: "",
    family: "",
    cpu: "",
    memory: "",
    storage: "",
    gpu: "",
    display: "",
    weight: "",
    warranty: "",
    bundle: "",
    marketPrice: 0,
    eduPrice: 0,
    discount: 0,
    discountRate: 0,
    featureIntro: "",
    highlights: [],
    tags: [],
    purposes: [],
    image: existingImage,
    imageKind: "",
    screenSize: null,
    weightKg: null,
    ramGB: null,
    storageGB: null,
    rtx: false,
    oled: false,
    ai: false,
    gpuTier: 0,
    performance: 0,
    valueScore: 0,
    searchText: "",
  });

  return candidates[0] ?? "";
}

function buildLaptopFromRow(row: ExcelRow, fallback?: Laptop, index = 0): Laptop | null {
  const model = getString(row, ["型號", "model", "Model"]);
  if (!model) return null;

  const title = getString(row, ["建檔檔名", "標題", "title"]) || fallback?.title || model;
  const cpu = getString(row, ["CPU"]) || fallback?.cpu || "";
  const memory = getString(row, ["記憶體", "RAM"]) || fallback?.memory || "";
  const storage = getString(row, ["硬碟", "SSD"]) || fallback?.storage || "";
  const gpu = getString(row, ["顯示卡", "GPU"]) || fallback?.gpu || "";
  const display = getString(row, ["螢幕", "LCD"]) || fallback?.display || "";
  const weight = getString(row, ["重量"]) || fallback?.weight || "";
  const warranty = getString(row, ["保固"]) || fallback?.warranty || "";
  const bundle = getString(row, ["標配", "bundle"]) || fallback?.bundle || "";
  const marketPrice = getNumber(row, ["建議售價", "市價", "marketPrice"]) || fallback?.marketPrice || 0;
  const eduPrice = getNumber(row, ["教育價", "專案價", "eduPrice"]) || fallback?.eduPrice || 0;
  const discount = Math.max(0, marketPrice - eduPrice);
  const discountRate = marketPrice > 0 ? Number((((marketPrice - eduPrice) / marketPrice) * 100).toFixed(1)) : 0;
  const screenSize = parseScreenSize(display) ?? fallback?.screenSize ?? null;
  const weightKg = parseWeightKg(weight) ?? fallback?.weightKg ?? null;
  const ramGB = parseRamGB(memory) ?? fallback?.ramGB ?? null;
  const storageGB = parseStorageGB(storage) ?? fallback?.storageGB ?? null;
  const rtx = fallback?.rtx ?? /rtx/i.test(gpu);
  const oled = fallback?.oled ?? /oled/i.test(display);
  const ai = fallback?.ai ?? /ai|xdna|core ultra/i.test(cpu);
  const gpuTier = fallback?.gpuTier ?? deriveGpuTier(gpu);
  const image = resolvePrimaryImage(model, fallback?.image ?? "");

  const next: Laptop = {
    id: fallback?.id ?? `laptop-${String(index + 1).padStart(3, "0")}`,
    barcode: getString(row, ["條碼", "國條", "barcode"]) || fallback?.barcode || "",
    model,
    title,
    family: inferFamily(model, fallback),
    cpu,
    memory,
    storage,
    gpu,
    display,
    weight,
    warranty,
    bundle,
    marketPrice,
    eduPrice,
    discount,
    discountRate,
    featureIntro: getString(row, ["特色介紹", "featureIntro"]) || fallback?.featureIntro || "",
    highlights: buildFeatureTags(row, fallback),
    tags: buildFeatureTags(row, fallback),
    purposes: buildPurposes(row, fallback),
    image,
    imageKind: image ? fallback?.imageKind || "產品圖" : "缺圖",
    screenSize,
    weightKg,
    ramGB,
    storageGB,
    rtx,
    oled,
    ai,
    gpuTier,
    performance: fallback?.performance ?? Math.round((marketPrice > 0 ? 100000 / marketPrice : 0) + (ai ? 12 : 0) + (rtx ? 18 : 0)),
    valueScore: fallback?.valueScore ?? Math.round((marketPrice > 0 ? 120000 / marketPrice : 0) + (discountRate * 2) + (ai ? 8 : 0)),
    searchText: "",
  };

  next.searchText = buildSearchText(next);
  return next;
}

async function scanGalleryMatch(laptops: Laptop[]) {
  const publicRoot = path.join(process.cwd(), "public");
  const missingImages: string[] = [];

  async function exists(candidate: string) {
    const full = path.join(publicRoot, candidate.replace(/^\//, ""));
    try {
      const stat = await fs.stat(full);
      return stat.isFile();
    } catch {
      return false;
    }
  }

  for (const laptop of laptops) {
    const candidates = getGalleryCandidates(laptop);
    let hasImage = false;
    for (const candidate of candidates) {
      if (await exists(candidate)) {
        hasImage = true;
        break;
      }
    }
    if (!hasImage) missingImages.push(laptop.model);
  }

  return {
    missingImages,
    matchedImageModels: laptops.length - missingImages.length,
    totalImageModels: laptops.length,
  };
}

function normalizeState(state: Partial<StoredCatalogState> | null | undefined): StoredCatalogState | null {
  if (!state || !Array.isArray(state.laptops)) return null;
  return {
    status: state.status === "cleared" ? "cleared" : state.status === "custom" ? "custom" : "default",
    storageStatus: getStorageStatus(),
    sourceFile: typeof state.sourceFile === "string" ? state.sourceFile : null,
    updatedAt: typeof state.updatedAt === "string" ? state.updatedAt : null,
    laptops: state.laptops.filter(Boolean) as Laptop[],
    missingImages: Array.isArray(state.missingImages) ? state.missingImages.map(String) : [],
    matchedImageModels: Number(state.matchedImageModels ?? 0),
    totalImageModels: Number(state.totalImageModels ?? 0),
    imageFiles: state.imageFiles && typeof state.imageFiles === "object" ? state.imageFiles : {},
  };
}

export async function getCatalogState(): Promise<CatalogState> {
  const stored = normalizeState(await readStoredState());
  if (!stored) {
    const initial = fallbackLaptops.map((item) => ({ ...item }));
    const gallery = await scanGalleryMatch(initial);
    return {
      status: "default",
      storageStatus: getStorageStatus(),
      sourceFile: null,
      updatedAt: null,
      laptops: initial,
      ...gallery,
    };
  }

  return {
    status: stored.status,
    storageStatus: getStorageStatus(),
    sourceFile: stored.sourceFile,
    updatedAt: stored.updatedAt,
    laptops: stored.status === "cleared" ? [] : stored.laptops,
    missingImages: stored.status === "cleared" ? [] : stored.missingImages,
    matchedImageModels: stored.status === "cleared" ? 0 : stored.matchedImageModels,
    totalImageModels: stored.status === "cleared" ? 0 : stored.totalImageModels,
  };
}

export async function clearCatalogState() {
  const state: CatalogState = {
    status: "cleared",
    storageStatus: getStorageStatus(),
    sourceFile: null,
    updatedAt: new Date().toISOString(),
    laptops: [],
    missingImages: [],
    matchedImageModels: 0,
    totalImageModels: 0,
  };

  await writeStoredState(state as StoredCatalogState);
  return state;
}

export async function importCatalogFromExcel(file: File) {
  const fallbackCatalog = (await getCatalogState()).laptops.length ? (await getCatalogState()).laptops : fallbackLaptops;
  const buffer = Buffer.from(await file.arrayBuffer());
  const workbook = XLSX.read(buffer, { cellDates: true });
  const firstSheet = workbook.SheetNames[0];

  if (!firstSheet) {
    throw new Error("找不到 Excel 工作表。");
  }

  const rows = XLSX.utils.sheet_to_json<ExcelRow>(workbook.Sheets[firstSheet], { defval: "" });
  const fallbackByModel = new Map(fallbackCatalog.map((item) => [normalizeText(item.model), item]));

  const laptops = rows
    .map((row, index) => buildLaptopFromRow(row, fallbackByModel.get(normalizeText(getString(row, ["型號"]))) ?? undefined, index))
    .filter(Boolean) as Laptop[];

  const gallery = await scanGalleryMatch(laptops);
  const state: CatalogState = {
    status: "custom",
    storageStatus: getStorageStatus(),
    sourceFile: file.name,
    updatedAt: new Date().toISOString(),
    laptops,
    missingImages: gallery.missingImages,
    matchedImageModels: gallery.matchedImageModels,
    totalImageModels: gallery.totalImageModels,
  };

  await writeStoredState(state as StoredCatalogState);
  return state;
}

export function summarizeCatalog(catalog: CatalogState, fallbackCatalog = fallbackLaptops) {
  const currentByModel = new Map(catalog.laptops.map((item) => [normalizeText(item.model), item]));
  const fallbackByModel = new Map(fallbackCatalog.map((item) => [normalizeText(item.model), item]));

  const newModels = catalog.laptops.filter((item) => !fallbackByModel.has(normalizeText(item.model)));
  const retainedModels = catalog.laptops.filter((item) => fallbackByModel.has(normalizeText(item.model)));
  const removedModels = fallbackCatalog
    .map((item) => item.model)
    .filter((model) => !currentByModel.has(normalizeText(model)));

  return {
    currentCount: fallbackCatalog.length,
    nextCount: catalog.laptops.length,
    newCount: newModels.length,
    retainedCount: retainedModels.length,
    removedCount: removedModels.length,
    missingImageCount: catalog.missingImages.length,
    matchedImageCount: catalog.matchedImageModels,
    sourceFile: catalog.sourceFile,
    updatedAt: catalog.updatedAt,
    removedModels,
    missingImages: catalog.missingImages,
  };
}
