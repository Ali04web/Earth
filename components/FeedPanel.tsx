"use client";
import { useState } from "react";
import type { Article } from "@/app/api/news/route";
import { SOURCE_STYLES, CATEGORIES } from "@/lib/constants";
import { CAT_HEX } from "@/lib/constants";

interface Props {
  articles: Article[];
  activeSources: Set<string>;
  onSourceToggle: (src: string) => void;
  onArticleClick: (art: Article) => void;
}

function timeAgo(iso: string) {
  const sec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (sec < 60) return sec + "s ago";
  if (sec < 3600) return Math.floor(sec/60) + "m ago";
  if (sec < 86400) return Math.floor(sec/3600) + "h ago";
  return Math.floor(sec/86400) + "d ago";
}

export default function FeedPanel({ articles, activeSources, onSourceToggle, onArticleClick }: Props) {
  const [activeCat, setActiveCat] = useState("all");
  const [selected, setSelected] = useState<string | null>(null);

  const filtered = articles.filter(a =>
    activeSources.has(a.source) &&
    (activeCat === "all" || a.cat === activeCat)
  );

  const conflictCount = articles.filter(a => a.cat === "conflict").length;
  const pinnedCount   = articles.filter(a => a.geo).length;

  return (
    <aside className="w-[300px] flex-shrink-0 flex flex-col overflow-hidden border-r border-cyan-500/15 bg-[rgba(3,12,22,0.95)]">

      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-cyan-500/[0.04] border-b border-cyan-500/15">
        <span className="font-display text-[0.58rem] tracking-[0.2em] text-cyan-400 uppercase">⬡ Live OSINT Feed</span>
        <span className="text-[0.58rem] px-1.5 py-0.5 bg-cyan-500/10 border border-cyan-500/15 text-cyan-400/60 rounded-sm">
          {filtered.length} stories
        </span>
      </div>

      {/* Source toggles */}
      <div className="flex gap-1.5 px-2.5 py-2 border-b border-cyan-500/10 flex-wrap">
        {(["bbc","guardian","aljazeera","reuters"] as const).map(src => (
          <button
            key={src}
            onClick={() => onSourceToggle(src)}
            className={`text-[0.52rem] px-2 py-0.5 rounded-sm border font-mono tracking-widest uppercase transition-all ${
              activeSources.has(src)
                ? SOURCE_STYLES[src]
                : "border-white/10 text-white/20"
            }`}
          >
            {src === "aljazeera" ? "AJZ" : src.slice(0,3).toUpperCase()}
          </button>
        ))}
      </div>

      {/* Category filters */}
      <div className="flex gap-1 px-2.5 py-1.5 border-b border-cyan-500/10 flex-wrap">
        {CATEGORIES.map(cat => (
          <button
            key={cat}
            onClick={() => setActiveCat(cat)}
            className={`text-[0.5rem] px-1.5 py-0.5 rounded-sm border font-mono tracking-wider uppercase transition-all ${
              activeCat === cat
                ? "border-cyan-400 text-cyan-400 bg-cyan-500/10"
                : "border-white/10 text-white/30 hover:border-cyan-500/40 hover:text-cyan-400/60"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Feed list */}
      <div className="flex-1 overflow-y-auto custom-scroll">
        {filtered.length === 0 ? (
          <div className="p-4 text-center text-[0.6rem] text-white/20 mt-8">
            NO STORIES MATCH FILTER
          </div>
        ) : filtered.map((art, i) => (
          <div
            key={art.id}
            onClick={() => { setSelected(art.id); onArticleClick(art); }}
            className={`px-3 py-2.5 border-b border-cyan-500/[0.05] cursor-pointer transition-all animate-slide-in
              ${selected === art.id
                ? "bg-cyan-500/10 border-l-2 border-l-cyan-400"
                : "hover:bg-cyan-500/[0.05]"
              }`}
            style={{ animationDelay: `${Math.min(i,10)*0.03}s` }}
          >
            <div className="flex items-center justify-between mb-1">
              <span className={`text-[0.52rem] px-1.5 py-0.5 rounded-sm font-bold tracking-wider uppercase ${SOURCE_STYLES[art.source]}`}>
                {art.sourceName}
              </span>
              <span className="text-[0.52rem] text-white/25">{timeAgo(art.pubDate)}</span>
            </div>
            <div className="text-[0.65rem] text-slate-200 leading-snug mb-1">{art.title}</div>
            <div className="text-[0.55rem] flex items-center gap-1">
              {art.geo
                ? <span className="text-amber-400">▸ {art.geo.name}</span>
                : <span className="text-white/20">▸ Location unknown</span>
              }
              <span
                className="ml-1 text-[0.5rem]"
                style={{ color: CAT_HEX[art.cat] || "#00D2FF" }}
              >
                [{art.cat.toUpperCase()}]
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-3 border-t border-cyan-500/15">
        {[
          { val: articles.length, label: "Stories", cls: "text-cyan-400" },
          { val: conflictCount,   label: "Conflict", cls: "text-red-400" },
          { val: pinnedCount,     label: "Pinned",   cls: "text-amber-400" },
        ].map(({ val, label, cls }) => (
          <div key={label} className="bg-[rgba(3,12,22,0.95)] py-2 text-center border-r last:border-r-0 border-cyan-500/10">
            <div className={`font-display text-lg font-bold leading-none ${cls}`}>{val}</div>
            <div className="text-[0.5rem] text-white/25 tracking-widest uppercase mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="px-3 py-2 border-t border-cyan-500/10">
        <div className="font-display text-[0.48rem] tracking-[0.18em] text-cyan-400/35 uppercase mb-1.5">Data Sources</div>
        {[
          { id:"bbc",       name:"BBC World",    color:"#FF6677" },
          { id:"guardian",  name:"The Guardian", color:"#00D2FF" },
          { id:"aljazeera", name:"Al Jazeera",   color:"#FFB300" },
          { id:"reuters",   name:"Reuters",      color:"#00FFB2" },
        ].map(s => (
          <div key={s.id} className="flex items-center gap-2 text-[0.58rem] mb-0.5">
            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: s.color }} />
            <span className="text-slate-300 flex-1">{s.name}</span>
            <span className="text-white/25">{articles.filter(a=>a.source===s.id).length}</span>
          </div>
        ))}
      </div>
    </aside>
  );
}
