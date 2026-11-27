export function weatherRequest(text) {
  const query = text.trim().replace(/[?!.,]+$/u, '');
  if (!/(?:погод[ауыое]|прогноз|weather|forecast|сколько.{0,20}градусов|будет ли (?:дождь|снег))/iu.test(query)) return null;
  if (/(?:почему|как образуется|объясни|что такое|вчера|в прошлом|климат)/iu.test(query)) return null;
  const week = /недел[юеи]|(?:7|семь)\s+(?:дней|суток)|week|7 days/iu.test(query);
  const tomorrow = /завтра|tomorrow/iu.test(query);
  const citedPlace = query.match(/(?:^|\s)(?:в|во|для|in)\s+([\p{L}][\p{L} .-]{1,55})$/iu)?.[1]
    ?? query.match(/^\/?погода\s+([\p{L}][\p{L} .-]{1,55})$/iu)?.[1];
  const city = (citedPlace || '').replace(/\b(?:today|tomorrow|this week)\b|(?:^|\s)(?:на неделю|на завтра|на сегодня|на 7 дней|на семь дней|сегодня|завтра|сейчас|утром|вечером|у меня)(?=\s|$)/giu, '').trim();
  return {days: week ? 7 : 1, tomorrow, city: /^(?:на|у|рядом|здесь|сегодня|сейчас|завтра|на улице|завтра утром|на ближайшие дни|у меня|здесь сейчас)$/iu.test(city) ? '' : city};
}

export function newsRequest(text) {
  const query = text.trim().replace(/[?!.,]+$/u, '');
  if (!/(?:новост[ьи]|события|news|headlines|что.{0,35}(?:происходит|случилось|нового).{0,25}в мире)/iu.test(query)) return null;
  if (/(?:напиши|придумай|создай|сгенерируй|переведи|исправь|что такое|как писать|вчера|прошл)/iu.test(query)) return null;
  if (!/(?:^\/?новост[ьи]|сегодня|свежие|последние|главные|сейчас|в мире|какие|что нового|что происходит|покажи|расскажи|дай|headlines|latest|world news)/iu.test(query)) return null;
  const topic = query.match(/(?:новости|события)\s+(?:(?:сегодня|сейчас)\s+)?(?:про|о|об|по теме)\s+(.+)/iu)?.[1]
    || query.match(/^\/новости\s+(.+)/iu)?.[1] || '';
  return {topic: /^(?:сегодня|сейчас|в мире|мир)$/iu.test(topic) ? '' : topic.replace(/\s+(?:сегодня|сейчас)$/iu, '').slice(0, 90)};
}

export function imageRequest(text) {
  const request = text.trim().match(/^(?:(?:пожалуйста[, ]+|можешь\s+(?:пожалуйста[, ]+)?))?(?:(?:\/рисунок|\/image)\s*|нарисуй\s+|(?:сгенерируй|создай|сделай|сгенерировать|создать|сделать)\s+(?:(?:мне|пожалуйста)\s+)?(?:картинк[ууи]|изображение|фото|иллюстрацию|арт)(?:\s+|\s*[:—-]\s*|$))([\s\S]*)$/iu);
  return request ? {prompt: request[1].trim()} : null;
}
