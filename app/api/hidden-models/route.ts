import { kv } from "@vercel/kv";
import { NextResponse } from "next/server";

const HIDDEN_MODELS_KEY = "education:hidden-models";

function normalizeModels(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item).trim()).filter(Boolean);
}

export async function GET() {
  try {
    const models = normalizeModels(await kv.get(HIDDEN_MODELS_KEY));
    return NextResponse.json({ models });
  } catch {
    return NextResponse.json({ models: [] });
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
