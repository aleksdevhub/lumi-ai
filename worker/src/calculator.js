export function calculate(expression) {
  if (typeof expression !== 'string' || expression.length > 120) return null;
  const input = expression.replaceAll('×', '*').replaceAll('÷', '/').replaceAll('−', '-').trim();
  const tokens = input.match(/\d+(?:\.\d+)?|[()+*/-]/g) || [];
  if (tokens.join('') !== input.replace(/\s+/g, '')) return null;

  const bounded = value => Math.abs(value) <= Number.MAX_SAFE_INTEGER ? value : NaN;
  let index = 0;
  function factor() {
    const token = tokens[index++];
    if (token === '-' || token === '+') return (token === '-' ? -1 : 1) * factor();
    if (token === '(') {
      const value = sum();
      return tokens[index++] === ')' ? value : NaN;
    }
    return token && /^\d/.test(token) ? bounded(Number(token)) : NaN;
  }

  function product() {
    let value = factor();
    while (tokens[index] === '*' || tokens[index] === '/') {
      const operator = tokens[index++];
      const next = factor();
      value = bounded(operator === '*' ? value * next : value / next);
    }
    return value;
  }

  function sum() {
    let value = product();
    while (tokens[index] === '+' || tokens[index] === '-') {
      const operator = tokens[index++];
      const next = product();
      value = bounded(operator === '+' ? value + next : value - next);
    }
    return value;
  }

  const value = sum();
  if (index !== tokens.length || !Number.isFinite(value) || Math.abs(value) > Number.MAX_SAFE_INTEGER) return null;
  return Number.isSafeInteger(value) ? value : Number(value.toPrecision(15));
}
