import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = process.cwd();
const maxImages = Number(
  process.argv.find((arg) => arg.startsWith("--max="))?.split("=")[1] || 4,
);

const dataPath = path.join(root, "app", "laptop-data.ts");
const outputRoot = path.join(root, "public", "laptop-images", "model-gallery");
const mapPath = path.join(root, "app", "model-gallery.js");
const reportPath = path.join(root, "app", "model-gallery-report.json");
const marker = "export const laptops: Laptop[] = ";
const imageExtensions = new Set([".jpg", ".jpeg", ".png", ".webp"]);
const excludedDirs = new Set([
  ".git",
  ".deploy-github",
  ".chrome-screenshot-profile",
  ".vinext",
  ".wrangler",
  "build",
  "dist",
  "node_modules",
  "public",
]);
const ignoredNamePattern = /layout-check|quote-check|hidden-toggle-check|index-hidden-toggle-check/i;
const collator = new Intl.Collator("en", { numeric: true, sensitivity: "base" });

function safeSegment(value) {
  return String(value).replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_");
}

async function readLaptops() {
  const text = await fs.readFile(dataPath, "utf8");
  const start = text.indexOf(marker);
  if (start < 0) throw new Error("Cannot find laptop data marker.");
  return JSON.parse(text.slice(start + marker.length).trim().replace(/;$/, ""));
}

async function listImageFiles(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!excludedDirs.has(entry.name)) {
        files.push(...(await listImageFiles(fullPath)));
      }
      continue;
    }
    if (!entry.isFile()) continue;
    if (ignoredNamePattern.test(entry.name)) continue;
    if (imageExtensions.has(path.extname(entry.name).toLowerCase())) {
      files.push(fullPath);
    }
  }
  return files;
}

function sortImagePaths(files) {
  return files.sort((a, b) => collator.compare(path.basename(a), path.basename(b)));
}

async function ensureOutputRoot() {
  const resolvedRoot = path.resolve(root);
  const resolvedOutput = path.resolve(outputRoot);
  if (!resolvedOutput.startsWith(resolvedRoot + path.sep)) {
    throw new Error("Refusing to write outside the workspace.");
  }
  if (!resolvedOutput.endsWith(path.join("public", "laptop-images", "model-gallery"))) {
    throw new Error("Refusing to remove an unexpected output folder.");
  }
  await fs.rm(outputRoot, { recursive: true, force: true });
  await fs.mkdir(outputRoot, { recursive: true });
}

async function convertImage(source, destination) {
  await sharp(source)
    .rotate()
    .resize({ width: 1200, height: 900, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 82 })
    .toFile(destination);
}

function toWebPath(...segments) {
  return segments.join("/");
}

async function main() {
  const laptops = await readLaptops();
  const images = await listImageFiles(root);
  await ensureOutputRoot();

  const modelGalleryMap = {};
  const report = [];

  for (const laptop of laptops) {
    const model = String(laptop.model || "");
    if (!model) continue;
    const modelLower = model.toLowerCase();
    const matches = sortImagePaths(
      images.filter((filePath) => filePath.toLowerCase().includes(modelLower)),
    );
    const selected = matches.slice(0, maxImages);
    const folder = safeSegment(model);
    const outputDir = path.join(outputRoot, folder);
    const webPaths = [];

    if (selected.length) {
      await fs.mkdir(outputDir, { recursive: true });
    }

    for (let index = 0; index < selected.length; index += 1) {
      const fileName = `${String(index + 1).padStart(2, "0")}.webp`;
      const outputPath = path.join(outputDir, fileName);
      await convertImage(selected[index], outputPath);
      webPaths.push(toWebPath("public", "laptop-images", "model-gallery", folder, fileName));
    }

    if (webPaths.length) {
      modelGalleryMap[model] = webPaths;
    }

    report.push({
      model,
      matched: matches.length,
      exported: webPaths.length,
      sources: selected.map((filePath) => path.relative(root, filePath)),
    });
  }

  const mapSource = [
    "window.modelGalleryMap = ",
    JSON.stringify(modelGalleryMap, null, 2),
    ";\n",
  ].join("");

  await fs.writeFile(mapPath, mapSource, "utf8");
  await fs.writeFile(
    reportPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        totalModels: laptops.length,
        matchedModels: Object.keys(modelGalleryMap).length,
        maxImages,
        report,
      },
      null,
      2,
    ),
    "utf8",
  );

  console.log(
    JSON.stringify({
      totalModels: laptops.length,
      matchedModels: Object.keys(modelGalleryMap).length,
      exportedImages: Object.values(modelGalleryMap).reduce((sum, items) => sum + items.length, 0),
      mapPath,
      reportPath,
    }),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
