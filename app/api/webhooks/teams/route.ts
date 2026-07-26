import { NextResponse } from "next/server";
import { buildTeamsReply, bot } from "../../teams/bot";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return bot.webhooks.teams(request);
}

export async function GET() {
  const reply = await buildTeamsReply("");
  return NextResponse.json({
    ok: true,
    message: "Teams webhook endpoint is ready.",
    sample: reply,
  });
}
