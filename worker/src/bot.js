const APP_URL = 'https://aleksdevhub.github.io/lumi-ai/';
const WELCOME = 'Привет! Я Lumi, твой помощник. Могу объяснить сложное, помочь с текстом, разобрать фото и составить план. Открой LUMI, чтобы начать.';

async function callTelegram(token, method, payload = {}) {
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(payload),
  });
  return response.json();
}

export async function welcomeTelegram(request, token) {
  let update;
  try { update = await request.json(); } catch { return new Response(null, {status: 400}); }
  const {message} = update ?? {};
  if (message?.chat?.type !== 'private' || !Number.isSafeInteger(message.chat.id) ||
      typeof message.text !== 'string' || !/^\/start(?:@LumiPersonalAI_bot)?(?:\s|$)/i.test(message.text)) {
    return new Response(null, {status: 204});
  }
  const payload = {
    chat_id: message.chat.id,
    reply_markup: {inline_keyboard: [[{text: 'Открыть LUMI', web_app: {url: APP_URL}}]]},
  };
  try {
    const photo = await callTelegram(token, 'sendPhoto', {
      ...payload, photo: APP_URL + 'assets/welcome.png', caption: WELCOME,
    });
    if (photo.ok) return new Response(null, {status: 204});
    // The launch button is still available if Telegram cannot download the banner.
    if (photo.error_code === 400) {
      const fallback = await callTelegram(token, 'sendMessage', {...payload, text: WELCOME});
      if (fallback.ok) return new Response(null, {status: 204});
    }
  } catch { /* A failed delivery can be retried by Telegram. */ }
  return new Response(null, {status: 502});
}
