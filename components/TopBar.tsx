"use client";
import { useEffect, useState } from "react";

interface Props {
  fetchStatus: string;
  articleCount: number;
  onRefresh: () => void;
}

export default function TopBar({ fetchStatus, articleCount, onRefresh }: Props) {
  const [clock, setClock] = useState("--:--:-- UTC");

  useEffect(() => {
    const tick = () => {
      const n = new Date();
      const pad = (v: number) => String(v).padStart(2,"0");
      setClock(`${pad(n.getUTCHours())}:${pad(n.getUTCMinutes())}:${pad(n.getUTCSeconds())} UTC`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <header className="flex items-center justify-between px-4 h-12 flex-shrink-0 bg-[rgba(1,8,16,0.98)] border-b border-cyan-500/15 z-50">
      {/* Logo */}
      <div className="flex items-center gap-2.5 font-display text-[0.95rem] font-black tracking-[0.28em] text-cyan-400 glow-cyan">
        <div className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse-dot" />
        SENTINEL
        <span className="text-[0.48rem] text-cyan-400/40 font-normal tracking-[0.22em]">
          // OSINT GLOBE — PHASE 1
        </span>
      </div>

      {/* Status */}
      <div className="flex items-center gap-3">
        <span className="text-[0.58rem] tracking-widest animate-blink" style={{ color: "#FFB300" }}>
          {fetchStatus}
        </span>
        <span className="text-[0.55rem] text-cyan-400/40 tracking-wider">
          {articleCount} STORIES
        </span>
        <button
          onClick={onRefresh}
          className="font-mono text-[0.58rem] bg-cyan-500/[0.08] border border-cyan-500/30 text-cyan-400 px-3 py-0.5 rounded-sm tracking-widest transition-all hover:bg-cyan-500/15 hover:shadow-[0_0_10px_rgba(0,210,255,0.2)]"
        >
          ↻ REFRESH
        </button>
        <span className="text-[0.55rem] px-2 py-0.5 rounded-sm border font-bold tracking-widest uppercase border-emerald-400 text-emerald-400 animate-blink-border">
          ● LIVE
        </span>
        <span className="text-[0.55rem] px-2 py-0.5 rounded-sm border font-bold tracking-widest uppercase border-amber-400 text-amber-400">
          TS/SCI
        </span>
        <span className="font-display text-[0.7rem] text-slate-200 tracking-widest">{clock}</span>
      </div>
    </header>
  );
}
