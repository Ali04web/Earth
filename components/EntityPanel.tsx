"use client";
import type { Entity, EntityGraph } from "@/lib/entityExtractor";
import type { Article } from "@/app/api/news/route";
import { CAT_HEX } from "@/lib/constants";

interface Props {
  graph: EntityGraph;
  selected: Entity | null;
  articles: Article[];
  onArticleClick: (art: Article) => void;
  onEntityClick: (e: Entity) => void;
}

const TYPE_COLORS: Record<string, string> = {
  person:   "#00D2FF",
  org:      "#FFB300",
  location: "#00FFB2",
  concept:  "#CC44FF",
};
const TYPE_ICONS: Record<string, string> = {
  person: "◉", org: "⬡", location: "▸", concept: "◈",
};

function RiskBar({ risk }: { risk: number }) {
  const color = risk >= 70 ? "#FF3344" : risk >= 40 ? "#FF8C00" : "#00FFB2";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1 bg-white/5 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700"
          style={{ width: `${risk}%`, background: color }} />
      </div>
      <span className="text-[0.55rem] font-display font-bold" style={{ color }}>{risk}</span>
    </div>
  );
}

export default function EntityPanel({ graph, selected, articles, onArticleClick, onEntityClick }: Props) {
  const topEntities = [...graph.nodes].sort((a,b) => b.count - a.count).slice(0, 12);
  const connections = selected
    ? graph.links
        .filter(l => l.source === selected.id || l.target === selected.id)
        .map(l => {
          const otherId = l.source === selected.id ? l.target : l.source;
          return { entity: graph.nodes.find(n => n.id === otherId), strength: l.strength };
        })
        .filter(c => c.entity)
        .sort((a,b) => b.strength - a.strength)
        .slice(0, 8)
    : [];

  const relatedArticles = selected
    ? articles.filter(a => selected.articles.includes(a.id)).slice(0, 5)
    : [];

  return (
    <aside className="w-[280px] flex-shrink-0 flex flex-col overflow-hidden border-l border-cyan-500/15 bg-[rgba(3,12,22,0.95)]">

      {selected ? (
        <>
          {/* Entity Detail Header */}
          <div className="px-3 py-3 border-b border-cyan-500/15 bg-cyan-500/[0.04]">
            <div className="flex items-start gap-2">
              <div className="w-8 h-8 rounded-sm flex items-center justify-center text-base flex-shrink-0 mt-0.5"
                style={{ background: (TYPE_COLORS[selected.type] || "#00D2FF") + "22",
                         border: `1px solid ${TYPE_COLORS[selected.type]}44`,
                         color: TYPE_COLORS[selected.type] }}>
                {TYPE_ICONS[selected.type]}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-display text-[0.7rem] text-slate-100 font-bold leading-tight truncate">
                  {selected.label}
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-[0.52rem] uppercase tracking-widest"
                    style={{ color: TYPE_COLORS[selected.type] }}>
                    {selected.type}
                  </span>
                  <span className="text-white/20">·</span>
                  <span className="text-[0.52rem] text-white/40">{selected.count} mentions</span>
                </div>
              </div>
              <button
                onClick={() => onEntityClick(null as any)}
                className="text-white/20 hover:text-white/60 text-base leading-none mt-0.5 flex-shrink-0">
                ✕
              </button>
            </div>
            <div className="mt-2.5">
              <div className="text-[0.5rem] text-white/30 tracking-widest uppercase mb-1">RISK SCORE</div>
              <RiskBar risk={selected.risk} />
            </div>
          </div>

          {/* Connected Entities */}
          {connections.length > 0 && (
            <div className="border-b border-cyan-500/10">
              <div className="flex items-center justify-between px-3 py-2 bg-cyan-500/[0.03]">
                <span className="font-display text-[0.54rem] tracking-[0.18em] text-cyan-400/70 uppercase">
                  ⬡ Connections
                </span>
                <span className="text-[0.52rem] text-white/20">{connections.length}</span>
              </div>
              <div className="overflow-y-auto custom-scroll max-h-[140px]">
                {connections.map(({ entity: e, strength }) => e && (
                  <div key={e.id}
                    onClick={() => onEntityClick(e!)}
                    className="flex items-center gap-2 px-3 py-1.5 hover:bg-cyan-500/[0.06] cursor-pointer border-b border-white/[0.03] transition-colors">
                    <span className="text-[0.7rem] flex-shrink-0"
                      style={{ color: TYPE_COLORS[e.type] }}>{TYPE_ICONS[e.type]}</span>
                    <span className="text-[0.62rem] text-slate-300 flex-1 truncate">{e.label}</span>
                    <div className="w-12 h-0.5 bg-white/5 rounded-full flex-shrink-0">
                      <div className="h-full rounded-full bg-cyan-400/50"
                        style={{ width: `${strength*100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Related Articles */}
          <div className="flex-1 overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-3 py-2 bg-cyan-500/[0.03] border-b border-cyan-500/10">
              <span className="font-display text-[0.54rem] tracking-[0.18em] text-cyan-400/70 uppercase">
                ◈ Related Stories
              </span>
              <span className="text-[0.52rem] text-white/20">{relatedArticles.length}</span>
            </div>
            <div className="flex-1 overflow-y-auto custom-scroll">
              {relatedArticles.map(art => (
                <div key={art.id}
                  onClick={() => onArticleClick(art)}
                  className="px-3 py-2 border-b border-white/[0.03] cursor-pointer hover:bg-cyan-500/[0.05] transition-colors">
                  <div className="text-[0.62rem] text-slate-200 leading-snug mb-1">{art.title}</div>
                  <div className="flex items-center gap-2">
                    {art.geo && <span className="text-[0.52rem] text-amber-400">▸ {art.geo.name}</span>}
                    <span className="text-[0.5rem] ml-auto" style={{ color: CAT_HEX[art.cat] || "#00D2FF" }}>
                      [{art.cat.toUpperCase()}]
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      ) : (
        <>
          {/* Top Entities List */}
          <div className="flex items-center justify-between px-3 py-2 bg-cyan-500/[0.04] border-b border-cyan-500/15">
            <span className="font-display text-[0.58rem] tracking-[0.2em] text-cyan-400 uppercase">
              ◉ Top Entities
            </span>
            <span className="text-[0.55rem] text-white/25">{graph.nodes.length} total</span>
          </div>

          <div className="flex-1 overflow-y-auto custom-scroll">
            {topEntities.map((e, i) => (
              <div key={e.id}
                onClick={() => onEntityClick(e)}
                className="flex items-center gap-2 px-3 py-2 border-b border-white/[0.03] cursor-pointer hover:bg-cyan-500/[0.06] transition-colors">
                <span className="text-[0.52rem] text-white/20 font-display w-4 flex-shrink-0">
                  {i+1}
                </span>
                <span className="text-[0.75rem] flex-shrink-0" style={{ color: TYPE_COLORS[e.type] }}>
                  {TYPE_ICONS[e.type]}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-[0.62rem] text-slate-200 truncate">{e.label}</div>
                  <RiskBar risk={e.risk} />
                </div>
                <span className="text-[0.58rem] text-cyan-400/60 font-display flex-shrink-0">
                  {e.count}
                </span>
              </div>
            ))}
          </div>

          {/* Legend */}
          <div className="px-3 py-2.5 border-t border-cyan-500/10 flex-shrink-0">
            <div className="font-display text-[0.5rem] tracking-[0.18em] text-cyan-400/35 uppercase mb-2">
              Entity Types
            </div>
            <div className="grid grid-cols-2 gap-1">
              {Object.entries(TYPE_ICONS).map(([type, icon]) => (
                <div key={type} className="flex items-center gap-1.5 text-[0.56rem]">
                  <span style={{ color: TYPE_COLORS[type] }}>{icon}</span>
                  <span className="text-white/40 capitalize">{type}</span>
                </div>
              ))}
            </div>
            <div className="mt-2 pt-2 border-t border-white/5">
              <div className="font-display text-[0.5rem] tracking-[0.18em] text-white/20 uppercase mb-1">Risk</div>
              <div className="flex gap-2 text-[0.52rem]">
                <span style={{ color:"#00FFB2" }}>■ Low</span>
                <span style={{ color:"#FF8C00" }}>■ Med</span>
                <span style={{ color:"#FF3344" }}>■ High</span>
              </div>
            </div>
          </div>
        </>
      )}
    </aside>
  );
}
