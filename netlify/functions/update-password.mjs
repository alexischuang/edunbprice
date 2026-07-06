import { handler as updateHandler } from "./update.mjs";

const UPDATE_PASSWORD = process.env.UPDATE_PASSWORD || "Cavesbooks";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Update-Password",
  "Content-Type": "application/json; charset=utf-8",
};

function json(statusCode, payload) {
  return {
    statusCode,
    headers: corsHeaders,
    body: JSON.stringify(payload),
  };
}

function getHeader(event, name) {
  const headers = event?.headers || {};
  const target = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === target) return String(value ?? "");
  }
  return "";
}

export async function handler(event, context = {}) {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: corsHeaders, body: "" };
  }

  const password = getHeader(event, "x-update-password").trim();
  if (!password) {
    return json(400, { ok: false, error: "請先輸入後台密碼。" });
  }
  if (password !== UPDATE_PASSWORD) {
    return json(400, { ok: false, error: "後台密碼不正確。" });
  }

  return updateHandler(event, {
    ...context,
    clientContext: {
      ...(context.clientContext || {}),
      user: { email: "password-admin@cavesbooks.com.tw" },
    },
  });
}
