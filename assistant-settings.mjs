export const defaultDailyTopic = 'Мировые новости';
export const dailyTopicLimit = 3;
export const communicationStyles = {
  neutral: 'Нейтральный',
  friendly: 'Дружелюбный',
  professional: 'Профессиональный',
  concise: 'Лаконичный',
};
export const replyLanguages = {
  auto: 'Как в сообщении',
  ru: 'Русский',
  en: 'Английский',
  uk: 'Украинский',
  kk: 'Казахский',
  de: 'Немецкий',
  es: 'Испанский',
};

function singleLine(value, limit) {
  return typeof value === 'string' ? value.replace(/\s+/gu, ' ').trim().slice(0, limit) : '';
}

export function normalizePersonality(value) {
  return {
    style: typeof value?.style === 'string' && Object.hasOwn(communicationStyles, value.style) ? value.style : 'neutral',
    language: typeof value?.language === 'string' && Object.hasOwn(replyLanguages, value.language) ? value.language : 'auto',
    emoji: singleLine(value?.emoji, 32),
    traits: singleLine(value?.traits, 220),
  };
}

export function normalizeDailyTopics(value) {
  if (!Array.isArray(value)) return [];
  const topics = new Map();
  for (const item of value.slice(0, dailyTopicLimit)) {
    const label = singleLine(item, 60);
    if (!label) continue;
    const slug = label.toLocaleLowerCase('ru');
    if (!topics.has(slug)) topics.set(slug, label);
  }
  return [...topics.values()];
}
