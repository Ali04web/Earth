"use client";
import { useEffect, useRef } from "react";

interface Props {
  score: number;
  size?: number;
  label?: string;
}

export default function RiskGauge({ score, size = 120, label = "RISK" }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width  = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width  = size + "px";
    canvas.style.height = size + "px";
    const ctx = canvas.getContext("2d")!;
    ctx.scale(dpr, dpr);

    const cx = size / 2, cy = size / 2 + 8;
    const r  = size * 0.38;
    const startAngle = Math.PI * 0.75;
    const endAngle   = Math.PI * 2.25;
    const arcRange   = endAngle - startAngle;

    // BG arc
    ctx.beginPath();
    ctx.arc(cx, cy, r, startAngle, endAngle);
    ctx.strokeStyle = "rgba(0,210,255,0.08)";
    ctx.lineWidth   = size * 0.08;
    ctx.lineCap     = "round";
    ctx.stroke();

    // Coloured score arc
    const pct      = score / 100;
    const color    = score >= 75 ? "#FF3344" : score >= 50 ? "#FF8C00" : score >= 25 ? "#FFB300" : "#00FFB2";
    const gradient = ctx.createLinearGradient(0, 0, size, 0);
    gradient.addColorStop(0, "#00FFB2");
    gradient.addColorStop(0.5, "#FFB300");
    gradient.addColorStop(1, "#FF3344");

    ctx.beginPath();
    ctx.arc(cx, cy, r, startAngle, startAngle + arcRange * pct);
    ctx.strokeStyle = gradient;
    ctx.lineWidth   = size * 0.08;
    ctx.lineCap     = "round";
    ctx.stroke();

    // Glow
    ctx.beginPath();
    ctx.arc(cx, cy, r, startAngle, startAngle + arcRange * pct);
    ctx.strokeStyle = color + "44";
    ctx.lineWidth   = size * 0.14;
    ctx.lineCap     = "round";
    ctx.stroke();

    // Tick marks
    for (let i = 0; i <= 10; i++) {
      const angle = startAngle + (arcRange * i) / 10;
      const inner = r - size * 0.07;
      const outer = r + size * 0.04;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(angle)*inner, cy + Math.sin(angle)*inner);
      ctx.lineTo(cx + Math.cos(angle)*outer, cy + Math.sin(angle)*outer);
      ctx.strokeStyle = i <= pct * 10 ? color + "88" : "rgba(0,210,255,0.12)";
      ctx.lineWidth   = i % 5 === 0 ? 1.5 : 0.8;
      ctx.stroke();
    }

    // Needle
    const needleAngle = startAngle + arcRange * pct;
    const nr = r * 0.85;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(needleAngle)*nr, cy + Math.sin(needleAngle)*nr);
    ctx.strokeStyle = color;
    ctx.lineWidth   = 1.5;
    ctx.lineCap     = "round";
    ctx.stroke();

    // Centre dot
    ctx.beginPath();
    ctx.arc(cx, cy, size * 0.04, 0, Math.PI*2);
    ctx.fillStyle = color;
    ctx.fill();

    // Score text
    ctx.font        = `bold ${size * 0.22}px 'Orbitron', sans-serif`;
    ctx.fillStyle   = color;
    ctx.textAlign   = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(score), cx, cy - 4);

    // Label
    ctx.font      = `${size * 0.085}px 'Share Tech Mono', monospace`;
    ctx.fillStyle = "rgba(168,200,216,0.4)";
    ctx.fillText(label, cx, cy + size * 0.2);
  }, [score, size, label]);

  return <canvas ref={canvasRef} />;
}
