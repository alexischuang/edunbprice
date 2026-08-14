import fs from "node:fs/promises";
import path from "node:path";
import * as XLSX from "xlsx";

const root = process.cwd();
const excelPath =
  process.argv.find((arg) => arg.startsWith("--excel="))?.split("=")[1] ??
  "D:\\校園筆電寢具專案\\ASUS\\0814.xlsx";
const dataPath = path.join(root, "app", "laptop-data.ts");
const marker = "export const laptops: Laptop[] = ";

function normalizeText(value) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, " ")
    .trim();
}

function splitList(value) {
  if (!value) return [];
  const list = Array.isArray(value) ? value : String(value).split(/[\n|/]+/);
  return list.map((item) => String(item).trim()).filter(Boolean);
}

function readCell(row, index) {
  return String(row?.[index] ?? "").trim();
}

function readNumber(row, index) {
  const text = String(row?.[index] ?? "").replace(/[^0-9.-]/g, "");
  return text ? Number(text) : 0;
}

function readPositiveNumber(row, index) {
  const value = readNumber(row, index);
  return value > 0 ? value : 0;
}

function parseWeightKg(value) {
  const match = String(value ?? "").match(/([0-9]+(?:\.[0-9]+)?)/);
  return match ? Number(match[1]) : null;
}

function parseScreenSize(value) {
  const match = String(value ?? "").match(/(^|[^0-9])(\d{2}(?:\.\d)?|\d(?:\.\d)?)/);
  if (!match) return null;
  const size = Number(match[2]);
  return Number.isFinite(size) && size >= 10 ? size : null;
}

function parseRamGB(value) {
  const text = String(value ?? "").toLowerCase();
  const match = text.match(/(\d{1,3})\s*g/);
  if (!match) return null;
  const base = Number(match[1]);
  if (!Number.isFinite(base)) return null;
  if (text.includes("*2") || text.includes("2x")) return base * 2;
  return base;
}

function parseStorageGB(value) {
  const text = String(value ?? "").toLowerCase();
  const matchT = text.match(/(\d+(?:\.\d+)?)\s*t/);
  if (matchT) return Math.round(Number(matchT[1]) * 1000);
  const matchG = text.match(/(\d+(?:\.\d+)?)\s*g/);
  if (matchG) return Math.round(Number(matchG[1]));
  return null;
}

function deriveGpuTier(gpu) {
  const text = String(gpu ?? "").toLowerCase();
  if (text.includes("5070")) return 5070;
  if (text.includes("5060")) return 5060;
  if (text.includes("5050")) return 5050;
  if (text.includes("4070")) return 4070;
  if (text.includes("4060")) return 4060;
  if (text.includes("4050")) return 4050;
  if (text.includes("3050")) return 3050;
  if (text.includes("rtx")) return 1000;
  return 0;
}

function inferFamily(model, fallback) {
  if (fallback?.family) return fallback.family;
  const prefix = String(model).split("-")[0]?.trim();
  return prefix || "ASUS";
}

function asArray(value) {
  if (!value) return [];
  return Array.isArray(value) ? value.map(String) : splitList(value);
}

function buildFeatureTags(row, fallback) {
  if (fallback && Array.isArray(fallback.tags) && fallback.tags.length) {
    return [...new Set(fallback.tags.map(String))].slice(0, 6);
  }

  const text = [
    readCell(row, 3),
    readCell(row, 5),
    readCell(row, 6),
    readCell(row, 7),
    readCell(row, 8),
    readCell(row, 4),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  const tags = new Set();
  if (/ai|npu|xdna/.test(text)) tags.add("AI 加速");
  if (/rtx|radeon|arc/.test(text)) tags.add("獨顯效能");
  if (/oled/.test(text)) tags.add("OLED");
  if (/1t|1024|1000/.test(text)) tags.add("1TB SSD");
  if (/16g\*2|32g\*2|2x/.test(text)) tags.add("雙通道");
  if (/13|14/.test(text)) tags.add("輕薄便攜");
  if (/15|16|17|18/.test(text)) tags.add("大螢幕");
  return Array.from(tags).slice(0, 6);
}

function buildPurposes(row, fallback) {
  if (fallback && Array.isArray(fallback.purposes) && fallback.purposes.length) {
    return [...new Set(fallback.purposes.map(String))];
  }

  const text = `${readCell(row, 5)} ${readCell(row, 8)} ${readCell(row, 4)}`.toLowerCase();
  const purposes = new Set(["study", "office"]);
  if (/rtx|gaming|geforce|radeon/.test(text)) purposes.add("gaming");
  if (/ai|creator|xdna/.test(text)) purposes.add("creator");
  const screenSize = parseScreenSize(readCell(row, 4));
  if (screenSize && screenSize >= 15) purposes.add("large");
  const weightKg = parseWeightKg(readCell(row, 9));
  if (weightKg && weightKg <= 1.6) purposes.add("portable");
  return Array.from(purposes);
}

function buildSearchText(laptop) {
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
      laptop.weight,
      laptop.warranty,
      laptop.bundle,
      laptop.barcode,
      ...splitList(laptop.highlights),
      ...splitList(laptop.tags),
      ...asArray(laptop.purposes),
    ]
      .filter(Boolean)
      .join(" "),
  );
}

