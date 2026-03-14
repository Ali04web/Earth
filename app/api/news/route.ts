import { NextResponse } from "next/server";

const SOURCES = [
  { id: "bbc",       name: "BBC",        url: "https://feeds.bbci.co.uk/news/world/rss.xml",         color: "#FF6677" },
  { id: "guardian",  name: "GUARDIAN",   url: "https://www.theguardian.com/world/rss",                color: "#00D2FF" },
  { id: "aljazeera", name: "AL JAZEERA", url: "https://www.aljazeera.com/xml/rss/all.xml",            color: "#FFB300" },
  { id: "reuters",   name: "REUTERS",    url: "https://feeds.reuters.com/reuters/worldNews",           color: "#00FFB2" },
];

const GEO: Record<string, [number, number]> = {
  afghanistan:[33.9,67.7],albania:[41.2,20.2],algeria:[28.0,1.7],angola:[-11.2,17.9],
  argentina:[-38.4,-63.6],armenia:[40.1,45.0],australia:[-25.3,133.8],austria:[47.5,14.6],
  azerbaijan:[40.1,47.6],bangladesh:[23.7,90.4],belarus:[53.7,27.9],belgium:[50.5,4.5],
  brazil:[-14.2,-51.9],bulgaria:[42.7,25.5],"burkina faso":[12.4,-1.6],burma:[21.9,95.9],
  cambodia:[12.6,104.9],cameroon:[7.4,12.4],canada:[56.1,-106.3],chile:[-35.7,-71.5],
  china:[35.9,104.2],colombia:[4.6,-74.1],congo:[-4.0,21.8],croatia:[45.1,15.2],
  cuba:[21.5,-77.8],czech:[49.8,15.5],denmark:[56.3,9.5],drc:[-4.0,21.8],
  ecuador:[-1.8,-78.2],egypt:[26.8,30.8],eritrea:[15.2,39.8],ethiopia:[9.1,40.5],
  finland:[61.9,25.7],france:[46.2,2.2],georgia:[42.3,43.4],germany:[51.2,10.4],
  ghana:[7.9,-1.0],greece:[39.1,21.8],haiti:[18.9,-72.3],hungary:[47.2,19.5],
  india:[20.6,78.9],indonesia:[-0.8,113.9],iran:[32.4,53.7],iraq:[33.2,43.7],
  ireland:[53.1,-8.2],israel:[31.0,34.9],italy:[41.9,12.6],japan:[36.2,138.3],
  jordan:[30.6,36.2],kazakhstan:[48.0,66.9],kenya:[-0.0,37.9],korea:[35.9,127.8],
  kosovo:[42.6,20.9],kuwait:[29.3,47.5],lebanon:[33.9,35.5],libya:[26.3,17.2],
  lithuania:[55.2,23.9],malaysia:[4.2,108.0],mali:[17.6,-4.0],mexico:[23.6,-102.5],
  moldova:[47.4,28.4],morocco:[31.8,-7.1],mozambique:[-18.7,35.5],myanmar:[21.9,95.9],
  nepal:[28.4,84.1],netherlands:[52.3,5.3],"new zealand":[-40.9,174.9],niger:[17.6,8.1],
  nigeria:[9.1,8.7],"north korea":[40.3,127.5],norway:[60.5,8.5],oman:[21.5,55.9],
  pakistan:[30.4,69.3],palestine:[31.9,35.3],peru:[-9.2,-75.0],philippines:[13.0,122.5],
  poland:[51.9,19.1],portugal:[39.4,-8.2],qatar:[25.4,51.2],romania:[45.9,24.9],
  russia:[61.5,105.3],rwanda:[-1.9,29.9],saudi:[23.9,45.1],"saudi arabia":[23.9,45.1],
  senegal:[14.5,-14.5],serbia:[44.0,21.0],somalia:[5.2,46.2],"south africa":[-30.6,22.9],
  "south korea":[35.9,127.8],"south sudan":[6.9,31.3],spain:[40.5,-3.7],"sri lanka":[7.9,80.8],
  sudan:[12.9,30.2],sweden:[60.1,18.6],switzerland:[46.8,8.2],syria:[34.8,38.9],
  taiwan:[23.7,121.0],thailand:[15.9,100.9],tunisia:[33.9,9.5],turkey:[38.9,35.2],
  ukraine:[49.0,31.2],"united arab emirates":[23.4,53.8],uae:[23.4,53.8],
  uk:[55.4,-3.4],"united kingdom":[55.4,-3.4],us:[37.1,-95.7],usa:[37.1,-95.7],
  "united states":[37.1,-95.7],venezuela:[6.4,-66.6],vietnam:[14.1,108.3],
  yemen:[15.6,48.5],zambia:[-13.1,27.8],zimbabwe:[-20.0,30.0],
  kabul:[34.5,69.2],cairo:[30.1,31.2],beijing:[39.9,116.4],moscow:[55.8,37.6],
  london:[51.5,-0.1],"new york":[40.7,-74.0],paris:[48.9,2.4],tokyo:[35.7,139.7],
  berlin:[52.5,13.4],sydney:[-33.9,151.2],dubai:[25.2,55.3],delhi:[28.6,77.2],
  "new delhi":[28.6,77.2],mumbai:[19.1,72.9],istanbul:[41.0,28.9],ankara:[39.9,32.9],
  tehran:[35.7,51.4],baghdad:[33.3,44.4],kyiv:[50.5,30.5],kiev:[50.5,30.5],
  "tel aviv":[32.1,34.8],damascus:[33.5,36.3],beirut:[33.9,35.5],amman:[31.9,35.9],
  riyadh:[24.7,46.7],doha:[25.3,51.5],singapore:[1.4,103.8],"hong kong":[22.3,114.2],
  shanghai:[31.2,121.5],seoul:[37.6,126.9],taipei:[25.0,121.5],jakarta:[-6.2,106.8],
  manila:[14.6,121.0],karachi:[24.9,67.0],islamabad:[33.7,73.1],nairobi:[-1.3,36.8],
  lagos:[6.5,3.4],accra:[5.6,-0.2],addis:[9.0,38.7],khartoum:[15.6,32.5],
  tripoli:[32.9,13.2],tunis:[36.8,10.2],casablanca:[33.6,-7.6],algiers:[36.7,3.1],
  kinshasa:[-4.3,15.3],johannesburg:[-26.2,28.0],"cape town":[-33.9,18.4],
  mogadishu:[2.1,45.3],kampala:[0.3,32.6],kigali:[-1.9,30.1],juba:[4.9,31.6],
  "washington":[38.9,-77.0],"los angeles":[34.0,-118.2],chicago:[41.9,-87.6],
  toronto:[43.7,-79.4],vancouver:[49.3,-123.1],montreal:[45.5,-73.6],
  "mexico city":[19.4,-99.1],bogota:[4.7,-74.1],lima:[-12.0,-77.0],
  "buenos aires":[-34.6,-58.4],"sao paulo":[-23.5,-46.6],brasilia:[-15.8,-47.9],
  warsaw:[52.2,21.0],budapest:[47.5,19.1],prague:[50.1,14.4],bucharest:[44.4,26.1],
  sofia:[42.7,23.3],athens:[38.0,23.7],rome:[41.9,12.5],madrid:[40.4,-3.7],
  lisbon:[38.7,-9.1],amsterdam:[52.4,4.9],brussels:[50.8,4.4],vienna:[48.2,16.4],
  stockholm:[59.3,18.1],oslo:[59.9,10.7],helsinki:[60.2,25.0],copenhagen:[55.7,12.6],
  baku:[40.4,49.9],yerevan:[40.2,44.5],tbilisi:[41.7,44.8],tashkent:[41.3,69.3],
  almaty:[43.3,76.9],bishkek:[42.9,74.6],ashgabat:[37.9,58.4],dushanbe:[38.6,68.8],
  kathmandu:[27.7,85.3],colombo:[6.9,79.9],dhaka:[23.8,90.4],yangon:[16.9,96.2],
  bangkok:[13.8,100.5],hanoi:[21.0,105.8],"kuala lumpur":[3.1,101.7],
  phnom:[11.6,104.9],vientiane:[18.0,102.6],
};

