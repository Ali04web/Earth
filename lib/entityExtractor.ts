import type { Article } from "@/app/api/news/route";

export type EntityType = "person" | "org" | "location" | "concept";

export interface Entity {
  id: string;
  label: string;
  type: EntityType;
  count: number;
  articles: string[]; // article ids
  risk: number; // 0-100
}

export interface EntityLink {
  source: string;
  target: string;
  strength: number;
  articles: string[];
}

export interface EntityGraph {
  nodes: Entity[];
  links: EntityLink[];
}

// ── Known entity dictionaries ──────────────────────────────────────────
const PERSONS: Record<string, string> = {
  "biden":"Joe Biden","trump":"Donald Trump","putin":"Vladimir Putin",
  "zelensky":"Volodymyr Zelensky","xi jinping":"Xi Jinping","xi":"Xi Jinping",
  "netanyahu":"Benjamin Netanyahu","modi":"Narendra Modi","macron":"Emmanuel Macron",
  "scholz":"Olaf Scholz","sunak":"Rishi Sunak","starmer":"Keir Starmer",
  "erdogan":"Recep Erdoğan","johnson":"Boris Johnson","harris":"Kamala Harris",
  "blinken":"Antony Blinken","yellen":"Janet Yellen","powell":"Jerome Powell",
  "musk":"Elon Musk","zuckerberg":"Mark Zuckerberg","altman":"Sam Altman",
  "kim jong":"Kim Jong-un","kim jong-un":"Kim Jong-un","sisi":"Abdel el-Sisi",
  "khamenei":"Ali Khamenei","raisi":"Ebrahim Raisi","bin salman":"Mohammed bin Salman",
  "mbs":"Mohammed bin Salman","zelenskyy":"Volodymyr Zelensky",
  "lavrov":"Sergei Lavrov","medvedev":"Dmitry Medvedev",
  "lula":"Luiz Lula da Silva","milei":"Javier Milei",
  "taylor swift":"Taylor Swift","obama":"Barack Obama",
  "gates":"Bill Gates","bezos":"Jeff Bezos","cook":"Tim Cook",
};

const ORGS: Record<string, string> = {
  "nato":"NATO","un ":"United Nations","united nations":"United Nations",
  "eu ":"European Union","european union":"European Union",
  "imf":"IMF","world bank":"World Bank","who ":"WHO","g7":"G7","g20":"G20",
  "cia":"CIA","fbi":"FBI","nsa":"NSA","mi6":"MI6","mossad":"Mossad",
  "hamas":"Hamas","hezbollah":"Hezbollah","isis":"ISIS","isil":"ISIS",
  "al-qaeda":"Al-Qaeda","al qaeda":"Al-Qaeda","wagner":"Wagner Group",
  "pentagon":"Pentagon","kremlin":"Kremlin","white house":"White House",
  "congress":"US Congress","senate":"US Senate","parliament":"Parliament",
  "apple":"Apple","google":"Google","microsoft":"Microsoft","amazon":"Amazon",
  "tesla":"Tesla","spacex":"SpaceX","openai":"OpenAI","nvidia":"NVIDIA",
  "goldman sachs":"Goldman Sachs","jpmorgan":"JPMorgan","blackrock":"BlackRock",
  "fed ":"US Federal Reserve","federal reserve":"US Federal Reserve",
  "opec":"OPEC","swift":"SWIFT","interpol":"INTERPOL",
  "world health organization":"WHO","iaea":"IAEA","icc":"ICC",
  "red cross":"Red Cross","unicef":"UNICEF","unhcr":"UNHCR",
  "oxfam":"Oxfam","amnesty":"Amnesty International","hrw":"Human Rights Watch",
  "reuters":"Reuters","bbc":"BBC","al jazeera":"Al Jazeera",
  "new york times":"New York Times","guardian":"The Guardian",
};

const CONCEPTS: Record<string, string> = {
  "nuclear":"Nuclear Weapons","sanctions":"Economic Sanctions",
  "climate change":"Climate Change","inflation":"Inflation",
  "interest rate":"Interest Rates","cryptocurrency":"Cryptocurrency",
  "bitcoin":"Bitcoin","artificial intelligence":"AI","cybersecurity":"Cybersecurity",
  "coup":"Military Coup","election":"Elections","ceasefire":"Ceasefire",
  "refugee":"Refugees","pandemic":"Pandemic","vaccine":"Vaccines",
  "drought":"Drought","famine":"Famine","migration":"Migration",
  "debt":"Sovereign Debt","gdp":"GDP Growth","recession":"Recession",
};

