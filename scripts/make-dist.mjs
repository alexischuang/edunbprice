import fs from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const target = path.join(root, "dist");
const hostingConfig = path.join(root, ".openai", "hosting.json");
const drizzleSource = path.join(root, "drizzle");
const targetOpenAI = path.join(target, ".openai");
const targetDrizzle = path.join(targetOpenAI, "drizzle");

async function main() {
  await fs.mkdir(target, { recursive: true });
  await fs.rm(targetOpenAI, { recursive: true, force: true });
  await fs.mkdir(targetOpenAI, { recursive: true });

  try {
    await fs.cp(hostingConfig, path.join(targetOpenAI, "hosting.json"));
  } catch {
    // Ignore missing hosting metadata in local-only builds.
  }

  try {
    await fs.cp(drizzleSource, targetDrizzle, { recursive: true });
  } catch {
    // Ignore missing drizzle assets when they are not present.
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

