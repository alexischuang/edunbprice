import { kv } from "@vercel/kv";
import { NextResponse } from "next/server";

const HIDDEN_MODELS_KEY = "education:hidden-models";
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
    const stored = normalizeModels(await kv.get(HIDDEN_MODELS_KEY));
    const models = stored.length > 0 ? stored : DEFAULT_HIDDEN_MODELS;

    if (stored.length === 0) {
      await kv.set(HIDDEN_MODELS_KEY, models);
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
    await kv.set(HIDDEN_MODELS_KEY, models);
    return NextResponse.json({ models });
  } catch {
    return NextResponse.json({ models: [] }, { status: 200 });
  }
}
