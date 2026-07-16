import fs from "node:fs/promises";
import path from "node:path";
import * as XLSX from "xlsx";

const root = process.cwd();
const excelPath = process.argv.find((arg) => arg.startsWith("--excel="))?.split("=")[1];
const sourceExcel =
  excelPath || "D:\\校園筆電寢具專案\\ASUS\\202605PIC\\20260715.xlsx";
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
  const parts = Array.isArray(value) ? value : String(value).split(/[\n|/、,]+/);
  return parts.map((item) => String(item).trim()).filter(Boolean);
}

function formatMoney(value) {
  return Number(value || 0);
}

function getString(row, keys) {
  for (const key of keys) {
    const value = row[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return String(value).trim();
    }
  }
  return "";
}

function getNumber(row, keys) {
  const text = getString(row, keys).replace(/[^0-9.-]/g, "");
  return text ? Number(text) : 0;
}

function parseScreenSize(value) {
  const match = String(value).match(/(^|[^0-9])(\d{2}(?:\.\d)?|\d(?:\.\d)?)/);
  if (!match) return null;
  const size = Number(match[2]);
  return Number.isFinite(size) && size >= 10 ? size : null;
}

function parseRamGB(value) {
  const text = String(value).toLowerCase();
  const match = text.match(/(\d{1,3})\s*g/);
  return match ? Number(match[1]) : null;
}

function parseStorageGB(value) {
  const text = String(value).toLowerCase();
  const matchT = text.match(/(\d+(?:\.\d+)?)\s*t/);
  if (matchT) return Math.round(Number(matchT[1]) * 1000);
  const matchG = text.match(/(\d+(?:\.\d+)?)\s*g/);
  return matchG ? Math.round(Number(matchG[1])) : null;
}

function deriveGpuTier(gpu) {
  const text = String(gpu).toLowerCase();
  if (text.includes("5070")) return 5070;
  if (text.includes("5060")) return 5060;
  if (text.includes("5050")) return 5050;
  if (text.includes("4070")) return 4070;
  if (text.includes("4060")) return 4060;
  if (text.includes("4050")) return 4050;
  if (text.includes("rtx")) return 1000;
  return 0;
}

function inferFamily(model, fallback) {
  if (fallback?.family) return fallback.family;
  const prefix = String(model).split("-")[0]?.trim();
  return prefix || "ASUS";
}

