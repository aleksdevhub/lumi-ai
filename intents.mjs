export function weatherRequest(text) {
  const query = text.trim().replace(/[?!.,]+$/u, '');
  if (!/(?:погод[ауыое]|прогноз|weather|forecast|сколько.{0,20}градусов|будет ли (?:дождь|снег))/iu.test(query)) return null;
  if (/(?:почему|как образуется|объясни|что такое|вчера|позавчера|в прошлом|климат|архив|истори[яюи]|за прошл)/iu.test(query)) return null;
  if (/(?:напиши|покажи|создай|проверь)\s+(?:мне\s+)?(?:код|тест|пример кода|скрипт|формулу|таблицу|приложение|статью)/iu.test(query)) return null;
  if (!/погод|weather|(?:дождь|снег)|градус/iu.test(query) && /(?:курс|цен|продаж|бирж|матч|акци|экономик|рост)/iu.test(query)) return null;
  const week = /недел[юеи]|(?:7|семь)\s+(?:дней|суток)|week|7 days/iu.test(query);
  const tomorrow = /завтра|tomorrow/iu.test(query);
  const placeQuery = query.split(/[, ]+на\s+(?:(?:ближайшие|следующие)\s+)?(?:неделю|(?:7|семь)\s+(?:дней|суток)|(?:ближайшие\s+)?дни|завтра|сегодня)(?=\s|[,.!?]|$)|\s+(?:for\s+)?(?:the\s+next\s+7\s+days|this\s+week)(?=\s|[,.!?]|$)/iu)[0];
  const citedPlace = placeQuery.match(/(?:^|\s)(?:в|во|для|in)\s+([\p{L}][\p{L} .-]{1,55})$/iu)?.[1]
    ?? placeQuery.match(/^\/?погода\s+([\p{L}][\p{L} .-]{1,55})$/iu)?.[1];
  const city = (citedPlace || '').replace(/\b(?:today|tomorrow|this week)\b|(?:^|\s)(?:на неделю|на завтра|на сегодня|на 7 дней|на семь дней|сегодня|завтра|сейчас|утром|вечером|у меня)(?=\s|$)/giu, '').trim();
  return {days: week ? 7 : 1, tomorrow, city: /^(?:на|у|рядом|здесь|сегодня|сейчас|завтра|на улице|завтра утром|на ближайшие дни|у меня|здесь сейчас|мо[её]м городе|нашем городе|my city|my area)$/iu.test(city) ? '' : city};
}

export function newsRequest(text) {
  const query = text.trim().replace(/[?!.,]+$/u, '');
  if (!/(?:новост[ьи]|события|news|headlines|что.{0,35}(?:происходит|случилось|нового).{0,25}в мире)/iu.test(query)) return null;
  if (/(?:напиши|придумай|создай|сгенерируй|переведи|исправь|что такое|как писать|вчера|прошл|мо[её]м проекте|нашем чате|нашем проекте|у меня)/iu.test(query)) return null;
  if (/(?:в (?:этом|данном|привед[её]нном) (?:тексте|примере|фрагменте|отрывке)|сюжет|в романе|в фильме)/iu.test(query)) return null;
  if (!/(?:^\/?новост[ьи]|сегодня|свежие|последние|главные|сейчас|в мире|какие|что нового|что происходит|покажи|расскажи|дай|headlines|latest|world news)/iu.test(query)) return null;
  const firstClause = query.split(/[?!.]\s|[;\n]/u, 1)[0];
  const rawTopic = firstClause.match(/(?:новости|события)\s+(?:(?:сегодня|сейчас)\s+)?(?:про|о|об|по теме|из|в)\s+(.+)/iu)?.[1]
    || firstClause.match(/^\/новости\s+(.+)/iu)?.[1] || '';
  const topic = rawTopic.replace(/[, ]+со? ссылк.*$/iu, '').replace(/\s+(?:сегодня|сейчас)$/iu, '').trim();
  const countText = query.match(/(?:^|[^\p{L}\p{N}])([1-6]|одно|одну|дв[ае]|три|четыре|пять|шесть)\s+(?:(?:главн\p{L}*|разн\p{L}*|свеж\p{L}*)\s+)?(?:новост|событи|истори|публикаци)/iu)?.[1]?.toLowerCase();
  const counts = {одно:1, одну:1, два:2, две:2, три:3, четыре:4, пять:5, шесть:6};
  const analysis = /(?:сравни|проанализируй|объясни|почему|каковы последствия|как это повлияет|что уже произошло|что (?:только )?запланировано)/iu.test(query);
  const direct = /(?:^\/?новости(?:\s|$)|свежие|последние|главные|сегодня|сейчас|в мире|headlines|latest|world news|(?:какие|дай|покажи)\s+(?:мне\s+)?новости)/iu.test(firstClause);
  return {topic: /^(?:сегодня|сейчас|в мире|мире|мир)$/iu.test(topic) ? '' : topic.slice(0, 90), count: counts[countText] || Number(countText) || 0, analysis, direct};
}

export function imageRequest(text) {
  const request = text.trim().match(/^(?:(?:пожалуйста[, ]+|можешь\s+(?:пожалуйста[, ]+)?))?(?:(?:\/рисунок|\/image)\s*|нарисуй\s+|(?:сгенерируй|создай|сделай|сгенерировать|создать|сделать)\s+(?:(?:мне|пожалуйста)\s+)?(?:картинк[ууи]|изображение|фото|иллюстрацию|арт)(?:\s+|\s*[:—-]\s*|$))([\s\S]*)$/iu);
  return request ? {prompt: request[1].trim()} : null;
}
