import { NextResponse } from "next/server";
import type { SlackEventEnvelope } from "../_bot";
import { buildSlackReply, postSlackMessage, verifySlackRequest } from "../_bot";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const retryNum = request.headers.get("x-slack-retry-num");
  if (retryNum) {
    return NextResponse.json({ ok: true, ignored: "retry" });
  }

  const rawBody = await request.text();
  const timestamp = request.headers.get("x-slack-request-timestamp");
  const signature = request.headers.get("x-slack-signature");

  if (!verifySlackRequest(rawBody, timestamp, signature)) {
    return NextResponse.json({ ok: false, error: "invalid signature" }, { status: 401 });
  }

  const payload = JSON.parse(rawBody) as SlackEventEnvelope;

  if (payload.type === "url_verification" && payload.challenge) {
    return NextResponse.json({ challenge: payload.challenge });
  }

  if (payload.type !== "event_callback") {
    return NextResponse.json({ ok: true });
  }

  const event = payload.event;
  if (!event) {
    return NextResponse.json({ ok: true });
  }

  if (event.subtype || event.bot_id) {
    return NextResponse.json({ ok: true });
  }

  const isDirectMessage = event.type === "message" && event.channel_type === "im";
  const isMention = event.type === "app_mention";
  if (!isDirectMessage && !isMention) {
    return NextResponse.json({ ok: true });
  }

  const reply = await buildSlackReply(event.text ?? "");
  await postSlackMessage(event.channel ?? "", reply.text, reply.blocks, event.thread_ts ?? event.ts);

  return NextResponse.json({ ok: true });
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    message: "Slack Events endpoint is ready.",
  });
}