function buildLaptop(row, fallback, index) {
  const model = readCell(row, 1);
  if (!model) return null;

  const marketPriceFromExcel = readPositiveNumber(row, 12);
  const eduPriceFromExcel = readPositiveNumber(row, 14);
  const hasExcelPrice = marketPriceFromExcel > 0 || eduPriceFromExcel > 0;
  const hasFallbackPrice = Boolean(fallback && (fallback.marketPrice > 0 || fallback.eduPrice > 0));
  if (!hasExcelPrice && !hasFallbackPrice) return null;

  const title = readCell(row, 2) || fallback?.title || model;
  const cpu = readCell(row, 5) || fallback?.cpu || "";
  const memory = readCell(row, 6) || fallback?.memory || "";
  const storage = readCell(row, 7) || fallback?.storage || "";
  const gpu = readCell(row, 8) || fallback?.gpu || "";
  const display = readCell(row, 7) || fallback?.display || "";
  const weight = readCell(row, 9) || fallback?.weight || "";
  const warranty = readCell(row, 11) || fallback?.warranty || "";
  const bundle = readCell(row, 10) || fallback?.bundle || "";
  const marketPrice = marketPriceFromExcel > 0 ? marketPriceFromExcel : fallback?.marketPrice || 0;
  const eduPrice = eduPriceFromExcel > 0 ? eduPriceFromExcel : fallback?.eduPrice || 0;
  const discount = Math.max(0, marketPrice - eduPrice);
  const discountRate = marketPrice > 0 ? Number(((discount / marketPrice) * 100).toFixed(1)) : 0;
  const screenSize = parseScreenSize(display) ?? fallback?.screenSize ?? null;
  const weightKg = parseWeightKg(weight) ?? fallback?.weightKg ?? null;
  const ramGB = parseRamGB(memory) ?? fallback?.ramGB ?? null;
  const storageGB = parseStorageGB(storage) ?? fallback?.storageGB ?? null;
  const rtx = fallback?.rtx ?? /rtx/i.test(gpu);
  const oled = fallback?.oled ?? /oled/i.test(display);
  const ai = fallback?.ai ?? /ai|xdna|core ultra/i.test(cpu);
  const gpuTier = fallback?.gpuTier ?? deriveGpuTier(gpu);
  const image = fallback?.image || `/laptop-images/model-gallery/${model}/01.webp`;
  const imageKind = fallback?.imageKind || (image ? "產品圖" : "圖片待補");
  const featureIntro = readCell(row, 15) || fallback?.featureIntro || "";
  const highlights = buildFeatureTags(row, fallback);
  const tags = highlights.length
    ? highlights
    : fallback && Array.isArray(fallback.tags)
      ? [...new Set(fallback.tags.map(String))]
      : [];
  const purposes = buildPurposes(row, fallback);
  const performance =
    fallback?.performance ??
    Math.round((marketPrice > 0 ? 100000 / marketPrice : 0) + (ai ? 12 : 0) + (rtx ? 18 : 0));
  const valueScore =
    fallback?.valueScore ??
    Math.round((marketPrice > 0 ? 120000 / marketPrice : 0) + discountRate * 2 + (ai ? 8 : 0));

  const laptop = {
    id: fallback?.id ?? `laptop-${String(index + 1).padStart(3, "0")}`,
    barcode: readCell(row, 0) || fallback?.barcode || "",
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
    featureIntro,
    highlights,
    tags,
    purposes,
    image,
    imageKind,
    screenSize,
    weightKg,
    ramGB,
    storageGB,
    rtx,
    oled,
    ai,
    gpuTier,
    performance,
    valueScore,
    searchText: "",
  };

  laptop.searchText = buildSearchText(laptop);
  return laptop;
}

async function readFallbackLaptops() {
  const text = await fs.readFile(dataPath, "utf8");
  const start = text.indexOf(marker);
  if (start < 0) throw new Error("Cannot find laptop data marker.");
  return JSON.parse(text.slice(start + marker.length).trim().replace(/;$/, ""));
}

async function main() {
  const fallbackLaptops = await readFallbackLaptops();
  const fallbackByModel = new Map(fallbackLaptops.map((item) => [normalizeText(item.model), item]));
  const workbook = XLSX.read(await fs.readFile(excelPath), { cellDates: true });
  const firstSheet = workbook.SheetNames[0];

  if (!firstSheet) {
    throw new Error("Excel does not contain a sheet.");
  }

  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[firstSheet], { header: 1, defval: "" });
  const laptops = [];
  const seenModels = new Set();
  let skipped = 0;

  for (const row of rows.slice(1)) {
    const model = readCell(row, 1);
    if (!model || seenModels.has(model)) continue;
    seenModels.add(model);
    const fallback = fallbackByModel.get(normalizeText(model));
    const laptop = buildLaptop(row, fallback, laptops.length);
    if (!laptop) {
      skipped += 1;
      continue;
    }
    laptops.push(laptop);
  }

  const content = [
    "export type Laptop = {",
    "  id: string;",
    "  barcode: string;",
    "  model: string;",
    "  title: string;",
    "  family: string;",
    "  cpu: string;",
    "  memory: string;",
    "  storage: string;",
    "  gpu: string;",
    "  display: string;",
    "  weight: string;",
    "  warranty: string;",
    "  bundle: string;",
    "  marketPrice: number;",
    "  eduPrice: number;",
    "  discount: number;",
    "  discountRate: number;",
    "  featureIntro: string;",
    "  highlights: string[] | string;",
    "  tags: string[] | string;",
    "  purposes: string[] | string;",
    "  image: string;",
    "  imageKind: string;",
    "  screenSize: number | null;",
    "  weightKg: number | null;",
    "  ramGB: number | null;",
    "  storageGB: number | null;",
    "  rtx: boolean;",
    "  oled: boolean;",
    "  ai: boolean;",
    "  gpuTier: number;",
    "  performance: number;",
    "  valueScore: number;",
    "  searchText: string;",
    "};",
    "",
    "export const laptops: Laptop[] = ",
    JSON.stringify(laptops, null, 2),
    ";",
    "",
  ].join("\n");

  await fs.writeFile(dataPath, content, "utf8");
  console.log(JSON.stringify({ total: laptops.length, skipped, file: dataPath }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
