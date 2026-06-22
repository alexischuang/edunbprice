import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

type CloudflareEnv = {
  DB?: D1Database;
};

export function getDb(env?: CloudflareEnv) {
  const runtimeEnv =
    env ?? ((globalThis as typeof globalThis & { env?: CloudflareEnv }).env ?? undefined);

  if (!runtimeEnv?.DB) {
    throw new Error(
      "Cloudflare D1 binding `DB` is unavailable. Set the `d1` field in .openai/hosting.json to `DB` or pass the runtime env before using the database."
    );
  }

  return drizzle(runtimeEnv.DB, { schema });
}

