"use client";
import RiskGauge from "./RiskGauge";
import RiskTimeline from "./RiskTimeline";
import AlertCenter from "./AlertCenter";
import type { AlertPipeline, Alert } from "@/lib/riskEngine";

interface Props {
  pipeline: AlertPipeline;
  onAcknowledge: (id: string) => void;
  onDismiss: (id: string) => void;
  onAlertClick: (alert: Alert) => void;
}

const DIM_COLORS: Record<string, string> = {
  conflict:     "#FF3344",
  political:    "#00D2FF",
  economic:     "#FFB300",
  cyber:        "#CC44FF",
  humanitarian: "#00FFB2",
};

const TREND_LABEL: Record<string, string> = {
  rising: "▲ RISING", stable: "— STABLE", falling: "▼ FALLING",
};
const TREND_COLOR: Record<string, string> = {
  rising: "#FF3344", stable: "rgba(168,200,216,0.4)", falling: "#00FFB2",
};

function DimBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[0.52rem] w-24 text-white/40 uppercase tracking-wider flex-shrink-0">{label}</span>
      <div className="flex-1 h-1 bg-white/5 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700"
          style={{ width: `${value}%`, background: color }} />
      </div>
      <span className="text-[0.56rem] font-display font-bold w-6 text-right flex-shrink-0"
        style={{ color }}>{value}</span>
    </div>
  );
}

export default function RiskDashboard({ pipeline, onAcknowledge, onDismiss, onAlertClick }: Props) {
  const { riskScore, topThreats, timeline, regionRisks } = pipeline;
  const unacked = pipeline.alerts.filter(a => !a.acknowledged).length;

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* Top strip — gauge + dimensions + top threats */}
      <div className="flex border-b border-cyan-500/15 flex-shrink-0">

        {/* Gauge */}
        <div className="flex flex-col items-center justify-center px-4 py-3 border-r border-cyan-500/10 flex-shrink-0">
          <RiskGauge score={riskScore.overall} size={110} label="OVERALL" />
          <div className="mt-1 text-center">
            <div className="font-display text-[0.52rem] tracking-widest"
              style={{ color: TREND_COLOR[riskScore.trend] }}>
              {TREND_LABEL[riskScore.trend]}
            </div>
            {riskScore.delta !== 0 && (
              <div className="text-[0.48rem] text-white/20 mt-0.5">
                {riskScore.delta > 0 ? "+" : ""}{riskScore.delta} from last cycle
              </div>
            )}
          </div>
        </div>

        {/* Dimensions */}
        <div className="flex-1 px-4 py-3 border-r border-cyan-500/10">
          <div className="font-display text-[0.52rem] tracking-[0.18em] text-cyan-400/40 uppercase mb-3">
            Risk Dimensions
          </div>
          <div className="flex flex-col gap-2">
            {(["conflict","political","economic","cyber","humanitarian"] as const).map(dim => (
              <DimBar key={dim} label={dim} value={(riskScore as any)[dim]} color={DIM_COLORS[dim]} />
            ))}
          </div>
        </div>

        {/* Top threats */}
        <div className="w-[200px] flex-shrink-0 px-3 py-3">
          <div className="font-display text-[0.52rem] tracking-[0.18em] text-cyan-400/40 uppercase mb-3">
            Top Threats
          </div>
          <div className="flex flex-col gap-1.5">
            {topThreats.slice(0,7).map((t, i) => (
              <div key={t.label} className="flex items-center gap-2">
                <span className="text-[0.48rem] text-white/20 font-display w-3 flex-shrink-0">{i+1}</span>
                <span className="text-[0.56rem] text-slate-300 flex-1 truncate">{t.label}</span>
                <span className={`text-[0.5rem] font-bold flex-shrink-0 ${
                  t.delta > 0 ? "text-red-400" : t.delta < 0 ? "text-emerald-400" : "text-white/20"
                }`}>
                  {t.delta > 0 ? "▲" : t.delta < 0 ? "▼" : "—"}
                </span>
                <span className="font-display text-[0.56rem] font-bold flex-shrink-0"
                  style={{ color: t.score >= 70 ? "#FF3344" : t.score >= 45 ? "#FF8C00" : "#FFB300" }}>
                  {t.score}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Middle — timeline + region risks */}
      <div className="flex border-b border-cyan-500/15 flex-shrink-0" style={{ height: 160 }}>
        {/* Timeline */}
        <div className="flex-1 border-r border-cyan-500/10">
          <RiskTimeline timeline={timeline} />
        </div>

        {/* Region heatmap (top 10) */}
        <div className="w-[220px] flex-shrink-0 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 border-b border-cyan-500/10">
            <span className="font-display text-[0.52rem] tracking-[0.18em] text-cyan-400/50 uppercase">
              Hot Regions
            </span>
            <span className="text-[0.48rem] text-white/20">{regionRisks.length} pinned</span>
          </div>
          <div className="flex-1 overflow-y-auto custom-scroll">
            {regionRisks.slice(0,10).map(r => (
              <div key={r.name} className="flex items-center gap-2 px-3 py-1.5 border-b border-white/[0.03]">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-[0.58rem] text-slate-300 truncate">{r.name}</span>
                    <span className="text-[0.52rem] font-display font-bold flex-shrink-0 ml-1"
                      style={{ color: r.score >= 70 ? "#FF3344" : r.score >= 45 ? "#FF8C00" : "#FFB300" }}>
                      {r.score}
                    </span>
                  </div>
                  <div className="h-0.5 bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full rounded-full"
                      style={{
                        width: `${r.score}%`,
                        background: r.score >= 70 ? "#FF3344" : r.score >= 45 ? "#FF8C00" : "#FFB300"
                      }} />
                  </div>
                </div>
                <span className="text-[0.48rem] text-white/20 flex-shrink-0">{r.articles}×</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom — alert center fills rest */}
      <div className="flex-1 overflow-hidden">
        <AlertCenter
          alerts={pipeline.alerts}
          onAcknowledge={onAcknowledge}
          onDismiss={onDismiss}
          onAlertClick={onAlertClick}
        />
      </div>
    </div>
  );
}
