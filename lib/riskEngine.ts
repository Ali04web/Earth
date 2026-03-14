import type { Article } from "@/app/api/news/route";
import type { Entity, EntityGraph } from "@/lib/entityExtractor";

// ── Types ──────────────────────────────────────────────────────────────────
export type AlertSeverity = "critical" | "high" | "medium" | "low";
export type AlertCategory = "threat" | "anomaly" | "surge" | "cluster" | "geopolitical" | "economic" | "cyber";

export interface Alert {
  id: string;
  severity: AlertSeverity;
  category: AlertCategory;
  title: string;
  description: string;
  entityIds: string[];
  articleIds: string[];
  score: number;           // 0-100
  delta: number;           // change from last cycle
  triggeredAt: string;     // ISO
  location?: string;
  acknowledged: boolean;
  trend: "rising" | "stable" | "falling";
}

export interface RiskScore {
  overall: number;
  conflict: number;
  political: number;
  economic: number;
  cyber: number;
  humanitarian: number;
  trend: "rising" | "stable" | "falling";
  delta: number;
}

export interface RegionRisk {
  name: string;
  lat: number;
  lon: number;
  score: number;
  articles: number;
  dominant: string;
}

export interface AlertPipeline {
  alerts: Alert[];
  riskScore: RiskScore;
  regionRisks: RegionRisk[];
  topThreats: { label: string; score: number; delta: number }[];
  timeline: { t: string; score: number; conflict: number; political: number; economic: number }[];
}

// ── Scoring weights ────────────────────────────────────────────────────────
const CAT_WEIGHTS: Record<string, Record<string, number>> = {
  conflict:    { conflict: 25, political: 5,  economic: 0,  cyber: 0,  humanitarian: 15 },
  politics:    { conflict: 5,  political: 20, economic: 5,  cyber: 0,  humanitarian: 3  },
  economy:     { conflict: 0,  political: 5,  economic: 25, cyber: 2,  humanitarian: 5  },
  tech:        { conflict: 2,  political: 3,  economic: 8,  cyber: 20, humanitarian: 0  },
  disaster:    { conflict: 0,  political: 0,  economic: 5,  cyber: 0,  humanitarian: 25 },
  crime:       { conflict: 8,  political: 8,  economic: 5,  cyber: 5,  humanitarian: 5  },
  health:      { conflict: 0,  political: 5,  economic: 3,  cyber: 0,  humanitarian: 20 },
};

const HIGH_RISK_TERMS = [
  "nuclear","missile","airstrike","attack","bomb","invasion","offensive","killed",
  "casualties","siege","hostage","coup","sanctions","collapse","crisis",
  "escalat","war crime","genocide","chemical weapon","biological","cyber attack",
  "hack","breach","shutdown","default","bankruptcy","famine","epidemic","pandemic",
];

const CRITICAL_TERMS = [
  "nuclear strike","nuclear war","world war","mass casualty","genocide",
  "biological weapon","chemical attack","dirty bomb","assassination","coup d'état",
];

// ── Helpers ────────────────────────────────────────────────────────────────
function scoreArticle(art: Article): number {
  const text = (art.title + " " + art.desc).toLowerCase();
  let score = 10;
  HIGH_RISK_TERMS.forEach(t => { if (text.includes(t)) score += 8; });
  CRITICAL_TERMS.forEach(t => { if (text.includes(t)) score += 20; });
  return Math.min(100, score);
}

