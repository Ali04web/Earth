"use client";
import { useEffect, useState } from "react";

interface Props {
  fetchStatus: string;
  articleCount: number;
  entityCount?: number;
  connectionCount?: number;
  riskScore?: number;
  activeAlerts?: number;
  onRefresh: () => void;
  onReport?: () => void;
  onToggleFeed?: () => void;
}

export default function TopBar({
  fetchStatus, articleCount, entityCount = 0,
  connectionCount = 0, riskScore = 0, activeAlerts = 0,
  onRefresh, onReport, onToggleFeed
}: Props) {
  const [clock, setClock] = useState("--:--:-- UTC");

  useEffect(() => {
    const tick = () => {
      const n = new Date();
      const p = (v: number) => String(v).padStart(2, "0");
      setClock(`${p(n.getUTCHours())}:${p(n.getUTCMinutes())}:${p(n.getUTCSeconds())} UTC`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const riskColor = riskScore >= 70 ? "#FF3344" : riskScore >= 45 ? "#FFB300" : "#00FFB2";

  return (
    <header className="flex items-center justify-between px-2 sm:px-4 h-12 flex-shrink-0 bg-[rgba(1,8,16,0.98)] border-b border-cyan-500/15 z-50">
      <div className="flex items-center gap-2">
        {onToggleFeed && (
          <button onClick={onToggleFeed} className="md:hidden text-cyan-400 text-lg px-1" aria-label="Menu">
            ☰
          </button>
        )}
        <span className="font-display text-[0.82rem] sm:text-[0.88rem] font-black tracking-[0.28em] text-cyan-400 glow-cyan">
          <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-pulse-dot inline-block mr-1.5" />
          SENTINEL
        </span>
        <span className="hidden lg:inline text-[0.42rem] text-cyan-400/35 font-normal tracking-[0.2em]">
          // GLOBAL INTELLIGENCE PLATFORM
        </span>
      </div>

      <div className="hidden md:flex items-center gap-4">
        {[
          { label:"STORIES",     val:articleCount,    color:"text-cyan-400" },
          { label:"ENTITIES",    val:entityCount,     color:"text-amber-400" },
          { label:"CONNECTIONS", val:connectionCount, color:"text-purple-400" },
          { label:"RISK INDEX",  val:riskScore,       color:"",  style:{ color:riskColor } },
          { label:"ALERTS",      val:activeAlerts,    color:activeAlerts>0?"text-red-400":"text-white/25" },
        ].map(s => (
          <div key={s.label} className="text-center">
            <div className={`font-display text-[0.88rem] font-bold leading-none ${s.color}`} style={s.style}>{s.val}</div>
            <div className="text-[0.42rem] text-white/18 tracking-widest uppercase mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Mobile compact metrics */}
      <div className="flex md:hidden items-center gap-2">
        <div className="text-center">
          <div className="font-display text-[0.75rem] font-bold text-cyan-400 leading-none">{articleCount}</div>
          <div className="text-[0.38rem] text-white/18 tracking-widest uppercase">STORIES</div>
        </div>
        <div className="text-center">
          <div className="font-display text-[0.75rem] font-bold leading-none" style={{ color: riskColor }}>{riskScore}</div>
          <div className="text-[0.38rem] text-white/18 tracking-widest uppercase">RISK</div>
        </div>
        {activeAlerts > 0 && (
          <div className="text-center">
            <div className="font-display text-[0.75rem] font-bold text-red-400 leading-none">{activeAlerts}</div>
            <div className="text-[0.38rem] text-white/18 tracking-widest uppercase">ALERTS</div>
          </div>
        )}
      </div>

      <div className="flex items-center gap-1.5 sm:gap-2">
        <span className="hidden sm:inline text-[0.5rem] tracking-widest animate-blink" style={{ color:"#FFB300" }}>{fetchStatus}</span>
        <button onClick={onRefresh}
          className="font-mono text-[0.52rem] bg-cyan-500/[0.08] border border-cyan-500/25 text-cyan-400 px-2 sm:px-2.5 py-1 rounded-sm tracking-widest transition-all hover:bg-cyan-500/15">
          ↻
        </button>
        {onReport && (
          <button onClick={onReport}
            className="hidden sm:inline-flex font-display text-[0.5rem] bg-cyan-500/[0.06] border border-cyan-500/20 text-cyan-400/70 px-2.5 py-1 rounded-sm tracking-widest uppercase transition-all hover:bg-cyan-500/12 hover:text-cyan-400">
            ◈ BRIEF
          </button>
        )}
        <span className="text-[0.48rem] px-1.5 py-0.5 rounded-sm border font-bold tracking-widest uppercase border-emerald-400 text-emerald-400 animate-blink-border">● LIVE</span>
        <span className="hidden sm:inline text-[0.48rem] px-1.5 py-0.5 rounded-sm border font-bold tracking-widest uppercase border-amber-400 text-amber-400">TS/SCI</span>
        <span className="hidden sm:inline font-display text-[0.62rem] text-slate-200 tracking-widest">{clock}</span>
      </div>
    </header>
  );
}
