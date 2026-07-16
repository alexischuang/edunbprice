import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = process.cwd();
const targetFolders = process.argv.slice(2);
const imageExtensions = new Set([".jpg", ".jpeg", ".png", ".webp"]);

if (!targetFolders.length) {
  console.log("Usage: node scripts/convert-gallery-folders.mjs <folder> [folder...]");
  process.exit(1);
}

function isInsideWorkspace(targetPath) {
  const resolvedRoot = path.resolve(root);
  const resolvedTarget = path.resolve(targetPath);
  return resolvedTarget.startsWith(resolvedRoot + path.sep);
}

async function convertFolder(folder) {
  const resolvedFolder = path.resolve(folder);
  if (!isInsideWorkspace(resolvedFolder)) {
    throw new Error(`Refusing to touch path outside workspace: ${folder}`);
  }

  const entries = await fs.readdir(resolvedFolder, { withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((name) => imageExtensions.has(path.extname(name).toLowerCase()))
    .sort((a, b) => a.localeCompare(b, "en", { numeric: true, sensitivity: "base" }))
    .slice(0, 4);

  if (!files.length) {
    console.log(`${path.basename(resolvedFolder)}: no images found`);
    return;
  }

  for (let index = 0; index < files.length; index += 1) {
    const source = path.join(resolvedFolder, files[index]);
    const output = path.join(resolvedFolder, `${String(index + 1).padStart(2, "0")}.webp`);
    await sharp(source)
      .rotate()
      .resize({ width: 1200, height: 900, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82 })
      .toFile(output);
  }

  console.log(`${path.basename(resolvedFolder)}: created ${files.length} webp files`);
}

for (const folder of targetFolders) {
  // eslint-disable-next-line no-await-in-loop
  await convertFolder(folder);
}
