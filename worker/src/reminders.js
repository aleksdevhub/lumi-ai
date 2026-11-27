import {callTelegram, openLumiButton} from './telegram.js';
import {lookup, worldNews} from './live.js';
import {communicationStyles, dailyTopicLimit, defaultDailyTopic, normalizeDailyTopics, normalizePersonality} from '../../assistant-settings.mjs';

const minute = 60000;
const day = 24 * 60 * minute;
const maxReminders = 10;

export function clockTime(value) {
  const match = typeof value === 'string' && value.match(/^(\d{1,2}):(\d{2})$/);
  if (!match || Number(match[1]) > 23 || Number(match[2]) > 59) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

export function offsetMinutes(value) {
  const match = typeof value === 'string' && value.match(/^([+-])(\d{1,2})(?::(00|15|30|45))?$/);
  if (!match) return null;
  const result = (Number(match[2]) * 60 + Number(match[3] || 0)) * (match[1] === '-' ? -1 : 1);
  return result >= -12 * 60 && result <= 14 * 60 ? result : null;
}

function todayAt(now, minutes, offset) {
  return Math.floor((now + offset * minute) / day) * day + (minutes - offset) * minute;
}

function nextAt(now, minutes, offset) {
  const at = todayAt(now, minutes, offset);
  return at > now ? at : at + day;
}

const clockLabel = minutes => [Math.floor(minutes / 60), minutes % 60].map(value => String(value).padStart(2, '0')).join(':');
const offsetLabel = offset => (offset < 0 ? '-' : '+') + clockLabel(Math.abs(offset));

function dailySettings(state) {
  const customization = normalizePersonality(state.dailyOptions);
  return {
    enabled: Boolean(state.daily),
    time: clockLabel(state.daily?.time ?? state.dailyOptions?.time ?? 540),
    offset: offsetLabel(state.offset),
    topics: normalizeDailyTopics(state.dailyOptions?.topics ?? [defaultDailyTopic]),
    style: customization.style,
    emoji: customization.emoji,
  };
}

function reminderTime(input, now, offset) {
  const relative = input.match(/^через\s+(\d{1,5})\s+(минут\p{L}*|час\p{L}*)\s+([\s\S]+)$/iu);
  if (relative) {
    const duration = Number(relative[1]) * (/час/iu.test(relative[2]) ? 60 : 1);
    if (duration < 1 || duration > 30 * 24 * 60) return null;
    return {at: now + duration * minute, text: relative[3].trim()};
  }
  const absolute = input.match(/^(?:(сегодня|завтра)\s+)?(?:в\s+)?(\d{1,2})(?::(\d{2})|\s+(утра|дня|вечера|ночи))?\s+([\s\S]+)$/iu);
  if (!absolute) return null;
  let hour = Number(absolute[2]);
  const period = absolute[4]?.toLowerCase();
  if (period) {
    if (hour < 1 || hour > 12) return null;
    hour = hour % 12 + (period === 'дня' || period === 'вечера' ? 12 : 0);
  }
  const time = clockTime(hour + ':' + (absolute[3] || '00'));
  if (time === null) return null;
  const date = absolute[1]?.toLowerCase();
  const at = date === 'завтра' ? todayAt(now, time, offset) + day
    : date === 'сегодня' ? todayAt(now, time, offset) : nextAt(now, time, offset);
  return at > now ? {at, text: absolute[5].trim()} : null;
}

function when(at, offset) {
  const date = new Date(at + offset * minute);
  return date.toLocaleString('ru-RU', {day:'numeric',month:'short',hour:'2-digit',minute:'2-digit',timeZone:'UTC'}) + ' (UTC' + offsetLabel(offset) + ')';
}

function screen(state) {
  const status = state.daily ? 'Сводка включена на ' + clockLabel(state.daily.time) + '.' : 'Ежедневная сводка выключена.';
  const reminders = state.reminders.map(job => [{text: 'Отменить: ' + job.text.slice(0, 32), callback_data: 'lumi:cancel:' + job.id}]);
  return {
    text: status + '\nЧасовой пояс: UTC' + offsetLabel(state.offset) + '.\n\n' +
      'Выбери время для сводки с короткой подборкой новостей. Для напоминания напиши, например: «Напомни завтра в 09:00 проверить почту» или «Напомни через 10 минут проверить почту».' +
      '\n\nДругое время сводки: /daily 08:30. Часовой пояс: /timezone +03:00.' +
      (state.reminders.length ? '\n\nТвои напоминания:\n' + state.reminders.map(job => '• ' + when(job.at,state.offset) + ' — ' + job.text + '\nОтмена: /cancel ' + job.id).join('\n') : ''),
    reply_markup: {inline_keyboard: [
      [480, 540, 1140].map(time => ({text: clockLabel(time), callback_data: 'lumi:daily:' + time})),
      ...(state.daily ? [[{text: 'Выключить сводку', callback_data: 'lumi:daily:off'}]] : []),
      ...reminders,
      [openLumiButton()],
    ]},
  };
}

function html(value) {
  return value.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
}

async function jobMessage(job, state) {
  if (job.text) return {text: '🔔 Напоминание от LUMI\n\n' + job.text};
  const {topics, style, emoji} = dailySettings(state);
  const groups = await Promise.all(topics.map(async topic => ({
    topic,
    items: topic.toLocaleLowerCase('ru') === defaultDailyTopic.toLocaleLowerCase('ru')
      ? (await worldNews(offsetLabel(state.offset))).items : await lookup('news', topic),
  })));
  const seen = new Set();
  const sections = groups.map(({topic, items}) => {
    const headlines = [];
    for (const item of items) {
      if (seen.has(item.url)) continue;
      seen.add(item.url);
      const date = new Date(Date.parse(item.date) + state.offset * minute).toLocaleDateString('ru-RU', {timeZone:'UTC'});
      headlines.push('• <a href="' + html(item.url) + '">' + html(item.title) + '</a>' + (style === 'concise' ? '' : ' · ' + date));
      if (headlines.length >= (topics.length === 1 ? 3 : 2)) break;
    }
    return '<b>' + html(topic) + '</b>\n' + (headlines.join('\n') || 'Свежих публикаций пока нет.');
  });
  const title = style === 'professional' ? 'Ежедневный обзор LUMI' : style === 'friendly' ? 'Привет! Вот что нашла LUMI' : 'Сводка LUMI';
  return {
    text:(emoji ? html(emoji) + ' ' : style === 'friendly' || style === 'neutral' ? '☀️ ' : '') + title + '\n\n' +
      (sections.join('\n\n') || 'Свежих публикаций пока нет.'),
    parse_mode:'HTML',
  };
}

/** Private Durable Object binding, one schedule per Telegram chat. */
export class LumiReminders {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
  }

  async save(state) {
    const next = Math.min(state.daily?.at ?? Infinity, ...state.reminders.map(job => job.at));
    await this.ctx.storage.put('state', state);
    if (Number.isFinite(next)) await this.ctx.storage.setAlarm(Math.max(next, Date.now() + 50));
    else await this.ctx.storage.deleteAlarm();
  }

  async fetch(request) {
    const {chatId, updateId, action, value} = await request.json();
    return this.ctx.blockConcurrencyWhile(async () => {
      const state = await this.ctx.storage.get('state') || {chatId, offset:180, daily:null, reminders:[], recent:[]};
      if (action === 'settings') {
        if (value === undefined) return Response.json(dailySettings(state));
        const time = clockTime(value?.time);
        const offset = offsetMinutes(value?.offset);
        const topics = normalizeDailyTopics(value?.topics);
        if (typeof value?.enabled !== 'boolean' || time === null || offset === null || !Array.isArray(value.topics) ||
            value.topics.length > dailyTopicLimit || typeof value.style !== 'string' || !Object.hasOwn(communicationStyles, value.style)) {
          return Response.json({error:'Проверь время, часовой пояс и параметры сводки.'},{status:422});
        }
        if (value.enabled && !topics.length) return Response.json({error:'Добавь хотя бы одну тему, чтобы включить сводку.'},{status:422});
        const {style, emoji} = normalizePersonality(value);
        const current = state.daily;
        state.offset = offset;
        state.dailyOptions = {time, topics, style, emoji};
        state.daily = value.enabled ? {time, at: nextAt(Date.now(), time, offset)} : null;
        if (current?.at === state.daily?.at && current?.time === state.daily?.time) state.daily = current ?? null;
        await this.save(state);
        return Response.json(dailySettings(state));
      }
      if (action === 'menu') return Response.json(screen(state));
      const previous = state.recent.find(item => item.id === updateId);
      if (previous) return Response.json(previous.result);
      const now = Date.now();
      let notice = '';
      if (action === 'daily') {
        const time = clockTime(value);
        if (time === null) return Response.json({text:'Укажи время в формате ЧЧ:ММ. Например: /daily 08:30.'});
        state.daily = {time, at: nextAt(now, time, state.offset)};
        const topics = dailySettings(state).topics;
        state.dailyOptions = {...state.dailyOptions, time, topics:topics.length ? topics : [defaultDailyTopic]};
        notice = 'Сводка включена на ' + clockLabel(time) + ' (UTC' + offsetLabel(state.offset) + ').';
      } else if (action === 'off') {
        state.daily = null;
        notice = 'Ежедневная сводка выключена.';
      } else if (action === 'timezone') {
        const offset = offsetMinutes(value);
        if (offset === null) return Response.json({text:'Укажи смещение от UTC. Например: /timezone +03:00 для Москвы.'});
        state.offset = offset;
        if (state.daily) state.daily.at = nextAt(now, state.daily.time, offset);
        notice = 'Часовой пояс обновлён: UTC' + offsetLabel(offset) + '.';
      } else if (action === 'remind') {
        const reminder = reminderTime(value, now, state.offset);
        if (!reminder?.text || reminder.text.length > 240) {
          return Response.json({text:'Укажи время и текст до 240 символов. Например: «Напомни завтра в 09:00 проверить почту».'});
        }
        if (state.reminders.length >= maxReminders) return Response.json({text:'У тебя уже 10 напоминаний. Одно из них можно отменить через /daily.'});
        state.reminders.push({id:String(updateId), ...reminder});
        notice = 'Напомню ' + when(reminder.at, state.offset) + ' — ' + reminder.text + '.';
      } else if (action === 'cancel') {
        state.reminders = state.reminders.filter(job => job.id !== value);
        notice = 'Напоминание убрано из списка.';
      } else {
        return Response.json({text:'Открой /daily, чтобы настроить сводку и напоминания.'});
      }
      const result = action === 'remind' ? {text:notice + '\n\nОтмена: /cancel ' + updateId, reply_markup:{inline_keyboard:[[{text:'Отменить напоминание',callback_data:'lumi:cancel:'+updateId}]]}}
        : {...screen(state), notice};
      state.recent = [...state.recent.slice(-19), {id:updateId, result}];
      await this.save(state);
      return Response.json(result);
    });
  }

  async alarm() {
    const state = await this.ctx.storage.get('state');
    if (!state) return;
    const jobs = [...state.reminders, ...(state.daily ? [state.daily] : [])];
    const job = jobs.sort((a,b) => a.at - b.at)[0];
    if (!job || job.at > Date.now()) {
      return this.ctx.blockConcurrencyWhile(async () => this.save(await this.ctx.storage.get('state')));
    }
    const content = await jobMessage(job, state);
    const findJob = current => job.id ? current.reminders.find(item => item.id === job.id) : current.daily;
    const latest = await this.ctx.storage.get('state');
    if (findJob(latest)?.at !== job.at) return;
    let result;
    try {
      result = await callTelegram(this.env.TELEGRAM_BOT_TOKEN, 'sendMessage', {
        chat_id: state.chatId,
        ...content,
        link_preview_options: {is_disabled:true},
        reply_markup: {inline_keyboard: [[openLumiButton()], [{text:'Настроить сводку',callback_data:'lumi:menu'}]]},
      });
    } catch { result = {error_code:503}; }
    await this.ctx.blockConcurrencyWhile(async () => {
      const current = await this.ctx.storage.get('state');
      const existing = findJob(current);
      if (existing?.at !== job.at) return;
      const failures = existing.failures || 0;
      if (result?.error_code === 403) {
        current.daily = null;
        current.reminders = [];
      } else if (result?.error_code === 429) {
        existing.at = Date.now() + Math.max(5, Math.min(3600, Number(result.parameters?.retry_after) || 30)) * 1000;
      } else if (!result?.ok && result?.error_code !== 400 && failures < 3) {
        existing.failures = failures + 1;
        existing.at = Date.now() + 15000 * 4 ** failures;
      } else if (!job.id) {
        current.daily = {time:existing.time, at:nextAt(Date.now(), existing.time, current.offset)};
      } else {
        current.reminders = current.reminders.filter(item => item.id !== job.id);
      }
      await this.save(current);
    });
  }
}
