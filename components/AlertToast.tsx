"use client";
import { useEffect, useState } from "react";
import type { Alert } from "@/lib/riskEngine";

interface Props {
  alerts: Alert[];
}

export default function AlertToast({ alerts }: Props) {
  const [visible, setVisible] = useState<Alert[]>([]);
  const [shownIds, setShownIds] = useState(new Set<string>());

  useEffect(() => {
    const newAlerts = alerts.filter(
      a => !shownIds.has(a.id) && (a.severity === "critical" || a.severity === "high") && !a.acknowledged
    );
    if (newAlerts.length === 0) return;

    setVisible(prev => [...prev, ...newAlerts].slice(-3));
    setShownIds(prev => {
      const next = new Set(prev);
      newAlerts.forEach(a => next.add(a.id));
      return next;
    });

    // Auto-dismiss after 6s
    newAlerts.forEach(a => {
      setTimeout(() => {
        setVisible(prev => prev.filter(x => x.id !== a.id));
      }, 6000);
    });
  }, [alerts, shownIds]);

  if (visible.length === 0) return null;

  const SEV_COLORS: Record<string, { border: string; bg: string; text: string }> = {
    critical: { border: "#FF3344", bg: "rgba(255,51,68,0.12)", text: "#FF3344" },
    high:     { border: "#FF8C00", bg: "rgba(255,140,0,0.10)",  text: "#FF8C00" },
  };

  return (
    <div className="fixed top-14 right-4 z-[200] flex flex-col gap-2 pointer-events-none">
      {visible.map(alert => {
        const c = SEV_COLORS[alert.severity] || SEV_COLORS.high;
        return (
          <div
            key={alert.id}
            className="w-[300px] rounded-sm p-3 pointer-events-auto animate-slide-in"
            style={{
              background: c.bg,
              border: `1px solid ${c.border}55`,
              boxShadow: `0 0 20px ${c.border}25`,
            }}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-[0.5rem] font-bold tracking-widest uppercase"
                    style={{ color: c.text }}>
                    ⚠ {alert.severity.toUpperCase()} ALERT
                  </span>
                </div>
                <div className="text-[0.62rem] text-slate-100 leading-snug font-bold mb-0.5">
                  {alert.title}
                </div>
                <div className="text-[0.55rem] text-white/40 leading-snug">
                  {alert.description.slice(0, 80)}…
                </div>
              </div>
              <button
                onClick={() => setVisible(prev => prev.filter(x => x.id !== alert.id))}
                className="text-white/20 hover:text-white/60 flex-shrink-0 mt-0.5"
              >
                ✕
              </button>
            </div>
            {/* Progress bar (auto-dismiss) */}
            <div className="mt-2 h-0.5 bg-white/5 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{
                  background: c.border,
                  width: "100%",
                  animation: "shrink-width 6s linear forwards",
                }}
              />
            </div>
          </div>
        );
      })}
      <style>{`
        @keyframes shrink-width {
          from { width: 100%; }
          to   { width: 0%; }
        }
      `}</style>
    </div>
  );
}
