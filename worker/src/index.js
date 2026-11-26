const encoder = new TextEncoder();
const recent = new Map();

function response(data, status, origin) {
  const headers = { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "Vary": "Origin" };
  if (origin) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Access-Control-Allow-Methods"] = "POST, GET, OPTIONS";
    headers["Access-Control-Allow-Headers"] = "Content-Type";
    headers["Access-Control-Max-Age"] = "86400";
  }
  return new Response(JSON.stringify(data), { status, headers });
}

function hex(bytes) { return [...new Uint8Array(bytes)].map(x => x.toString(16).padStart(2, "0")).join(""); }
async function hmac(keyBytes, message) {
  const key = await crypto.subtle.importKey("raw", keyBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(message)));
}

async function verifyTelegram(initData, botToken) {
  if (!initData || !botToken || initData.length > 8192) return null;
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  const authDate = Number(params.get("auth_date"));
  const nowSeconds = Date.now() / 1000;
  if (!hash || !Number.isFinite(authDate) || authDate > nowSeconds + 60 || nowSeconds - authDate > 86400) return null;
  const check = [...params.entries()].filter(([key]) => key !== "hash").sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => `${key}=${value}`).join("\n");
  const secret = await hmac(encoder.encode("WebAppData"), botToken);
  const actual = hex(await hmac(secret, check));
  if (actual.length !== hash.length) return null;
  let mismatch = 0;
  for (let i = 0; i < actual.length; i++) mismatch |= actual.charCodeAt(i) ^ hash.charCodeAt(i);
  if (mismatch) return null;
  try { return JSON.parse(params.get("user") || "{}"); } catch { return null; }
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const allowed = origin === env.ALLOWED_ORIGIN ? origin : "";
    if (request.method === "OPTIONS") return allowed ? new Response(null, { status: 204, headers: { "Access-Control-Allow-Origin": allowed, "Access-Control-Allow-Methods": "POST, GET, OPTIONS", "Access-Control-Allow-Headers": "Content-Type", "Access-Control-Max-Age": "86400", "Vary": "Origin" } }) : new Response(null, { status: 403 });
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/health") return response({ ok: true, service: "lumi-ai-api" }, 200, allowed);
    if (!allowed) return response({ error: "Origin not allowed" }, 403);
    if (request.method !== "POST" || url.pathname !== "/chat") return response({ error: "Not found" }, 404, allowed);
    const length = Number(request.headers.get("Content-Length") || 0);
    if (length > 24000) return response({ error: "Message is too large" }, 413, allowed);
    if (!env.GEMINI_API_KEY || !env.TELEGRAM_BOT_TOKEN) return response({ error: "Backend secrets are not configured" }, 503, allowed);
    let body;
    try {
      const raw = await request.text();
      if (encoder.encode(raw).byteLength > 24000) return response({ error: "Message is too large" }, 413, allowed);
      body = JSON.parse(raw);
    } catch { return response({ error: "Invalid JSON" }, 400, allowed); }
    const user = await verifyTelegram(body.initData, env.TELEGRAM_BOT_TOKEN);
    if (!user?.id) return response({ error: "Open LUMI from Telegram to chat" }, 401, allowed);
    const now = Date.now();
    const key = String(user.id);
    const times = (recent.get(key) || []).filter(t => now - t < 60000);
    if (times.length >= 12) return response({ error: "Too many messages. Please wait a minute." }, 429, allowed);
    times.push(now); recent.set(key, times);
    if (recent.size > 10000) for (const [id, list] of recent) if (!list.some(t => now - t < 60000)) recent.delete(id);
    const messages = Array.isArray(body.messages) ? body.messages.slice(-16) : [];
    const contents = [];
    for (const item of messages) {
      if (!item || !["user", "assistant"].includes(item.role) || typeof item.text !== "string" || !item.text.trim() || item.text.length > 4000) continue;
      contents.push({ role: item.role === "assistant" ? "model" : "user", parts: [{ text: item.text.trim() }] });
    }
    if (!contents.length || contents.at(-1).role !== "user") return response({ error: "Send a message to begin" }, 400, allowed);
    const model = /^[a-zA-Z0-9._-]+$/.test(env.GEMINI_MODEL || "") ? env.GEMINI_MODEL : "gemini-3.5-flash-lite";
    try {
      const upstream = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": env.GEMINI_API_KEY },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: "You are LUMI, a helpful personal assistant. Reply in the user's language, clearly and warmly. Do not claim to have capabilities or information you do not have. Do not ask for secrets or sensitive personal information." }] },
          contents,
          generationConfig: { maxOutputTokens: 700, temperature: 0.7 }
        })
      });
      if (!upstream.ok) {
        const err = await upstream.json().catch(() => ({}));
        console.error("Gemini API error", upstream.status, err?.error?.status || "unknown");
        return response({ error: upstream.status === 429 ? "Free model limit reached. Try again later." : "The model is temporarily unavailable." }, upstream.status === 429 ? 429 : 502, allowed);
      }
      const data = await upstream.json();
      const text = (data.candidates?.[0]?.content?.parts || []).map(p => p.text || "").join("").trim();
      if (!text) return response({ error: "The model returned an empty response." }, 502, allowed);
      return response({ reply: text }, 200, allowed);
    } catch (error) {
      console.error("Gemini connection error", error?.name || "unknown");
      return response({ error: "Could not reach the model. Try again later." }, 502, allowed);
    }
  }
};
