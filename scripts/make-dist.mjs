import fs from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const source = path.join(root, "out");
const target = path.join(root, "dist");

async function main() {
  await fs.rm(target, { recursive: true, force: true });
  await fs.mkdir(target, { recursive: true });
  await fs.cp(source, target, { recursive: true });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

