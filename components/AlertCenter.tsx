"use client";
import { useState } from "react";
import type { Alert, AlertSeverity } from "@/lib/riskEngine";

interface Props {
  alerts: Alert[];
  onAcknowledge: (id: string) => void;
  onDismiss: (id: string) => void;
  onAlertClick: (alert: Alert) => void;
}

const SEV_STYLES: Record<AlertSeverity, { pill: string; border: string; glow: string; label: string }> = {
  critical: {
    pill:   "bg-red-500/15 text-red-400 border-red-500/40",
    border: "border-l-red-500",
    glow:   "shadow-[0_0_12px_rgba(255,51,68,0.15)]",
    label:  "CRITICAL",
  },
  high: {
    pill:   "bg-orange-500/12 text-orange-400 border-orange-500/35",
    border: "border-l-orange-400",
    glow:   "shadow-[0_0_8px_rgba(255,140,0,0.12)]",
    label:  "HIGH",
  },
  medium: {
    pill:   "bg-amber-500/10 text-amber-400 border-amber-500/30",
    border: "border-l-amber-400",
    glow:   "",
    label:  "MEDIUM",
  },
  low: {
    pill:   "bg-cyan-500/10 text-cyan-400 border-cyan-500/25",
    border: "border-l-cyan-400/40",
    glow:   "",
    label:  "LOW",
  },
};

const CAT_ICONS: Record<string, string> = {
  threat: "⚠", anomaly: "◉", surge: "↑", cluster: "⬡",
  geopolitical: "◈", economic: "$", cyber: "⌘",
};

const TREND_ICONS: Record<string, string> = {
  rising: "▲", stable: "—", falling: "▼",
};
const TREND_COLORS: Record<string, string> = {
  rising: "text-red-400", stable: "text-white/30", falling: "text-emerald-400",
};

export default function AlertCenter({ alerts, onAcknowledge, onDismiss, onAlertClick }: Props) {
  const [filter, setFilter] = useState<AlertSeverity | "all">("all");
  const [showAcked, setShowAcked] = useState(false);

  const filtered = alerts.filter(a =>
    (filter === "all" || a.severity === filter) &&
    (showAcked || !a.acknowledged)
  );

  const critCount = alerts.filter(a => a.severity === "critical" && !a.acknowledged).length;
  const highCount = alerts.filter(a => a.severity === "high"     && !a.acknowledged).length;
  const unacked   = alerts.filter(a => !a.acknowledged).length;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-red-500/[0.05] border-b border-red-500/15">
        <div className="flex items-center gap-2">
          <span className="font-display text-[0.58rem] tracking-[0.2em] text-red-400 uppercase">
            ⚠ Alert Center
          </span>
          {unacked > 0 && (
            <span className="text-[0.52rem] px-1.5 py-0.5 bg-red-500/20 border border-red-500/40 text-red-400 rounded-sm font-bold animate-pulse">
              {unacked} ACTIVE
            </span>
          )}
        </div>
        <button
          onClick={() => setShowAcked(s => !s)}
          className="text-[0.5rem] text-white/20 hover:text-white/50 tracking-wider uppercase transition-colors"
        >
          {showAcked ? "HIDE ACKED" : "SHOW ALL"}
        </button>
      </div>

      {/* Summary pills */}
      <div className="flex gap-1.5 px-3 py-2 border-b border-cyan-500/10">
        {([
          ["all",      `ALL (${alerts.length})`,         "border-white/15 text-white/30"],
          ["critical", `CRIT (${critCount})`,            "border-red-500/40 text-red-400"],
          ["high",     `HIGH (${highCount})`,            "border-orange-400/40 text-orange-400"],
          ["medium",   `MED (${alerts.filter(a=>a.severity==="medium").length})`, "border-amber-400/40 text-amber-400"],
        ] as [typeof filter, string, string][]).map(([key, label, defCls]) => (
          <button key={key} onClick={() => setFilter(key)}
            className={`text-[0.5rem] px-2 py-0.5 rounded-sm border font-mono tracking-wider uppercase transition-all ${
              filter === key
                ? "bg-cyan-500/10 border-cyan-400 text-cyan-400"
                : defCls
            }`}>
            {label}
          </button>
        ))}
      </div>

      {/* Alert list */}
      <div className="flex-1 overflow-y-auto custom-scroll">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 gap-2">
            <div className="text-2xl opacity-20">✓</div>
            <div className="text-[0.58rem] text-white/20 tracking-wider">NO ACTIVE ALERTS</div>
          </div>
        ) : filtered.map(alert => {
          const s = SEV_STYLES[alert.severity];
          return (
            <div
              key={alert.id}
              onClick={() => onAlertClick(alert)}
              className={`border-b border-white/[0.04] border-l-2 ${s.border} ${s.glow}
                cursor-pointer transition-all hover:bg-white/[0.03] animate-slide-in
                ${alert.acknowledged ? "opacity-40" : ""}`}
            >
              <div className="px-3 py-2.5">
                {/* Top row */}
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className={`text-[0.52rem] px-1.5 py-0.5 rounded-sm border font-bold tracking-wider uppercase ${s.pill}`}>
                      {CAT_ICONS[alert.category]} {s.label}
                    </span>
                    <span className="text-[0.5rem] px-1.5 py-0.5 border border-white/10 text-white/30 rounded-sm uppercase tracking-wider">
                      {alert.category}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <span className={`text-[0.5rem] font-bold ${TREND_COLORS[alert.trend]}`}>
                      {TREND_ICONS[alert.trend]}
                    </span>
                    <span className="font-display text-[0.6rem] font-bold"
                      style={{ color: alert.score >= 75 ? "#FF3344" : alert.score >= 50 ? "#FF8C00" : "#FFB300" }}>
                      {alert.score}
                    </span>
                  </div>
                </div>

                {/* Title */}
                <div className="text-[0.65rem] text-slate-100 font-bold leading-snug mb-1">
                  {alert.title}
                </div>

                {/* Description */}
                <div className="text-[0.58rem] text-white/40 leading-snug mb-2">
                  {alert.description}
                </div>

                {/* Score bar */}
                <div className="h-0.5 bg-white/5 rounded-full mb-2 overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${alert.score}%`,
                      background: alert.score >= 75 ? "#FF3344" : alert.score >= 50 ? "#FF8C00" : "#FFB300"
                    }} />
                </div>

                {/* Meta + actions */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-[0.5rem] text-white/20">
                    {alert.location && <span className="text-amber-400/60">▸ {alert.location}</span>}
                    <span>{new Date(alert.triggeredAt).toUTCString().slice(17,25)} UTC</span>
                    <span>{alert.articleIds.length} stories</span>
                  </div>
                  <div className="flex gap-1.5">
                    {!alert.acknowledged && (
                      <button
                        onClick={e => { e.stopPropagation(); onAcknowledge(alert.id); }}
                        className="text-[0.48rem] px-1.5 py-0.5 border border-cyan-500/25 text-cyan-400/60 rounded-sm hover:border-cyan-400 hover:text-cyan-400 transition-all uppercase tracking-wider">
                        ACK
                      </button>
                    )}
                    <button
                      onClick={e => { e.stopPropagation(); onDismiss(alert.id); }}
                      className="text-[0.48rem] px-1.5 py-0.5 border border-white/10 text-white/20 rounded-sm hover:border-white/30 hover:text-white/50 transition-all uppercase tracking-wider">
                      ✕
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
