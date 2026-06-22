import { cp, rm } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(process.cwd());
const source = resolve(root, "out");
const target = resolve(root, "dist");

await rm(target, { force: true, recursive: true });
await cp(source, target, { recursive: true });
