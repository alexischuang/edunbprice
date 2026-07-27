import fs from "node:fs/promises";
import path from "node:path";
import { get, put } from "@vercel/blob";

function hasBlobConfig() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

async function readLocalJson<T>(filePath: string): Promise<T | null> {
  try {
    const text = await fs.readFile(filePath, "utf8");
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

async function writeLocalJson<T>(filePath: string, value: T) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(value, null, 2), "utf8");
}

export async function readBlobJson<T>(blobPathname: string, localFilePath: string): Promise<T | null> {
  if (hasBlobConfig()) {
    try {
      const result = await get(blobPathname, { access: "private", useCache: false });
      if (result?.stream) {
        const text = await new Response(result.stream).text();
        return JSON.parse(text) as T;
      }
    } catch {
      // Fall back to the local file cache during development or if Blob is temporarily unavailable.
    }
  }

  if (process.env.NODE_ENV !== "production") {
    return readLocalJson<T>(localFilePath);
  }

  return null;
}

export async function writeBlobJson<T>(blobPathname: string, localFilePath: string, value: T) {
  if (hasBlobConfig()) {
    try {
      await put(blobPathname, JSON.stringify(value, null, 2), {
        access: "private",
        allowOverwrite: true,
        cacheControlMaxAge: 60,
      });
      return;
    } catch {
      // Fall back to the local file cache during development or if Blob is temporarily unavailable.
    }
  }

  if (process.env.NODE_ENV !== "production") {
    await writeLocalJson(localFilePath, value);
    return;
  }

  throw new Error("Vercel Blob 尚未連線，無法儲存更新。");
}
