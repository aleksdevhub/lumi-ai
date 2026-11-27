export const personalMemoryLimit = 10;
export const personalMemoryEntryLimit = 200;

export function personalMemoryKey(telegramId) {
  const id = String(telegramId ?? '');
  return /^[1-9]\d{0,15}$/.test(id) ? 'personalMemory:' + id : null;
}

export function rememberRequest(text) {
  const command = text.trim().match(/^(?:\/запомни|(?:луми|lumi)[,.! ]+запомни)(?=\s|[:,.!?]|$)[\s:,.!?]*([\s\S]*)$/iu);
  return command ? command[1].trim() : null;
}

export function normalizePersonalMemory(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, personalMemoryLimit)
    .filter(item => typeof item === 'string')
    .map(item => item.trim().slice(0, personalMemoryEntryLimit))
    .filter(Boolean);
}