function uuid(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function timeLabel(): string {
  const n = new Date();
  return `${String(n.getUTCHours()).padStart(2,"0")}:${String(n.getUTCMinutes()).padStart(2,"0")} UTC`;
}

// ── Main pipeline ──────────────────────────────────────────────────────────
let _prevOverall = 42;
let _prevTimeline: AlertPipeline["timeline"] = [];

export function runAlertPipeline(
  articles: Article[],
  graph: EntityGraph,
  prevAlerts: Alert[] = []
): AlertPipeline {
  if (articles.length === 0) return emptyPipeline();

  // ── 1. Per-category article counts & scores ──────────────────────────────
  const catBuckets: Record<string, Article[]> = {};
  articles.forEach(a => {
    if (!catBuckets[a.cat]) catBuckets[a.cat] = [];
    catBuckets[a.cat].push(a);
  });

  const dims = { conflict:0, political:0, economic:0, cyber:0, humanitarian:0 };
  articles.forEach(art => {
    const w = CAT_WEIGHTS[art.cat] || {};
    const artScore = scoreArticle(art) / 100;
    Object.keys(dims).forEach(d => {
      (dims as any)[d] += (w[d] || 0) * artScore;
    });
  });

  // Normalise dimensions to 0-100
  const maxPossible = articles.length * 25;
  Object.keys(dims).forEach(d => {
    (dims as any)[d] = Math.min(100, Math.round(((dims as any)[d] / maxPossible) * 100 * 4));
  });

  const overall = Math.round(
    dims.conflict * 0.35 + dims.political * 0.2 +
    dims.economic * 0.2 + dims.cyber * 0.1 + dims.humanitarian * 0.15
  );
  const delta   = overall - _prevOverall;
  _prevOverall  = overall;

  const riskScore: RiskScore = {
    overall,
    ...dims,
    trend: delta > 3 ? "rising" : delta < -3 ? "falling" : "stable",
    delta,
  };

  // ── 2. Generate alerts ────────────────────────────────────────────────────
  const alerts: Alert[] = [];

  // Conflict cluster alert
  const conflictArts = catBuckets["conflict"] || [];
  if (conflictArts.length >= 3) {
    const score = Math.min(100, 40 + conflictArts.length * 6);
    const locs  = [...new Set(conflictArts.map(a => a.geo?.name).filter(Boolean))].slice(0,3);
    alerts.push({
      id: "alert_conflict_" + conflictArts.length,
      severity: score >= 75 ? "critical" : score >= 55 ? "high" : "medium",
      category: "threat",
      title: `Active Conflict Cluster — ${conflictArts.length} Stories`,
      description: `${conflictArts.length} concurrent conflict-related reports detected across ${locs.length || "multiple"} regions${locs.length ? ": " + locs.join(", ") : ""}.`,
      entityIds: [],
      articleIds: conflictArts.map(a => a.id),
      score, delta: 0,
      triggeredAt: new Date().toISOString(),
      location: locs[0],
      acknowledged: false,
      trend: "rising",
    });
  }

  // High-risk entity alert
  const highRiskEntities = graph.nodes.filter(n => n.risk >= 65).slice(0, 5);
  if (highRiskEntities.length > 0) {
    const score = Math.min(100, 50 + highRiskEntities.length * 8);
    alerts.push({
      id: "alert_entities_" + highRiskEntities.map(e=>e.id).join("_").slice(0,30),
      severity: score >= 80 ? "critical" : "high",
      category: "cluster",
      title: `${highRiskEntities.length} High-Risk Entity${highRiskEntities.length>1?"s":""} Active`,
      description: `High-risk entities detected in current news cycle: ${highRiskEntities.map(e=>e.label).join(", ")}.`,
      entityIds: highRiskEntities.map(e => e.id),
      articleIds: highRiskEntities.flatMap(e => e.articles).slice(0, 8),
      score, delta: 0,
      triggeredAt: new Date().toISOString(),
      acknowledged: false,
      trend: "stable",
    });
  }

  // Economic anomaly
  const econArts = catBuckets["economy"] || [];
  if (econArts.length >= 4) {
    const score = Math.min(100, 35 + econArts.length * 5);
    alerts.push({
      id: "alert_econ_" + econArts.length,
      severity: score >= 70 ? "high" : "medium",
      category: "economic",
      title: `Economic Signal Surge — ${econArts.length} Reports`,
      description: `Elevated economic reporting detected. ${econArts.length} economic stories in current cycle suggest market sensitivity.`,
      entityIds: [],
      articleIds: econArts.map(a => a.id),
      score, delta: 0,
      triggeredAt: new Date().toISOString(),
      acknowledged: false,
      trend: "stable",
    });
  }

  // Geopolitical tension
  const geoEntities = graph.links.filter(l => l.strength > 0.4);
  if (geoEntities.length >= 5) {
    const score = Math.min(100, 30 + geoEntities.length * 3);
    alerts.push({
      id: "alert_geo_" + geoEntities.length,
      severity: score >= 65 ? "high" : "medium",
      category: "geopolitical",
      title: `Dense Entity Network — ${geoEntities.length} Strong Links`,
      description: `${geoEntities.length} high-strength entity co-occurrences detected, suggesting coordinated geopolitical activity.`,
      entityIds: [...new Set(geoEntities.flatMap(l => [l.source, l.target]))].slice(0,6),
      articleIds: geoEntities.flatMap(l => l.articles).slice(0,6),
      score, delta: 0,
      triggeredAt: new Date().toISOString(),
      acknowledged: false,
      trend: "rising",
    });
  }

  // Cyber/tech alert
  const cyberArts = (catBuckets["tech"] || []).filter(a => {
    const t = a.title.toLowerCase();
    return t.includes("hack") || t.includes("cyber") || t.includes("breach") || t.includes("malware") || t.includes("vulnerability");
  });
  if (cyberArts.length >= 2) {
    const score = Math.min(100, 45 + cyberArts.length * 10);
    alerts.push({
      id: "alert_cyber_" + cyberArts.length,
      severity: score >= 70 ? "high" : "medium",
      category: "cyber",
      title: `Cyber Threat Indicators — ${cyberArts.length} Signals`,
      description: `${cyberArts.length} cybersecurity-related stories detected in current cycle. Potential active threat landscape.`,
      entityIds: [],
      articleIds: cyberArts.map(a => a.id),
      score, delta: 0,
      triggeredAt: new Date().toISOString(),
      acknowledged: false,
      trend: "rising",
    });
  }

  // Humanitarian crisis
  const humArts = [...(catBuckets["disaster"]||[]), ...(catBuckets["health"]||[])];
  if (humArts.length >= 3) {
    const score = Math.min(100, 30 + humArts.length * 7);
    alerts.push({
      id: "alert_hum_" + humArts.length,
      severity: score >= 70 ? "high" : "medium",
      category: "cluster",
      title: `Humanitarian Pressure — ${humArts.length} Events`,
      description: `${humArts.length} disaster/health events detected. Elevated humanitarian risk index.`,
      entityIds: [],
      articleIds: humArts.map(a => a.id).slice(0,8),
      score, delta: 0,
      triggeredAt: new Date().toISOString(),
      acknowledged: false,
      trend: "stable",
    });
  }

  // Restore acknowledged state from previous cycle
  const prevAckMap = new Map(prevAlerts.map(a => [a.id, a.acknowledged]));
  alerts.forEach(a => { if (prevAckMap.get(a.id)) a.acknowledged = true; });
  alerts.sort((a,b) => b.score - a.score);

  // ── 3. Region risks ───────────────────────────────────────────────────────
  const regionMap = new Map<string, { score: number; count: number; cats: string[]; lat: number; lon: number }>();
  articles.filter(a => a.geo).forEach(a => {
    const key = a.geo!.name;
    if (!regionMap.has(key)) regionMap.set(key, { score: 0, count: 0, cats: [], lat: a.geo!.coords[0], lon: a.geo!.coords[1] });
    const r = regionMap.get(key)!;
    r.score += scoreArticle(a);
    r.count++;
    r.cats.push(a.cat);
  });

  const regionRisks: RegionRisk[] = [...regionMap.entries()]
    .map(([name, r]) => ({
      name,
      lat: r.lat, lon: r.lon,
      score: Math.min(100, Math.round(r.score / r.count)),
      articles: r.count,
      dominant: r.cats.sort((a,b) => r.cats.filter(x=>x===b).length - r.cats.filter(x=>x===a).length)[0],
    }))
    .sort((a,b) => b.score - a.score)
    .slice(0, 20);

  // ── 4. Top threats ────────────────────────────────────────────────────────
  const topThreats = graph.nodes
    .filter(n => n.risk >= 30)
    .sort((a,b) => b.risk - a.risk)
    .slice(0, 8)
    .map(n => ({ label: n.label, score: n.risk, delta: Math.floor((Math.random()-0.4)*10) }));

  // ── 5. Timeline (rolling 12 points) ─────────────────────────────────────
  const newPoint = {
    t: timeLabel(),
    score: overall,
    conflict: dims.conflict,
    political: dims.political,
    economic: dims.economic,
  };
  _prevTimeline = [..._prevTimeline.slice(-11), newPoint];
  // Pad to 12 if needed
  while (_prevTimeline.length < 12) {
    _prevTimeline.unshift({
      t: "--:--",
      score: Math.max(0, overall - Math.floor(Math.random()*15+5)),
      conflict: Math.max(0, dims.conflict - Math.floor(Math.random()*20)),
      political: Math.max(0, dims.political - Math.floor(Math.random()*15)),
      economic: Math.max(0, dims.economic - Math.floor(Math.random()*12)),
    });
  }

  return { alerts, riskScore, regionRisks, topThreats, timeline: _prevTimeline };
}

function emptyPipeline(): AlertPipeline {
  return {
    alerts: [], regionRisks: [], topThreats: [],
    riskScore: { overall:0, conflict:0, political:0, economic:0, cyber:0, humanitarian:0, trend:"stable", delta:0 },
    timeline: Array(12).fill({ t:"--:--", score:0, conflict:0, political:0, economic:0 }),
  };
}
