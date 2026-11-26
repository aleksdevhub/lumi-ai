// Run under the Windows account that owns the LumiChats LocalDB database.
const fs = require('node:fs');
const path = require('node:path');
const {spawn} = require('node:child_process');
const dir = path.join(process.env.LOCALAPPDATA,'LumiChats');
const key = fs.readFileSync(path.join(dir,'pc.txt'),'utf8').trim();
const endpoint = 'wss://lumi-ai-api.aleksandrkruglov061.workers.dev/pc/connect';

function sync(packet) {
  const {user,after,items} = packet;
  const bytes = Buffer.from(JSON.stringify({user,after,items}),'utf16le').toString('hex');
  // Send only hex literals to sqlcmd. Never interpolate caller text into SQL.
  const chunks = bytes.match(/.{1,4000}/g) || [];
  const query = ['SET NOCOUNT ON;', 'DECLARE @bytes VARBINARY(MAX)=0x;',
    ...chunks.map(hex=>'SET @bytes=@bytes+0x'+hex+';'),
    'DECLARE @json NVARCHAR(MAX)=CONVERT(NVARCHAR(MAX),@bytes);',
    'EXEC dbo.SyncChats @json;', 'GO', ''].join('\n');
  return new Promise((resolve,reject)=>{
    const sql = spawn('sqlcmd',['-S','(localdb)\\MSSQLLocalDB','-d','LumiChats','-E','-C','-b','-l','6','-t','10','-y','0','-w','65535'],{windowsHide:true});
    const output=[];
    sql.stdout.on('data',data=>output.push(data));
    sql.stderr.resume();
    sql.on('error',reject);
    sql.stdin.on('error',reject);
    sql.on('close',code=>{
      if(code) return reject(new Error('SQL Server недоступен'));
      try {
        const base64=Buffer.concat(output).toString('ascii').replace(/\s/g,'');
        const rows=JSON.parse(Buffer.from(base64,'base64').toString('utf16le'));
        resolve({rows,more:rows.length===15});
      } catch(error){reject(error);}
    });
    sql.stdin.end(query);
  });
}
function connect(){
  const ws=new WebSocket(endpoint,['lumi',key]);
  ws.onopen=()=>console.log('Connected to Lumi');
  ws.onmessage=async({data})=>{
    const packet=JSON.parse(data);
    let response;
    try{response={id:packet.id,result:await sync(packet)};}
    catch{response={id:packet.id,error:true,result:{error:'Не удалось сохранить переписку в SQL Server.'}};}
    if(ws.readyState===WebSocket.OPEN) ws.send(JSON.stringify(response));
  };
  ws.onerror=()=>{};
  ws.onclose=()=>setTimeout(connect,10000);
}
connect();
