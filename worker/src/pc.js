// The relay keeps requests in memory only. SQL Server on the paired PC owns the archive.
export class PcRelay {
  constructor(ctx) { this.ctx = ctx; this.requests = new Map(); }
  async fetch(request) {
    if (new URL(request.url).pathname === '/connect') {
      const pair = new WebSocketPair();
      for (const old of this.ctx.getWebSockets()) old.close(1000, 'Reconnected');
      this.ctx.acceptWebSocket(pair[1]);
      return new Response(null, {status:101, headers:{'Sec-WebSocket-Protocol':'lumi'}, webSocket:pair[0]});
    }
    const socket = this.ctx.getWebSockets()[0];
    if (!socket) return Response.json({error:'Компьютер сейчас не подключён.'},{status:503});
    const id = crypto.randomUUID();
    const data = await request.json();
    return new Promise(resolve => {
      const finish = (result, status) => {
        clearTimeout(timer);
        this.requests.delete(id);
        resolve(Response.json(result,{status}));
      };
      const timer = setTimeout(()=>finish({error:'Компьютер не успел ответить.'},504),20000);
      this.requests.set(id,finish);
      try { socket.send(JSON.stringify({id,...data})); }
      catch { finish({error:'Соединение с ПК прервано.'},503); }
    });
  }
  webSocketMessage(socket, raw) {
    let packet;
    try { packet = JSON.parse(raw); } catch { return; }
    this.requests.get(packet.id)?.(packet.result, packet.error ? 503 : 200);
  }
  webSocketClose(socket, code) { try { socket.close(code === 1000 ? 1000 : 1001); } catch {} }
  webSocketError(socket) { try { socket.close(1011); } catch {} }
}
export async function matches(value, expected) {
  if (typeof value !== 'string' || value.length !== 48 || !expected) return false;
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)));
  return Array.from(digest, b=>b.toString(16).padStart(2,'0')).join('') === expected;
}