const CAT_RULES: Record<string, string[]> = {
  conflict:["war","attack","missile","bomb","kill","dead","strike","military","troops","fighting","explosion","armed","rebel","hamas","hezbollah","soldier","hostage","ceasefire","invasion","offensive","drone","airstrike","casualties","siege","violence","riot","clashes","shooting","terror","extremist"],
  politics:["election","vote","parliament","president","minister","government","diplomacy","treaty","sanction","summit","nato","united nations","senate","congress","prime minister","chancellor","policy","political","opposition","coup","protest","demonstration","rally","referendum"],
  economy:["economy","gdp","inflation","market","stock","trade","tariff","oil","gas","price","dollar","euro","bank","debt","imf","recession","growth","supply chain","export","import","currency","investment","billion","trillion","unemployment","interest rate"],
  tech:["artificial intelligence"," ai ","cyber","hack","data breach","tech","software","chip","semiconductor","space","rocket","satellite","quantum","robot","autonomous","digital","internet","surveillance","privacy","5g","neural"],
  disaster:["earthquake","flood","hurricane","tsunami","wildfire","cyclone","tornado","volcano","drought","famine","disaster","climate","storm","eruption","landslide","evacuate","emergency","crisis"],
  crime:["arrest","charged","convicted","murder","drug","trafficking","corruption","fraud","scandal","bribe","mafia","cartel","criminal","investigation","court","sentenced","indicted"],
  health:["covid","virus","pandemic","disease","vaccine","hospital","health","outbreak","infection","medical","cancer","aids","malaria","ebola","epidemic"],
};

