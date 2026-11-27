const agent = 'LumiAssistant/1.0 (+https://github.com/aleksdevhub/lumi-ai)';

async function read(url, format) {
  const res = await fetch(url, {headers:{'User-Agent':agent}, signal:AbortSignal.timeout(7000)});
  if (!res.ok) throw Error('Source unavailable');
  return format === 'json' ? res.json() : res.text();
}

function plain(xml) {
  const entities = {amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' '};
  return xml.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,'$1')
    .replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi,(_,key)=>{
      if (key[0]!=='#') return entities[key] || ' ';
      const code=key[1]==='x' ? parseInt(key.slice(2),16) : Number(key.slice(1));
      return code>0 && code<=0x10ffff ? String.fromCodePoint(code) : ' ';
    }).replace(/<[^>]*>/g,'').replace(/\s+/g,' ').trim();
}

function rss(xml) {
  const rows=[];
  for(const [,item] of xml.matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi)) {
    const field = tag => plain(item.match(new RegExp('<'+tag+'(?:\\s[^>]*)?>([\\s\\S]*?)</'+tag+'>','i'))?.[1] || '');
    const title=field('title').slice(0,200),url=field('link');
    if(!title || !/^https:\/\/[^\s]+$/i.test(url) || url.length>2200) continue;
    rows.push({title,url,snippet:field('description').slice(0,450),date:field('pubDate')});
  }
  return rows;
}

async function webSearch(query) {
  const url = new URL('https://www.bing.com/search');
  url.search = new URLSearchParams({q:query,format:'rss',setlang:'ru'});
  let results=[];
  try { results=rss(await read(url,'rss')).slice(0,4); } catch {}
  if (!results.length) {
    const wiki=new URL('https://ru.wikipedia.org/w/api.php');
    wiki.search=new URLSearchParams({action:'query',list:'search',srsearch:query,srlimit:'4',format:'json'});
    const found=(await read(wiki,'json')).query?.search || [];
    results=found.map(item=>({title:item.title,url:'https://ru.wikipedia.org/?curid='+item.pageid,snippet:plain(item.snippet)}));
  }
  // A search index date is not a publication date.
  return results.map(({title,url,snippet})=>({title,url,snippet}));
}

async function news(query) {
  const url=new URL(query ? 'https://news.google.com/rss/search' : 'https://news.google.com/rss');
  url.search=new URLSearchParams({hl:'ru',gl:'RU',ceid:'RU:ru',...(query && {q:query+' when:7d'})});
  const now=Date.now();
  return rss(await read(url,'rss')).filter(item=>{
    const stamp=Date.parse(item.date);
    return stamp<=now+3600000 && stamp>=now-7*86400000;
  }).sort((a,b)=>Date.parse(b.date)-Date.parse(a.date)).slice(0,4)
    .map(({title,url,date})=>({title,url,date}));
}

async function weather(city) {
  const locator = new URL('https://geocoding-api.open-meteo.com/v1/search');
  locator.search = new URLSearchParams({name:city,count:'1',language:'ru'});
  const place=(await read(locator,'json')).results?.[0];
  if (!place) return [];
  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.search = new URLSearchParams({latitude:place.latitude,longitude:place.longitude,timezone:'auto',forecast_days:'7',
    current:'temperature_2m,apparent_temperature,weather_code,wind_speed_10m',
    daily:'temperature_2m_min,temperature_2m_max,precipitation_probability_max,weather_code'});
  const data=await read(url,'json');
  if(!Number.isFinite(data.current?.temperature_2m) || !Array.isArray(data.daily?.time)) return [];
  const location=[...new Set([place.name,place.admin1,place.country].filter(Boolean))].join(', ');
  return [{title:'Open-Meteo · '+location,url:url.href,location,timezone:data.timezone,
    current:data.current,units:data.current_units,daily:data.daily,dailyUnits:data.daily_units}];
}

export async function readPage(address) {
  let url;
  try { url = new URL(address); } catch { return null; }
  const host = url.hostname;
  if (url.protocol !== 'https:' || url.username || url.password || url.port ||
      address.length > 1800 || !/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(host) ||
      /\.(localhost|local|internal|test|invalid|lan|home|onion)$/i.test(host) ||
      [...url.searchParams.keys()].some(k => /token|key|auth|sign|session|code|pass|secret/i.test(k))) return null;
  url.hash = '';
  try {
    const res = await fetch('https://r.jina.ai/'+url.href,{
      headers:{Accept:'text/plain'}, signal:AbortSignal.timeout(14000), redirect:'error'
    });
    if (!res.ok || !res.body) return null;
    const reader=res.body.getReader(), decoder=new TextDecoder();
    let raw='';
    try {
      while(raw.length<15000) {
        const {value,done}=await reader.read();
        if(done) break;
        raw+=decoder.decode(value.subarray(0,60000),{stream:true});
      }
    } finally { await reader.cancel(); }
    const start=raw.indexOf('Markdown Content:');
    if(start<0 || /Warning: Target URL returned error|checking your browser|verify you are human/i.test(raw.slice(0,1500))) return null;
    const snippet=raw.slice(start+17).trim().slice(0,10000);
    if(snippet.length<40) return null;
    return {title:(raw.match(/^Title:\s*(.+)$/m)?.[1]||host).slice(0,160),url:url.href,snippet};
  } catch {return null;}
}

export async function lookup(kind,query) {
  if(typeof query!=='string') return [];
  query=query.trim().slice(0,200);
  try {
    if(kind==='weather' && query) return await weather(query);
    if(kind==='news') return await news(query);
    if(kind==='search' && query) return await webSearch(query);
  } catch { /* A missing feed must not turn into a model-generated live result. */ }
  return [];
}
