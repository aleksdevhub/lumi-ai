export const appUrl = 'https://aleksdevhub.github.io/lumi-ai/';
export const openLumiButton = () => ({text:'Открыть LUMI', web_app:{url:appUrl}});

export async function callTelegram(token, method, payload) {
  const response = await fetch('https://api.telegram.org/bot' + token + '/' + method, {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    signal:AbortSignal.timeout(10000),
    body:JSON.stringify(payload),
  });
  return response.json();
}
