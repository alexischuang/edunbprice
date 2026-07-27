import { NextResponse } from "next/server";
import { readBlobJson, writeBlobJson } from "../../storage-json";

const HIDDEN_MODELS_BLOB = "education/hidden-models/models.json";
const HIDDEN_MODELS_FILE = "temp/hidden-models.json";
const DEFAULT_HIDDEN_MODELS = [
  "X1504VA-0281B120U",
  "X1504VA-0291C120U",
  "X1504VA-0611B100U",
];

function normalizeModels(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item).trim()).filter(Boolean);
}

export async function GET() {
  try {
    const stored = normalizeModels(await readBlobJson<unknown>(HIDDEN_MODELS_BLOB, HIDDEN_MODELS_FILE));
    const models = stored.length > 0 ? stored : DEFAULT_HIDDEN_MODELS;

    if (stored.length === 0) {
      await writeBlobJson(HIDDEN_MODELS_BLOB, HIDDEN_MODELS_FILE, models);
    }

    return NextResponse.json({ models });
  } catch {
    return NextResponse.json({ models: DEFAULT_HIDDEN_MODELS });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { models?: unknown };
    const models = normalizeModels(body.models);
    await writeBlobJson(HIDDEN_MODELS_BLOB, HIDDEN_MODELS_FILE, models);
    return NextResponse.json({ models });
  } catch {
    return NextResponse.json({ models: [] }, { status: 200 });
  }
}
