import type { Article } from "@/app/api/news/route";
import type { EntityGraph } from "@/lib/entityExtractor";
import type { AlertPipeline } from "@/lib/riskEngine";
import type { WarRoomPin, WarRoomMessage } from "@/lib/warRoom";

function timeStr() {
  const n = new Date();
  return n.toUTCString().replace(" GMT", " UTC");
}

function riskColor(score: number) {
  return score >= 70 ? "#FF3344" : score >= 45 ? "#FF8C00" : "#00FFB2";
}

function severityColor(sev: string) {
  const m: Record<string,string> = { critical:"#FF3344", high:"#FF8C00", medium:"#FFB300", low:"#00D2FF" };
  return m[sev] || "#00D2FF";
}

export interface ReportOptions {
  title: string;
  classification: string;
  analystName: string;
  includeSections: {
    executive: boolean;
    riskAssessment: boolean;
    topStories: boolean;
    entityAnalysis: boolean;
    alertSummary: boolean;
    regionRisks: boolean;
    warRoomNotes: boolean;
  };
}

export function generateHTMLReport(
  articles: Article[],
  graph: EntityGraph,
  pipeline: AlertPipeline,
  pins: WarRoomPin[],
  messages: WarRoomMessage[],
  opts: ReportOptions
): string {
  const { riskScore, alerts, regionRisks, topThreats } = pipeline;
  const filteredMessages = messages.filter(m => m.type === "chat").slice(-20);
  const catCounts: Record<string,number> = {};
  articles.forEach(a => { catCounts[a.cat] = (catCounts[a.cat]||0)+1; });

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${opts.title}</title>
<link href="https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=Orbitron:wght@400;700;900&display=swap" rel="stylesheet"/>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { background:#020A10; color:#A8C8D8; font-family:'Share Tech Mono',monospace; padding:40px; max-width:900px; margin:0 auto; }
  .font-display { font-family:'Orbitron',sans-serif; }
  h1,h2,h3 { font-family:'Orbitron',sans-serif; }

  /* Header */
  .report-header { border:1px solid rgba(0,210,255,0.25); padding:28px; margin-bottom:32px; position:relative; }
  .report-header::before { content:''; position:absolute; top:0; left:0; right:0; height:2px; background:linear-gradient(90deg,transparent,#00D2FF,transparent); }
  .classification { display:inline-block; padding:3px 12px; border:1px solid #FFB300; color:#FFB300; font-size:0.6rem; letter-spacing:0.25em; text-transform:uppercase; margin-bottom:16px; }
  .report-title { font-size:1.6rem; font-weight:900; color:#E8F4FF; letter-spacing:0.1em; margin-bottom:8px; }
  .report-meta { display:flex; gap:32px; font-size:0.6rem; color:rgba(168,200,216,0.5); margin-top:16px; }
  .report-meta span { display:flex; flex-direction:column; gap:2px; }
  .report-meta strong { color:#00D2FF; font-size:0.75rem; }

  /* Sections */
  .section { margin-bottom:36px; }
  .section-title { font-size:0.65rem; letter-spacing:0.25em; text-transform:uppercase; color:#00D2FF; border-bottom:1px solid rgba(0,210,255,0.15); padding-bottom:8px; margin-bottom:16px; display:flex; align-items:center; gap:8px; }
  .section-title::before { content:''; display:block; width:4px; height:14px; background:#00D2FF; flex-shrink:0; }

  /* Risk overview */
  .risk-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:1px; background:rgba(0,210,255,0.1); border:1px solid rgba(0,210,255,0.1); }
  .risk-cell { background:#020A10; padding:16px; text-align:center; }
  .risk-val { font-family:'Orbitron',sans-serif; font-size:1.8rem; font-weight:700; }
  .risk-lbl { font-size:0.52rem; color:rgba(168,200,216,0.4); letter-spacing:0.15em; text-transform:uppercase; margin-top:4px; }
  .dim-row { display:flex; align-items:center; gap:12px; margin-bottom:8px; }
  .dim-label { font-size:0.6rem; width:100px; color:rgba(168,200,216,0.6); text-transform:uppercase; }
  .dim-bar { flex:1; height:4px; background:rgba(255,255,255,0.05); border-radius:2px; overflow:hidden; }
  .dim-fill { height:100%; border-radius:2px; }
  .dim-val { font-family:'Orbitron',sans-serif; font-size:0.62rem; font-weight:700; width:24px; text-align:right; }

  /* Alerts */
  .alert-item { border-left:3px solid; padding:12px 16px; margin-bottom:10px; background:rgba(255,255,255,0.02); }
  .alert-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:6px; }
  .alert-badge { font-size:0.52rem; padding:2px 8px; border:1px solid; text-transform:uppercase; letter-spacing:0.12em; font-weight:700; }
  .alert-title { font-size:0.75rem; color:#E8F4FF; font-weight:700; margin-bottom:4px; }
  .alert-desc { font-size:0.62rem; color:rgba(168,200,216,0.6); line-height:1.5; }
  .score-bar { height:2px; background:rgba(255,255,255,0.05); border-radius:1px; margin-top:8px; overflow:hidden; }

  /* Articles */
  .article-item { padding:10px 0; border-bottom:1px solid rgba(0,210,255,0.06); }
  .article-source { font-size:0.52rem; letter-spacing:0.12em; text-transform:uppercase; margin-bottom:4px; }
  .article-title { font-size:0.7rem; color:#DCF0FF; line-height:1.4; margin-bottom:4px; }
  .article-meta { font-size:0.55rem; color:rgba(168,200,216,0.35); }

  /* Entities */
  .entity-grid { display:grid; grid-template-columns:repeat(2,1fr); gap:8px; }
  .entity-item { display:flex; align-items:center; gap:10px; padding:8px; border:1px solid rgba(0,210,255,0.08); }
  .entity-icon { font-size:1rem; flex-shrink:0; }
  .entity-label { font-size:0.65rem; color:#DCF0FF; }
  .entity-sub { font-size:0.52rem; color:rgba(168,200,216,0.35); margin-top:2px; }
  .risk-pill { font-size:0.5rem; padding:1px 5px; border-radius:2px; font-weight:700; margin-left:auto; flex-shrink:0; }

  /* Region table */
  table { width:100%; border-collapse:collapse; font-size:0.62rem; }
  th { text-align:left; padding:6px 10px; border-bottom:1px solid rgba(0,210,255,0.15); font-size:0.52rem; letter-spacing:0.15em; text-transform:uppercase; color:rgba(0,210,255,0.5); }
  td { padding:7px 10px; border-bottom:1px solid rgba(0,210,255,0.05); }
  tr:hover td { background:rgba(0,210,255,0.03); }

  /* Chat */
  .msg-item { padding:8px 0; border-bottom:1px solid rgba(255,255,255,0.04); }
  .msg-analyst { font-size:0.55rem; font-weight:700; margin-bottom:2px; }
  .msg-text { font-size:0.65rem; color:#DCF0FF; line-height:1.4; }
  .msg-time { font-size:0.5rem; color:rgba(168,200,216,0.25); margin-top:2px; }

  /* Footer */
  .report-footer { margin-top:48px; padding-top:16px; border-top:1px solid rgba(0,210,255,0.1); display:flex; justify-content:space-between; font-size:0.52rem; color:rgba(168,200,216,0.25); }

  @media print {
    body { padding:20px; }
    .report-header::before { display:none; }
  }
</style>
</head>
<body>

<!-- HEADER -->
<div class="report-header">
  <div class="classification">${opts.classification}</div>
  <h1 class="report-title">${opts.title}</h1>
  <div style="font-size:0.6rem;color:rgba(0,210,255,0.5);margin-top:4px;letter-spacing:0.1em;">
    SENTINEL GLOBAL INTELLIGENCE PLATFORM // AUTOMATED BRIEF
  </div>
  <div class="report-meta">
    <span><strong>${timeStr()}</strong>GENERATED</span>
    <span><strong>${opts.analystName}</strong>PREPARED BY</span>
    <span><strong>${articles.length}</strong>SOURCE STORIES</span>
    <span><strong>${graph.nodes.length}</strong>ENTITIES TRACKED</span>
    <span><strong style="color:${riskColor(riskScore.overall)}">${riskScore.overall}</strong>RISK INDEX</span>
    <span><strong>${alerts.filter(a=>!a.acknowledged).length}</strong>ACTIVE ALERTS</span>
  </div>
</div>

${opts.includeSections.executive ? `
<!-- EXECUTIVE SUMMARY -->
<div class="section">
  <div class="section-title">Executive Summary</div>
  <p style="font-size:0.68rem;line-height:1.8;color:rgba(168,200,216,0.75);margin-bottom:12px;">
    This intelligence brief covers the period ending <strong style="color:#00D2FF">${timeStr()}</strong>.
    The global risk index currently stands at <strong style="color:${riskColor(riskScore.overall)}">${riskScore.overall}/100</strong>
    (trending <strong style="color:${riskScore.trend==="rising"?"#FF3344":riskScore.trend==="falling"?"#00FFB2":"#8AB8CC"}">${riskScore.trend.toUpperCase()}</strong>),
    with <strong style="color:#FF3344">${alerts.filter(a=>a.severity==="critical").length} critical</strong> and
    <strong style="color:#FF8C00">${alerts.filter(a=>a.severity==="high").length} high-severity</strong> alerts active.
    ${graph.nodes.filter(n=>n.risk>=65).length} high-risk entities have been identified across ${articles.filter(a=>a.geo).length} geolocated events
    spanning ${new Set(articles.filter(a=>a.geo).map(a=>a.geo!.name)).size} distinct locations.
    Primary areas of concern: <strong style="color:#FF3344">${["conflict","politics","economy","tech","disaster"].filter(c=>catCounts[c]>=3).join(", ") || "monitoring"}</strong>.
  </p>
  <div class="risk-grid">
    ${[["CONFLICT","conflict","#FF3344"],["POLITICAL","political","#00D2FF"],["ECONOMIC","economic","#FFB300"],["CYBER","cyber","#CC44FF"],["HUMANITARIAN","humanitarian","#00FFB2"],["OVERALL","overall",""]].map(([lbl,key,col])=>{
      const v = (riskScore as any)[key];
      const c = col || riskColor(v);
      return `<div class="risk-cell"><div class="risk-val" style="color:${c}">${v}</div><div class="risk-lbl">${lbl}</div></div>`;
    }).join("")}
  </div>
</div>` : ""}

${opts.includeSections.riskAssessment ? `
<!-- RISK ASSESSMENT -->
<div class="section">
  <div class="section-title">Risk Dimension Analysis</div>
  ${[
    ["Conflict",     "conflict",     "#FF3344"],
    ["Political",    "political",    "#00D2FF"],
    ["Economic",     "economic",     "#FFB300"],
    ["Cyber",        "cyber",        "#CC44FF"],
    ["Humanitarian", "humanitarian", "#00FFB2"],
  ].map(([label, key, color]) => {
    const val = (riskScore as any)[key];
    return `<div class="dim-row">
      <div class="dim-label">${label}</div>
      <div class="dim-bar"><div class="dim-fill" style="width:${val}%;background:${color}"></div></div>
      <div class="dim-val" style="color:${color}">${val}</div>
    </div>`;
  }).join("")}
  ${topThreats.length > 0 ? `
  <div style="margin-top:20px;">
    <div style="font-size:0.58rem;letter-spacing:0.15em;text-transform:uppercase;color:rgba(0,210,255,0.4);margin-bottom:10px;">Top Threat Entities</div>
    <div class="entity-grid">
      ${topThreats.slice(0,6).map(t=>`
        <div class="entity-item">
          <div>
            <div class="entity-label">${t.label}</div>
            <div class="entity-sub">Risk score: ${t.score}</div>
          </div>
          <div class="risk-pill" style="background:${riskColor(t.score)}22;color:${riskColor(t.score)};border:1px solid ${riskColor(t.score)}55">${t.score}</div>
        </div>`).join("")}
    </div>
  </div>` : ""}
</div>` : ""}

${opts.includeSections.alertSummary ? `
<!-- ALERT SUMMARY -->
<div class="section">
  <div class="section-title">Alert Summary (${alerts.length} Total)</div>
  ${alerts.slice(0,8).map(a => {
    const c = severityColor(a.severity);
    return `<div class="alert-item" style="border-left-color:${c}">
      <div class="alert-header">
        <div style="display:flex;gap:8px;align-items:center">
          <span class="alert-badge" style="color:${c};border-color:${c}55">${a.severity.toUpperCase()}</span>
          <span style="font-size:0.52rem;color:rgba(168,200,216,0.35);text-transform:uppercase;letter-spacing:0.1em">${a.category}</span>
        </div>
        <span style="font-family:'Orbitron',sans-serif;font-size:0.7rem;font-weight:700;color:${c}">${a.score}</span>
      </div>
      <div class="alert-title">${a.title}</div>
      <div class="alert-desc">${a.description}</div>
      <div class="score-bar"><div style="height:100%;width:${a.score}%;background:${c};border-radius:1px"></div></div>
    </div>`;
  }).join("")}
</div>` : ""}

${opts.includeSections.topStories ? `
<!-- TOP STORIES -->
<div class="section">
  <div class="section-title">Top Intelligence Stories (${articles.length} total)</div>
  ${articles.slice(0,12).map(a => {
    const srcColors: Record<string,string> = { bbc:"#FF6677", guardian:"#00D2FF", aljazeera:"#FFB300", reuters:"#00FFB2" };
    const col = srcColors[a.source] || "#00D2FF";
    return `<div class="article-item">
      <div class="article-source" style="color:${col}">${a.sourceName} ${a.geo ? `▸ ${a.geo.name}` : ""}</div>
      <div class="article-title">${a.title}</div>
      <div class="article-meta">${new Date(a.pubDate).toUTCString().slice(0,25)} · ${a.cat.toUpperCase()}${a.link && a.link!="#" ? ` · <a href="${a.link}" style="color:#00D2FF">${a.link.slice(0,60)}...</a>` : ""}</div>
    </div>`;
  }).join("")}
</div>` : ""}

${opts.includeSections.entityAnalysis ? `
<!-- ENTITY ANALYSIS -->
<div class="section">
  <div class="section-title">Entity Resolution (${graph.nodes.length} entities, ${graph.links.length} connections)</div>
  <div class="entity-grid">
    ${graph.nodes.slice(0,16).map(e => {
      const typeColors: Record<string,string> = { person:"#00D2FF", org:"#FFB300", location:"#00FFB2", concept:"#CC44FF" };
      const typeIcons:  Record<string,string> = { person:"◉", org:"⬡", location:"▸", concept:"◈" };
      const col = typeColors[e.type] || "#00D2FF";
      return `<div class="entity-item">
        <div class="entity-icon" style="color:${col}">${typeIcons[e.type] || "•"}</div>
        <div>
          <div class="entity-label">${e.label}</div>
          <div class="entity-sub">${e.type.toUpperCase()} · ${e.count} mentions</div>
        </div>
        <div class="risk-pill" style="background:${riskColor(e.risk)}22;color:${riskColor(e.risk)};border:1px solid ${riskColor(e.risk)}44">${e.risk}</div>
      </div>`;
    }).join("")}
  </div>
</div>` : ""}

${opts.includeSections.regionRisks ? `
<!-- REGION RISKS -->
<div class="section">
  <div class="section-title">Regional Risk Assessment</div>
  <table>
    <thead><tr>
      <th>Region</th><th>Risk Score</th><th>Stories</th><th>Dominant Category</th><th>Coordinates</th>
    </tr></thead>
    <tbody>
      ${regionRisks.slice(0,15).map(r => `
        <tr>
          <td style="color:#DCF0FF;font-weight:700">${r.name}</td>
          <td style="color:${riskColor(r.score)};font-family:'Orbitron',sans-serif;font-weight:700">${r.score}</td>
          <td style="color:rgba(168,200,216,0.5)">${r.articles}</td>
          <td style="text-transform:uppercase;font-size:0.55rem;color:rgba(168,200,216,0.5)">${r.dominant}</td>
          <td style="font-size:0.55rem;color:rgba(168,200,216,0.35)">${r.lat.toFixed(1)}°, ${r.lon.toFixed(1)}°</td>
        </tr>`).join("")}
    </tbody>
  </table>
</div>` : ""}

${opts.includeSections.warRoomNotes && filteredMessages.length > 0 ? `
<!-- WAR ROOM NOTES -->
<div class="section">
  <div class="section-title">War Room Analyst Notes (${filteredMessages.length})</div>
  ${filteredMessages.map(m => `
    <div class="msg-item">
      <div class="msg-analyst" style="color:${m.color}">ANALYST ${m.analystName}</div>
      <div class="msg-text">${m.text}</div>
      <div class="msg-time">${new Date(m.ts).toUTCString().slice(0,25)}</div>
    </div>`).join("")}
</div>` : ""}

${pins.length > 0 ? `
<!-- WAR ROOM PINS -->
<div class="section">
  <div class="section-title">Analyst Pins (${pins.length})</div>
  <table>
    <thead><tr><th>Label</th><th>Type</th><th>Note</th><th>Analyst</th><th>Location</th></tr></thead>
    <tbody>
      ${pins.map(p => `
        <tr>
          <td style="color:#DCF0FF">${p.label}</td>
          <td style="text-transform:uppercase;font-size:0.55rem">${p.type}</td>
          <td style="color:rgba(168,200,216,0.5)">${p.note || "—"}</td>
          <td style="color:${p.color}">${p.analystName}</td>
          <td style="font-size:0.55rem;color:rgba(168,200,216,0.35)">${p.lat.toFixed(2)}°, ${p.lon.toFixed(2)}°</td>
        </tr>`).join("")}
    </tbody>
  </table>
</div>` : ""}

<!-- FOOTER -->
<div class="report-footer">
  <span>SENTINEL GLOBAL INTELLIGENCE PLATFORM v3.4 — PHASE 4</span>
  <span>${opts.classification} // HANDLE VIA AUTHORIZED CHANNELS ONLY</span>
  <span>GENERATED: ${timeStr()}</span>
</div>

</body>
</html>`;
}

export function downloadReport(html: string, filename: string) {
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}
