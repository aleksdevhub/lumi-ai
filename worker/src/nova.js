export const novaModel = 'lumi-nova';

export function novaConfigured(env) {
  return Boolean(env.YANDEX_API_KEY?.trim() && /^[a-z0-9-]{1,64}$/i.test(env.YANDEX_FOLDER_ID?.trim() || ''));
}

function novaError(message, status = 502) {
  return Object.assign(new Error(message), {status, isNova: true});
}

export async function requestNova(env, system, contents, options) {
  if (!novaConfigured(env)) throw novaError('Lumi 1.2 Nova ещё не подключена.', 503);
  const folder = env.YANDEX_FOLDER_ID.trim();
  const declarations = options.tools?.flatMap(tool => tool.functionDeclarations) || [];
  const required = options.toolConfig?.functionCallingConfig?.mode === 'ANY';
  const messages = [{
    role: 'system',
    content: system + (required ? ' Текущий вопрос требует внешнего источника. Выбери подходящую функцию, чтобы получить данные.' : ''),
  }, ...contents.map(item => ({
    role: item.role === 'model' ? 'assistant' : 'user',
    content: item.parts.map(part => part.text || '').join('\n\n'),
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
    response = await fetch('https://ai.api.cloud.yandex.net/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Api-Key ' + env.YANDEX_API_KEY.trim(),
        'OpenAI-Project': folder,
      },
      signal: AbortSignal.timeout(options.timeout || 18000),
      body: JSON.stringify({
        model: 'gpt://' + folder + '/aliceai-llm-flash',
        messages,
        max_tokens: options.generationConfig?.maxOutputTokens || 1600,
        temperature: 0.4,
        ...(tools.length && {tools, tool_choice: 'auto'}),
      }),
    });
  } catch {
    throw novaError('Lumi 1.2 Nova не успела ответить. Попробуй ещё раз.');
  }
  if (response.status === 429) throw novaError('Достигнут лимит Lumi 1.2 Nova. Попробуй позже.', 429);
  if (response.status === 401 || response.status === 403) {
    throw novaError('Lumi 1.2 Nova не получила доступ. Проверь настройки подключения.', 503);
  }
  if (!response.ok) throw novaError('Lumi 1.2 Nova временно недоступна.');
  const result = await response.json().catch(() => null);
  const message = result?.choices?.[0]?.message;
  const parts = [];
  if (typeof message?.content === 'string' && message.content.trim()) parts.push({text: message.content});
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