function detectCategory(text: string): string {
  const t = text.toLowerCase();
  for (const [cat, kws] of Object.entries(CAT_RULES)) {
    if (kws.some(k => t.includes(k))) return cat;
  }
  return "politics";
}

function geocode(text: string): { name: string; coords: [number, number] } | null {
  const t = text.toLowerCase();
  const keys = Object.keys(GEO).sort((a, b) => b.length - a.length);
  for (const k of keys) {
    if (t.includes(k)) {
      return { name: k.replace(/\b\w/g, c => c.toUpperCase()), coords: GEO[k] };
    }
  }
  return null;
}

function parseRSS(xml: string, source: typeof SOURCES[0]) {
  const articles: Article[] = [];
  const items = xml.match(/<item[\s\S]*?<\/item>/g) || [];
  items.slice(0, 15).forEach(item => {
    const title = (item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/) ||
                   item.match(/<title>(.*?)<\/title>/))?.[1]?.trim() || "";
    const desc  = (item.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>/) ||
                   item.match(/<description>(.*?)<\/description>/))?.[1]
                   ?.replace(/<[^>]+>/g, "").trim().slice(0, 150) || "";
    const link  = (item.match(/<link>(.*?)<\/link>/) ||
                   item.match(/<link\s[^>]*href="([^"]+)"/))?.[1]?.trim() || "#";
    const pubDate = (item.match(/<pubDate>(.*?)<\/pubDate>/))?.[1]?.trim() || "";
    if (!title) return;
    const text = title + " " + desc;
    const geo  = geocode(text);
    const cat  = detectCategory(text);
    articles.push({
      id: Math.random().toString(36).slice(2),
      source: source.id,
      sourceName: source.name,
      sourceColor: source.color,
      title, desc, link, geo, cat,
      pubDate: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
    });
  });
  return articles;
}

export interface Article {
  id: string;
  source: string;
  sourceName: string;
  sourceColor: string;
  title: string;
  desc: string;
  link: string;
  pubDate: string;
  geo: { name: string; coords: [number, number] } | null;
  cat: string;
}

export async function GET() {
  const results = await Promise.allSettled(
    SOURCES.map(async src => {
      const r = await fetch(src.url, {
        next: { revalidate: 300 },
        headers: { "User-Agent": "Mozilla/5.0 SentinelBot/1.0" },
        signal: AbortSignal.timeout(8000),
      });
      if (!r.ok) throw new Error("HTTP " + r.status);
      const xml = await r.text();
      return parseRSS(xml, src);
    })
  );

  const seen = new Set<string>();
  const articles: Article[] = results
    .flatMap(r => (r.status === "fulfilled" ? r.value : []))
    .filter(a => { if (seen.has(a.title)) return false; seen.add(a.title); return true; })
    .sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime());

  return NextResponse.json({ articles, fetchedAt: new Date().toISOString() });
}
