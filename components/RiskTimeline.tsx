"use client";
import { useEffect, useRef } from "react";

interface Point {
  t: string;
  score: number;
  conflict: number;
  political: number;
  economic: number;
}

interface Props { timeline: Point[]; }

export default function RiskTimeline({ timeline }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || timeline.length < 2) return;
    const dpr = window.devicePixelRatio || 1;
    const W   = canvas.offsetWidth  * dpr;
    const H   = canvas.offsetHeight * dpr;
    canvas.width  = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d")!;

    const pad  = { l: 28*dpr, r: 10*dpr, t: 10*dpr, b: 22*dpr };
    const gW   = W - pad.l - pad.r;
    const gH   = H - pad.t - pad.b;
    const n    = timeline.length;
    const xOf  = (i: number) => pad.l + (i / (n-1)) * gW;
    const yOf  = (v: number) => pad.t + gH - (v / 100) * gH;

    // Grid
    ctx.strokeStyle = "rgba(0,210,255,0.06)";
    ctx.lineWidth   = dpr;
    [0, 25, 50, 75, 100].forEach(v => {
      ctx.beginPath(); ctx.moveTo(pad.l, yOf(v)); ctx.lineTo(W-pad.r, yOf(v)); ctx.stroke();
      ctx.font = `${9*dpr}px 'Share Tech Mono'`;
      ctx.fillStyle = "rgba(168,200,216,0.3)";
      ctx.textAlign  = "right";
      ctx.fillText(String(v), pad.l - 4*dpr, yOf(v) + 3*dpr);
    });

    // Series definitions
    const series = [
      { key: "conflict",  color: "#FF3344", label: "CONFLICT" },
      { key: "political", color: "#00D2FF", label: "POLITICAL" },
      { key: "economic",  color: "#FFB300", label: "ECONOMIC" },
      { key: "score",     color: "#FFFFFF", label: "OVERALL",  dashed: true },
    ] as { key: string; color: string; label: string; dashed?: boolean }[];

    series.forEach(({ key, color, dashed }) => {
      const vals = timeline.map(p => (p as any)[key] as number);

      // Fill
      if (!dashed) {
        const grad = ctx.createLinearGradient(0, pad.t, 0, H - pad.b);
        grad.addColorStop(0, color + "22");
        grad.addColorStop(1, color + "00");
        ctx.beginPath();
        ctx.moveTo(xOf(0), yOf(vals[0]));
        vals.forEach((v, i) => ctx.lineTo(xOf(i), yOf(v)));
        ctx.lineTo(xOf(n-1), H-pad.b);
        ctx.lineTo(xOf(0), H-pad.b);
        ctx.closePath();
        ctx.fillStyle = grad;
        ctx.fill();
      }

      // Line
      ctx.beginPath();
      if (dashed) ctx.setLineDash([4*dpr, 4*dpr]);
      ctx.moveTo(xOf(0), yOf(vals[0]));
      vals.forEach((v, i) => ctx.lineTo(xOf(i), yOf(v)));
      ctx.strokeStyle = dashed ? color + "66" : color + "CC";
      ctx.lineWidth   = dashed ? dpr : 1.5*dpr;
      ctx.lineJoin    = "round";
      ctx.stroke();
      ctx.setLineDash([]);
    });

    // X labels (every 3)
    ctx.font      = `${8*dpr}px 'Share Tech Mono'`;
    ctx.fillStyle = "rgba(168,200,216,0.25)";
    ctx.textAlign = "center";
    timeline.forEach((p, i) => {
      if (i % 3 === 0) ctx.fillText(p.t, xOf(i), H - 6*dpr);
    });

    // Latest value dot
    const last = timeline[n-1];
    ctx.beginPath();
    ctx.arc(xOf(n-1), yOf(last.score), 3*dpr, 0, Math.PI*2);
    ctx.fillStyle = "#FFFFFF";
    ctx.fill();

  }, [timeline]);

  const lastPt  = timeline[timeline.length-1];
  const firstPt = timeline[0];
  const delta   = lastPt && firstPt ? lastPt.score - firstPt.score : 0;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2 border-b border-cyan-500/15">
        <span className="font-display text-[0.56rem] tracking-[0.2em] text-cyan-400/70 uppercase">
          ◈ Risk Timeline
        </span>
        <div className="flex items-center gap-3">
          {[
            { color:"#FF3344", label:"CONFLICT"  },
            { color:"#00D2FF", label:"POLITICAL" },
            { color:"#FFB300", label:"ECONOMIC"  },
            { color:"#FFFFFF", label:"OVERALL",  dashed:true },
          ].map(({ color, label, dashed }) => (
            <div key={label} className="flex items-center gap-1">
              <div className="w-4 h-0.5 rounded-full flex-shrink-0"
                style={{ background: dashed ? "transparent" : color,
                         border: dashed ? `1px dashed ${color}88` : "none" }} />
              <span className="text-[0.48rem] text-white/30">{label}</span>
            </div>
          ))}
          <span className={`text-[0.56rem] font-display font-bold ${delta > 0 ? "text-red-400" : delta < 0 ? "text-emerald-400" : "text-white/30"}`}>
            {delta > 0 ? "▲" : delta < 0 ? "▼" : "—"} {Math.abs(delta)}
          </span>
        </div>
      </div>
      <div className="flex-1 p-1">
        <canvas ref={canvasRef} className="w-full h-full" />
      </div>
    </div>
  );
}
