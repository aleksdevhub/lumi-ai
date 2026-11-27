import {lookup} from './live.js';
import {answer, answerAudio} from './assistant.js';
import {PcRelay, matches} from './pc.js';
import {welcomeTelegram} from './bot.js';
export {PcRelay};
const encoder = new TextEncoder();
const recent = new Map();

function response(data, status, origin) {
  const headers = { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "Vary": "Origin" };
  if (origin) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Access-Control-Allow-Methods"] = "POST, GET, OPTIONS";
    headers["Access-Control-Allow-Headers"] = "Content-Type, X-Lumi-Pair";
    headers["Access-Control-Max-Age"] = "86400";
  }
  return new Response(JSON.stringify(data), { status, headers });
}

function hex(bytes) { return [...new Uint8Array(bytes)].map(x => x.toString(16).padStart(2, "0")).join(""); }
async function hmac(keyBytes, message) {
  const key = await crypto.subtle.importKey("raw", keyBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(message)));
}

async function telegramWebhookSecret(token) {
  return hex(await hmac(encoder.encode(token), "lumi-telegram-welcome-v1"));
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
    if (request.method === "OPTIONS") return allowed ? new Response(null, { status: 204, headers: { "Access-Control-Allow-Origin": allowed, "Access-Control-Allow-Methods": "POST, GET, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, X-Lumi-Pair", "Access-Control-Max-Age": "86400", "Vary": "Origin" } }) : new Response(null, { status: 403 });
    const url = new URL(request.url);
    if (request.method === 'POST' && url.pathname === '/telegram/start') {
      if (!env.TELEGRAM_BOT_TOKEN) return response({error: 'Bot unavailable'}, 503);
      const provided = request.headers.get('X-Telegram-Bot-Api-Secret-Token') || '';
      if (!/^[0-9a-f]{64}$/.test(provided)) return response({error: 'Unauthorized'}, 401);
      const expected = await telegramWebhookSecret(env.TELEGRAM_BOT_TOKEN);
      let mismatch = 0;
      for (let i = 0; i < expected.length; i++) mismatch |= expected.charCodeAt(i) ^ provided.charCodeAt(i);
      if (mismatch) return response({error: 'Unauthorized'}, 401);
      return welcomeTelegram(request, env.TELEGRAM_BOT_TOKEN);
    }
    if (request.method === 'GET' && url.pathname === '/news') {
      const items=await lookup('news','');
      return response({items},items.length?200:503,allowed);
    }
    if (request.method === "GET" && url.pathname === "/health") return response({
      ok: true, service: "lumi-ai-api", liveTools: ["search","news","weather"], voiceConversation: true,
    }, 200, allowed);
    if (url.pathname === '/pc/connect' && request.headers.get('Upgrade')?.toLowerCase() === 'websocket') {
      if (!await matches(request.headers.get('Sec-WebSocket-Protocol')?.split(',')[1]?.trim(), env.PC_HASH))
        return response({error:'Unauthorized'},401);
      const relay=env.PC_RELAY.get(env.PC_RELAY.idFromName('home'));
      return relay.fetch('https://relay/connect',{headers:{Upgrade:'websocket'}});
    }
    if (url.pathname === '/pc/status' && request.method === 'POST') {
      if (!await matches(request.headers.get('X-Lumi-Pair'),env.PAIR_HASH)) return response({error:'Unauthorized'},403);
      const relay=env.PC_RELAY.get(env.PC_RELAY.idFromName('home'));
      const result=await relay.fetch('https://relay/sync',{method:'POST',body:JSON.stringify({user:'0',after:0,items:[]})});
      return response({databaseReady:result.ok},result.status);
    }
    if (!allowed) return response({ error: "Origin not allowed" }, 403);
    if (request.method === 'POST' && url.pathname === '/speak') {
      if (!env.GEMINI_API_KEY || !env.TELEGRAM_BOT_TOKEN) return response({error: 'Озвучка недоступна.'}, 503, allowed);
      if (Number(request.headers.get('Content-Length')) > 12000) return response({error: 'Запрос слишком большой.'}, 413, allowed);
      let body;
      try {
        const raw = await request.text();
        if (encoder.encode(raw).byteLength > 12000) return response({error: 'Запрос слишком большой.'}, 413, allowed);
        body = JSON.parse(raw);
      } catch { return response({error: 'Некорректный запрос.'}, 400, allowed); }
      const user = typeof body?.initData === 'string' ? await verifyTelegram(body.initData, env.TELEGRAM_BOT_TOKEN) : null;
      if (!user?.id) return response({error: 'Открой LUMI через Telegram.'}, 401, allowed);
      const text = typeof body.text === 'string' ? body.text.trim() : '';
      if (!text || text.length > 480 || !['female', 'male'].includes(body.voice)) {
        return response({error: 'Некорректный текст для озвучки.'}, 400, allowed);
      }
      const now = Date.now();
      const key = 'tts:' + user.id;
      const usage = (recent.get(key) || []).filter(at => now - at < 60000);
      if (usage.length >= 4) return response({error: 'Озвучка временно ограничена.'}, 429, allowed);
      recent.set(key, [...usage, now]);
      try {
        const upstream = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
          method: 'POST',
          headers: {'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY},
          signal: AbortSignal.timeout(20000),
          body: JSON.stringify({
            model: 'gemini-3.8-flash-lite-tts',
            store: false,
            input: [{type: 'user_input', content: [{
              type: 'text', text,
              annotations: [{type: 'speech_metadata', style: 'warm, conversational and relaxed'}],
            }]}],
            response_format: {type: 'audio'},
            generation_config: {speech_config: [{voice: body.voice === 'male' ? 'Puck' : 'Aoede'}]},
          }),
        });
        if (!upstream.ok) return response({error: 'Нейроголос временно недоступен.'}, upstream.status === 429 ? 429 : 502, allowed);
        const data = await upstream.json();
        const audio = data.steps?.flatMap(step => step.content || []).findLast(part => part.type === 'audio');
        if (typeof audio?.data !== 'string' || !audio.data.startsWith('UklGR') || audio.data.length > 4500000) {
          return response({error: 'Не удалось получить озвучку.'}, 502, allowed);
        }
        const bytes = Uint8Array.from(atob(audio.data), char => char.charCodeAt(0));
        return new Response(bytes, {headers: {'Content-Type': 'audio/wav', 'Access-Control-Allow-Origin': allowed, 'Cache-Control': 'no-store', Vary: 'Origin'}});
      } catch {
        return response({error: 'Не удалось подготовить озвучку.'}, 502, allowed);
      }
    }
    if (request.method === 'POST' && url.pathname === '/dialogs/sync') {
      if (!await matches(request.headers.get('X-Lumi-Pair'),env.PAIR_HASH)) return response({error:'Проверь код подключения.'},403,allowed);
      if (Number(request.headers.get('Content-Length')) > 180000) return response({error:'Пакет слишком большой'},413,allowed);
      const raw=await request.text();
      if(raw.length>180000) return response({error:'Пакет слишком большой'},413,allowed);
      let body;
      try {body=JSON.parse(raw);} catch {return response({error:'Некорректный запрос'},400,allowed);}
      const user=await verifyTelegram(body?.initData,env.TELEGRAM_BOT_TOKEN);
      if(!user?.id) return response({error:'Открой LUMI через Telegram.'},401,allowed);
      const items=body.items;
      const uuid=/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
      if(!Array.isArray(items)||items.length>50||!Number.isSafeInteger(body.after)||body.after<0||
        items.some(m=>!m||!uuid.test(m.dialog)||!uuid.test(m.id)||!['user','assistant'].includes(m.role)||
          typeof m.text!=='string'||m.text.length>20000||!Number.isSafeInteger(m.at)||
          (m.thumb!=null && (typeof m.thumb!=='string'||m.thumb.length>100000||!m.thumb.startsWith('data:image/jpeg;base64,')))))
        return response({error:'Некорректные данные диалога'},400,allowed);
      const relay=env.PC_RELAY.get(env.PC_RELAY.idFromName('home'));
      const result=await relay.fetch('https://relay/sync',{method:'POST',body:JSON.stringify({user:String(user.id),after:body.after,items})});
      return response(await result.json(),result.status,allowed);
    }
    if (request.method === "POST" && url.pathname === "/transcribe") {
      const length = Number(request.headers.get("Content-Length") || 0);
      if (length > 1000000) return response({ error: "Запись слишком длинная. Попробуй ещё раз короче." }, 413, allowed);
      if (!env.GEMINI_API_KEY || !env.TELEGRAM_BOT_TOKEN) return response({ error: "Backend secrets are not configured" }, 503, allowed);
      let body;
      try {
        const raw = await request.text();
        if (encoder.encode(raw).byteLength > 1000000) return response({ error: "Запись слишком длинная. Попробуй ещё раз короче." }, 413, allowed);
        body = JSON.parse(raw);
      } catch { return response({ error: "Не удалось прочитать запись." }, 400, allowed); }
      const user = typeof body?.initData === 'string' ? await verifyTelegram(body.initData, env.TELEGRAM_BOT_TOKEN) : null;
      if (!user?.id) return response({ error: "Открой LUMI через Telegram и разреши доступ к микрофону." }, 401, allowed);
      const now = Date.now();
      const key = String(user.id);
      const times = (recent.get(key) || []).filter(t => now - t < 60000);
      if (times.length >= 12) return response({ error: "Слишком много запросов. Подожди минуту." }, 429, allowed);
      times.push(now); recent.set(key, times);
      const supportedTypes = new Set(["audio/webm", "audio/ogg", "audio/mp4", "audio/m4a", "audio/wav", "audio/aac", "audio/mpeg"]);
      const mimeType = String(body.mimeType || "").split(";")[0].toLowerCase();
      const audio = body.audioBase64;
      if (!supportedTypes.has(mimeType) || typeof audio !== "string" || audio.length < 16 || audio.length > 900000 || !/^[A-Za-z0-9+/]+={0,2}$/.test(audio)) {
        return response({ error: "Не получилось обработать запись. Попробуй записать ещё раз." }, 400, allowed);
      }
      const geminiMimeType = mimeType === "audio/mp4" ? "audio/m4a" : mimeType;
      if (body.conversation === true) {
        const history = Array.isArray(body.history) ? body.history.slice(-8)
          .filter(item => ['user', 'assistant'].includes(item?.role) && typeof item.text === 'string' && item.text.trim())
          .map(item => ({role: item.role === 'assistant' ? 'model' : 'user', parts: [{text: item.text.slice(0, 1200)}]})) : [];
        const preferences = typeof body.preferences === 'string' ? body.preferences.trim().slice(0, 500) : '';
        try {
          const turn = await answerAudio(env, history, audio, geminiMimeType, preferences, body.model);
          if (!turn.transcript) return response({error: 'Речь не распознана. Попробуй ещё раз.'}, 422, allowed);
          return response(turn, 200, allowed);
        } catch (error) {
          const limited = error.status === 429;
          return response({error: limited ? 'Достигнут лимит модели. Попробуй позже.' : 'Не удалось обработать голосовой вопрос. Попробуй ещё раз.'}, limited ? 429 : 502, allowed);
        }
      }
      const model = /^[a-zA-Z0-9._-]+$/.test(env.GEMINI_MODEL || "") ? env.GEMINI_MODEL : "gemini-3.5-flash-lite";
      try {
        const upstream = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": env.GEMINI_API_KEY },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [
              { text: "Точно расшифруй речь из этой короткой голосовой записи. Верни только распознанные слова без пояснений и кавычек. Сохрани язык оригинала." },
              { inlineData: { mimeType: geminiMimeType, data: audio } }
            ] }],
            generationConfig: { maxOutputTokens: 300, temperature: 0 }
          })
        });
        if (!upstream.ok) {
          const err = await upstream.json().catch(() => ({}));
          console.error("Gemini transcription error", upstream.status, err?.error?.status || "unknown");
          return response({ error: upstream.status === 429 ? "Достигнут бесплатный лимит распознавания. Попробуй позже." : "Не удалось распознать запись. Попробуй ещё раз." }, upstream.status === 429 ? 429 : 502, allowed);
        }
        const data = await upstream.json();
        const transcript = (data.candidates?.[0]?.content?.parts || []).map(p => p.text || "").join("").trim();
        if (!transcript) return response({ error: "Речь не распознана. Попробуй сказать ещё раз чуть ближе к микрофону." }, 422, allowed);
        return response({ transcript }, 200, allowed);
      } catch (error) {
        console.error("Gemini transcription connection error", error?.name || "unknown");
        return response({ error: "Не удалось связаться с сервисом распознавания." }, 502, allowed);
      }
    }
    const photoRequest = url.pathname === "/chat/photo";
    if (request.method !== "POST" || (!photoRequest && url.pathname !== "/chat")) return response({ error: "Not found" }, 404, allowed);
    const maxBody = photoRequest ? 1650000 : 24000;
    const length = Number(request.headers.get("Content-Length") || 0);
    if (length > maxBody) return response({ error: "Слишком большой запрос" }, 413, allowed);
    if (!env.GEMINI_API_KEY || !env.TELEGRAM_BOT_TOKEN) return response({ error: "Backend secrets are not configured" }, 503, allowed);
    let body;
    try {
      const reader = request.body.getReader();
      const decoder = new TextDecoder();
      let size = 0, raw = "";
      while (true) {
        const {done, value} = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > maxBody) {
          await reader.cancel();
          return response({ error: "Слишком большой запрос" }, 413, allowed);
        }
        raw += decoder.decode(value, {stream: true});
      }
      body = JSON.parse(raw + decoder.decode());
      if (!body || typeof body !== "object") throw Error();
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
    if (photoRequest) {
      const photo = body.photo;
      const last = messages.at(-1);
      if (typeof photo !== "string" || photo.length > 1500000 || photo.length < 16 ||
          photo.length % 4 !== 0 || !photo.startsWith("/9j/") || !/^[A-Za-z0-9+/]+={0,2}$/.test(photo)) {
        return response({ error: "Не удалось прочитать фото. Выбери его ещё раз." }, 400, allowed);
      }
      if (last?.role !== "user" || typeof last.text !== "string" || !last.text.trim() || last.text.length > 4000) {
        return response({ error: "Некорректная подпись к фото" }, 400, allowed);
      }
    }
    const contents = [];
    for (const item of messages) {
      if (!item || !["user", "assistant"].includes(item.role) || typeof item.text !== "string" || !item.text.trim() || item.text.length > 4000) continue;
      contents.push({ role: item.role === "assistant" ? "model" : "user", parts: [{ text: item.text.trim() }] });
    }
    if (!contents.length || contents.at(-1).role !== "user") return response({ error: "Send a message to begin" }, 400, allowed);
    if (photoRequest) contents.at(-1).parts.push({ inlineData: { mimeType: "image/jpeg", data: body.photo } });
    try {
      const preferences = typeof body.preferences === 'string' ? body.preferences.trim().slice(0,500) : '';
      return response(await answer(env,contents,preferences,body.memory,body.model),200,allowed);
    } catch (error) {
      return response({error:error.status===429?'Достигнут лимит модели. Попробуй позже.':'Не удалось получить ответ от модели. Попробуй позже.'},error.status===429?429:502,allowed);
    }
  }
};
