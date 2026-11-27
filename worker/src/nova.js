export const novaModel = 'lumi-nova';

export function novaConfigured(env) {
  return Boolean(env.OPENAI_API_KEY?.trim() && /^[1-9]\d{0,15}$/.test(env.NOVA_TELEGRAM_ID?.trim() || ''));
}

export function novaAvailableTo(env, user) {
  return novaConfigured(env) && String(user?.id) === env.NOVA_TELEGRAM_ID.trim();
}

function novaError(message, status = 502) {
  return Object.assign(new Error(message), {status, isNova: true});
}

export async function requestNova(env, system, contents, options) {
  if (!novaConfigured(env)) throw novaError('Lumi 1.2 Nova ещё не подключена.', 503);
  const declarations = options.tools?.flatMap(tool => tool.functionDeclarations) || [];
  const required = options.toolConfig?.functionCallingConfig?.mode === 'ANY';
  const messages = [{
    role: 'system',
    content: system + (required ? ' Текущий вопрос требует внешнего источника. Выбери подходящую функцию, чтобы получить данные.' : ''),
  }, ...contents.map(item => ({
    role: item.role === 'model' ? 'assistant' : 'user',
    content: item.parts.some(part => part.inlineData)
      ? item.parts.map(part => part.inlineData
        ? {type: 'image_url', image_url: {url: 'data:image/jpeg;base64,' + part.inlineData.data}}
        : {type: 'text', text: part.text})
      : item.parts.map(part => part.text).join('\n\n'),
  }))];
  const tools = declarations.map(({name, description, parameters}) => ({
    type: 'function',
    function: {
      name, description,
      parameters: {
        ...parameters, type: 'object',
        properties: Object.fromEntries(Object.entries(parameters.properties).map(([key, value]) => [
          key, {...value, type: value.type.toLowerCase()},
        ])),
      },
    },
  }));
  let response;
  try {
    response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      redirect: 'error',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + env.OPENAI_API_KEY.trim(),
      },
      signal: AbortSignal.timeout(options.timeout || 18000),
      body: JSON.stringify({
        model: 'gpt-6-luna',
        messages,
        store: false,
        reasoning_effort: 'none',
        max_completion_tokens: options.generationConfig?.maxOutputTokens || 1600,
        ...(tools.length && {tools, tool_choice: required ? 'required' : 'auto', parallel_tool_calls: false}),
      }),
    });
  } catch {
    throw novaError('Lumi 1.2 Nova не успела ответить. Попробуй ещё раз.');
  }
  const result = await response.json().catch(() => null);
  if (response.status === 429) {
    if (['insufficient_quota', 'credit_balance_exhausted'].includes(result?.error?.code)) {
      throw novaError('Для Lumi 1.2 Nova закончилась квота OpenAI API. Проверь баланс.', 503);
    }
    throw novaError('Достигнут лимит Lumi 1.2 Nova. Попробуй позже.', 429);
  }
  if (response.status === 401 || response.status === 403) {
    throw novaError('Lumi 1.2 Nova не получила доступ. Проверь настройки подключения.', 503);
  }
  if (!response.ok) throw novaError('Lumi 1.2 Nova временно недоступна.');
  const message = result?.choices?.[0]?.message;
  const parts = [];
  const reply = [message?.content, message?.refusal].find(value => typeof value === 'string' && value.trim());
  if (reply) parts.push({text: reply});
  for (const toolCall of Array.isArray(message?.tool_calls) ? message.tool_calls : []) {
    const call = toolCall?.function;
    if (!declarations.some(declaration => declaration.name === call?.name)) continue;
    try {
      const args = JSON.parse(call.arguments);
      if (args && typeof args === 'object' && !Array.isArray(args)) parts.push({functionCall: {name: call.name, args}});
    } catch { /* Ignore malformed tool calls. */ }
  }
  if (!parts.length) throw novaError('Lumi 1.2 Nova не вернула ответ.');
  return parts;
}
