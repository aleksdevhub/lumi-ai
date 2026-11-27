import {appUrl, callTelegram, openLumiButton} from './telegram.js';

const welcome = 'Привет! Я Lumi. Помогу разобраться в вопросе, разобрать фото или составить план.\n\nМогу напомнить о деле в этом чате и, если включишь, присылать ежедневную сводку.';

function actionFor(message, callback) {
  if (callback) {
    const value = typeof callback.data === 'string' ? callback.data : '';
    if (value === 'lumi:menu') return {action:'menu'};
    if (value === 'lumi:daily:off') return {action:'off'};
    const time = {'lumi:daily:480':'08:00','lumi:daily:540':'09:00','lumi:daily:1140':'19:00'}[value];
    if (time) return {action:'daily',value:time};
    const cancel = value.match(/^lumi:cancel:(\d{1,16})$/);
    return cancel ? {action:'cancel',value:cancel[1]} : null;
  }

  const text = message?.text?.trim();
  if (!text) return null;
  const command = text.match(/^\/([\p{L}_]+)(?:@LumiPersonalAI_bot)?(?:\s+([\s\S]*))?$/iu);
  if (command) {
    const [, verb, raw = ''] = command;
    const value = raw.trim();
    switch (verb.toLowerCase()) {
      case 'start': return {action:value === 'daily' ? 'menu' : 'welcome'};
      case 'daily':
      case 'сводка':
        return !value ? {action:'menu'} : /^(?:off|выкл|выключить)$/iu.test(value) ? {action:'off'} : {action:'daily',value};
      case 'timezone':
      case 'часовойпояс': return {action:'timezone',value};
      case 'remind':
      case 'напомни': return {action:'remind',value};
      case 'cancel':
      case 'отмена': return /^\d{1,16}$/.test(value) ? {action:'cancel',value} : {action:'menu'};
      default: return null;
    }
  }
  const reminder = text.match(/^(?:луми[, ]+)?напомни(?:\s+мне)?(?:\s+([\s\S]*))?$/iu);
  return reminder ? {action:'remind',value:reminder[1] || ''} : null;
}

export async function handleTelegram(request, env) {
  let update;
  try { update = await request.json(); } catch { return new Response(null, {status: 400}); }
  const {message, callback_query: callback, update_id: updateId} = update ?? {};
  const chat = callback ? callback.message?.chat : message?.chat;
  if (chat?.type !== 'private' || !Number.isSafeInteger(chat.id) || !Number.isSafeInteger(updateId)) return new Response(null,{status:204});
  if (callback && callback.from?.id !== chat.id) return new Response(null,{status:204});
  const command = actionFor(message, callback);
  if (!command) return new Response(null,{status:204});
  const token = env.TELEGRAM_BOT_TOKEN;

  try {
    if (command.action === 'welcome') return await welcomeTelegram(token, chat.id, Boolean(env.REMINDERS));
    if (!env.REMINDERS) return new Response(null,{status:503});
    const schedule = env.REMINDERS.get(env.REMINDERS.idFromName(String(chat.id)));
    const result = await schedule.fetch('https://schedule/update', {
      method:'POST', body:JSON.stringify({chatId:chat.id, updateId, ...command}),
    });
    if (!result.ok) return new Response(null,{status:502});
    const {notice, ...content} = await result.json();
    if (callback) {
      await callTelegram(token, 'answerCallbackQuery', {callback_query_id:callback.id, ...(notice && {text:notice})});
      const edited = await callTelegram(token, 'editMessageText', {...content, chat_id:chat.id, message_id:callback.message.message_id});
      // Buttons below the welcome photo change its caption via a new settings message.
      if (edited.ok || /message is not modified/i.test(edited.description || '')) return new Response(null,{status:204});
    }
    const sent = await callTelegram(token, 'sendMessage', {...content, chat_id:chat.id, text:notice && !callback ? notice+'\n\n'+content.text : content.text});
    if (sent.ok || sent.error_code === 403) return new Response(null,{status:204});
  } catch { /* A failed delivery can be retried by Telegram. */ }
  return new Response(null, {status: 502});
}

async function welcomeTelegram(token, chatId, reminders) {
  const payload = {
    chat_id:chatId,
    reply_markup:{inline_keyboard:[[openLumiButton()], ...(reminders ? [[{text:'Сводка и напоминания', callback_data:'lumi:menu'}]] : [])]},
  };
  const photo = await callTelegram(token,'sendPhoto',{...payload,photo:appUrl+'assets/welcome.png',caption:welcome});
  if (photo.ok || photo.error_code === 403) return new Response(null,{status:204});
  if (photo.error_code === 400) {
    const sent = await callTelegram(token,'sendMessage',{...payload,text:welcome});
    if (sent.ok || sent.error_code === 403) return new Response(null,{status:204});
  }
  return new Response(null,{status:502});
}
