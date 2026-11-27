const ordinals = {
  перв: 1, втор: 2, трет: 3, четверт: 4, пят: 5, шест: 6,
};

const ordinal = '(перв|втор|трет|четв[её]рт|пят|шест)(?:ый|ой|ий|ая|ую|ое|ого|ому|ым|ом|ей|ья|ью|ьем|ьей|ьего)';
const subject = '(?:новост[а-яё]*|стать[а-яё]*|ссылк[а-яё]*|источник[а-яё]*|публикаци[а-яё]*)';
const before = new RegExp('(?:^|[^\\p{L}])' + ordinal + '\\s+' + subject, 'iu');
const after = new RegExp(subject + '\\s*№?\\s*([1-9]\\d?)(?!\\d)', 'iu');
const alone = new RegExp('(?:^|[^\\p{L}])' + ordinal + '(?:\\s+подробнее)?[?.!\\s]*$', 'iu');

function ordinalNumber(stem) {
  return ordinals[stem.toLowerCase().replaceAll('ё', 'е')];
}

export function sourceReference(text) {
  const mention = text.match(before);
  if (mention) return {number: ordinalNumber(mention[1]), explicit: true};
  const numbered = text.match(after);
  if (numbered) return {number: Number(numbered[1]), explicit: true};
  const short = text.match(alone);
  if (short && text.length <= 120 && /подробнее|расскажи|разбери|объясни|прочитай/iu.test(text)) {
    return {number: ordinalNumber(short[1]), explicit: false};
  }
  return null;
}

export function normalizeSources(items) {
  if (!Array.isArray(items)) return [];
  return items.slice(0, 6).map(item => {
    if (typeof item?.title !== 'string' || typeof item.url !== 'string' || item.url.length > 1800) return null;
    try {
      const url = new URL(item.url);
      if (url.protocol !== 'https:' || url.username || url.password || url.port) return null;
      url.hash = '';
      return {title: item.title.trim().slice(0, 200), url: url.href};
    } catch { return null; }
  });
}