// ── Risk scoring ───────────────────────────────────────────────────────
const HIGH_RISK_ENTITIES = new Set([
  "Hamas","Hezbollah","ISIS","Al-Qaeda","Wagner Group","Kim Jong-un",
  "Vladimir Putin","Ali Khamenei","Nuclear Weapons","Military Coup",
]);
const MED_RISK_ENTITIES = new Set([
  "NATO","Economic Sanctions","Ceasefire","Migration","Refugees","Cybersecurity",
]);

function getRisk(label: string, type: EntityType, count: number): number {
  if (HIGH_RISK_ENTITIES.has(label)) return 75 + Math.min(25, count * 3);
  if (MED_RISK_ENTITIES.has(label))  return 40 + Math.min(30, count * 2);
  if (type === "org" && count > 5)   return 30 + count;
  if (type === "person" && count > 3) return 20 + count * 2;
  return Math.min(35, count * 3 + 5);
}

// ── Main extractor ─────────────────────────────────────────────────────
export function extractEntities(articles: Article[]): EntityGraph {
  const entityMap = new Map<string, Entity>();
  const coMap     = new Map<string, Map<string, string>>(); // cooccurrence

  function upsert(id: string, label: string, type: EntityType, artId: string) {
    if (!entityMap.has(id)) {
      entityMap.set(id, { id, label, type, count: 0, articles: [], risk: 0 });
    }
    const e = entityMap.get(id)!;
    if (!e.articles.includes(artId)) {
      e.articles.push(artId);
      e.count++;
    }
  }

  articles.forEach(art => {
    const text = (art.title + " " + art.desc).toLowerCase();
    const found: string[] = [];

    // Persons
    for (const [kw, label] of Object.entries(PERSONS)) {
      if (text.includes(kw)) {
        const id = "P_" + label.replace(/\s+/g,"_");
        upsert(id, label, "person", art.id);
        found.push(id);
      }
    }
    // Orgs
    for (const [kw, label] of Object.entries(ORGS)) {
      if (text.includes(kw)) {
        const id = "O_" + label.replace(/\s+/g,"_");
        upsert(id, label, "org", art.id);
        found.push(id);
      }
    }
    // Concepts
    for (const [kw, label] of Object.entries(CONCEPTS)) {
      if (text.includes(kw)) {
        const id = "C_" + label.replace(/\s+/g,"_");
        upsert(id, label, "concept", art.id);
        found.push(id);
      }
    }
    // Locations from geo
    if (art.geo) {
      const id = "L_" + art.geo.name.replace(/\s+/g,"_");
      upsert(id, art.geo.name, "location", art.id);
      found.push(id);
    }

    // Co-occurrence: entities that appear together → linked
    const uniq = [...new Set(found)];
    for (let i = 0; i < uniq.length; i++) {
      for (let j = i+1; j < uniq.length; j++) {
        const a = uniq[i], b = uniq[j];
        const key = [a, b].sort().join("||");
        if (!coMap.has(key)) coMap.set(key, new Map());
        const m = coMap.get(key)!;
        if (!m.has(art.id)) m.set(art.id, art.id);
      }
    }
  });

  // Update risk scores
  entityMap.forEach(e => { e.risk = getRisk(e.label, e.type, e.count); });

  // Build links — only if count >= 2 co-occurrences to reduce noise
  const links: EntityLink[] = [];
  coMap.forEach((artMap, key) => {
    if (artMap.size < 1) return;
    const [src, tgt] = key.split("||");
    if (!entityMap.has(src) || !entityMap.has(tgt)) return;
    links.push({
      source: src, target: tgt,
      strength: Math.min(1, artMap.size / 5),
      articles: [...artMap.keys()],
    });
  });

  // Top 60 entities by count to keep graph readable
  const nodes = [...entityMap.values()]
    .sort((a,b) => b.count - a.count)
    .slice(0, 60);

  const nodeIds = new Set(nodes.map(n => n.id));
  const filteredLinks = links.filter(l => nodeIds.has(l.source) && nodeIds.has(l.target));

  return { nodes, links: filteredLinks };
}