function getCpuCategory(cpu) {
  const value = String(cpu).toLowerCase();
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

function buildFeatureTags(row, fallback) {
  const text = [
    getString(row, ["特色介紹", "featureIntro"]),
    getString(row, ["CPU"]),
    getString(row, ["顯示卡"]),
    getString(row, ["記憶體"]),
    getString(row, ["硬碟"]),
    getString(row, ["螢幕"]),
  ]
    .filter(Boolean)
    .join(" ");

  const tags = new Set(Array.isArray(fallback?.tags) ? fallback.tags : []);
  if (/ai|xdna/i.test(text)) tags.add("AI 加速");
  if (/rtx|radeon|arc/i.test(text)) tags.add("獨顯效能");
  if (/oled/i.test(text)) tags.add("OLED");
  if (/1t|1024|1000/i.test(text)) tags.add("1TB SSD");
  if (/16g\*2|32g\*2|2x/i.test(text)) tags.add("大記憶體");
  if (/13|14/.test(text)) tags.add("輕薄便攜");
  return Array.from(tags).slice(0, 6);
}

function buildPurposes(row, fallback) {
  if (fallback && Array.isArray(fallback.purposes) && fallback.purposes.length) {
    return fallback.purposes;
  }

  const text = `${getString(row, ["CPU"])} ${getString(row, ["顯示卡"])} ${getString(row, ["螢幕"])}`.toLowerCase();
  const purposes = new Set(["study", "office"]);
  if (/rtx|gaming|geforce/.test(text)) purposes.add("gaming");
  if (/ai|creator|xdna/i.test(text)) purposes.add("creator");
  if ((parseScreenSize(getString(row, ["螢幕"])) ?? 0) >= 15) purposes.add("large");
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

async function readFallbackLaptops() {
  const text = await fs.readFile(dataPath, "utf8");
  const start = text.indexOf(marker);
  if (start < 0) throw new Error("Cannot find laptop data marker.");
  return JSON.parse(text.slice(start + marker.length).trim().replace(/;$/, ""));
}

function resolvePrimaryImage(model, fallbackImage) {
  if (fallbackImage) return fallbackImage;
  const folder = String(model);
  const candidate = `/laptop-images/model-gallery/${folder}/01.webp`;
  return candidate;
}

async function main() {
  const fallbackLaptops = await readFallbackLaptops();
  const workbook = XLSX.read(await fs.readFile(sourceExcel), { cellDates: true });
  const firstSheet = workbook.SheetNames[0];
  if (!firstSheet) throw new Error("Excel does not contain a sheet.");

  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[firstSheet], { defval: "" });
  const fallbackByModel = new Map(
    fallbackLaptops.map((item) => [normalizeText(item.model), item]),
  );

  const laptops = rows
    .map((row, index) => {
      const model = getString(row, ["型號", "model", "Model"]);
      if (!model) return null;
      const fallback = fallbackByModel.get(normalizeText(model));
      const title = getString(row, ["建檔檔名", "標題", "title"]) || fallback?.title || model;
      const cpu = getString(row, ["CPU"]) || fallback?.cpu || "";
      const memory = getString(row, ["記憶體", "RAM"]) || fallback?.memory || "";
      const storage = getString(row, ["硬碟", "SSD"]) || fallback?.storage || "";
      const gpu = getString(row, ["顯示卡", "GPU"]) || fallback?.gpu || "";
      const display = getString(row, ["螢幕", "LCD"]) || fallback?.display || "";
      const weight = getString(row, ["重量"]) || fallback?.weight || "";
      const warranty = getString(row, ["保固"]) || fallback?.warranty || "";
      const bundle = getString(row, ["標配", "bundle"]) || fallback?.bundle || "";
      const marketPrice =
        getNumber(row, ["建議售價", "marketPrice"]) || fallback?.marketPrice || 0;
      const eduPrice = getNumber(row, ["教育價", "eduPrice"]) || fallback?.eduPrice || 0;
      const discount = Math.max(0, marketPrice - eduPrice);
      const discountRate = marketPrice > 0 ? Number(((discount / marketPrice) * 100).toFixed(1)) : 0;
      const screenSize = parseScreenSize(display) ?? fallback?.screenSize ?? null;
      const weightKg = Number(weight.match(/([0-9]+(?:\.[0-9]+)?)/)?.[1] ?? NaN);
      const ramGB = parseRamGB(memory) ?? fallback?.ramGB ?? null;
      const storageGB = parseStorageGB(storage) ?? fallback?.storageGB ?? null;
      const rtx = fallback?.rtx ?? /rtx/i.test(gpu);
      const oled = fallback?.oled ?? /oled/i.test(display);
      const ai = fallback?.ai ?? /ai|xdna|core ultra/i.test(cpu);
      const gpuTier = fallback?.gpuTier ?? deriveGpuTier(gpu);
      const image = resolvePrimaryImage(model, fallback?.image ?? "");
      const highlights = buildFeatureTags(row, fallback);
      const tags = buildFeatureTags(row, fallback);
      const purposes = buildPurposes(row, fallback);
      const next = {
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
        marketPrice: formatMoney(marketPrice),
        eduPrice: formatMoney(eduPrice),
        discount,
        discountRate,
        featureIntro: getString(row, ["特色介紹", "featureIntro"]) || fallback?.featureIntro || "",
        highlights,
        tags,
        purposes,
        image,
        imageKind: image ? fallback?.imageKind || "產品圖" : "缺圖",
        screenSize,
        weightKg: Number.isFinite(weightKg) ? Number(weightKg.toFixed(2)) : fallback?.weightKg ?? null,
        ramGB,
        storageGB,
        rtx,
        oled,
        ai,
        gpuTier,
        performance: fallback?.performance ?? Math.round((marketPrice > 0 ? 100000 / marketPrice : 0) + (ai ? 12 : 0) + (rtx ? 18 : 0)),
        valueScore: fallback?.valueScore ?? Math.round((marketPrice > 0 ? 120000 / marketPrice : 0) + (discountRate * 2) + (ai ? 8 : 0)),
      };
      next.searchText = buildSearchText(next);
      return next;
    })
    .filter(Boolean);

  const content = [
    'export type Laptop = {',
    '  id: string;',
    '  barcode: string;',
    '  model: string;',
    '  title: string;',
    '  family: string;',
    '  cpu: string;',
    '  memory: string;',
    '  storage: string;',
    '  gpu: string;',
    '  display: string;',
    '  weight: string;',
    '  warranty: string;',
    '  bundle: string;',
    '  marketPrice: number;',
    '  eduPrice: number;',
    '  discount: number;',
    '  discountRate: number;',
    '  featureIntro: string;',
    '  highlights: string[] | string;',
    '  tags: string[] | string;',
    '  purposes: string[] | string;',
    '  image: string;',
    '  imageKind: string;',
    '  screenSize: number | null;',
    '  weightKg: number | null;',
    '  ramGB: number | null;',
    '  storageGB: number | null;',
    '  rtx: boolean;',
    '  oled: boolean;',
    '  ai: boolean;',
    '  gpuTier: number;',
    '  performance: number;',
    '  valueScore: number;',
    '  searchText: string;',
    '};',
    '',
    'export const laptops: Laptop[] = ',
    JSON.stringify(laptops, null, 2),
    ';',
    '',
  ].join('\n');

  await fs.writeFile(dataPath, content, 'utf8');
  console.log(JSON.stringify({ total: laptops.length, file: dataPath }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
