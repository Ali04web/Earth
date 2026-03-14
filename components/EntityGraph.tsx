"use client";
import { useEffect, useRef, useCallback, useState } from "react";
import type { Entity, EntityGraph, EntityLink } from "@/lib/entityExtractor";

interface Props {
  graph: EntityGraph;
  selectedId: string | null;
  onSelect: (entity: Entity | null) => void;
  highlightIds?: Set<string>;
}

interface SimNode extends Entity {
  x: number; y: number; vx: number; vy: number;
  fx?: number | null; fy?: number | null;
}

const TYPE_COLORS: Record<string, string> = {
  person:   "#00D2FF",
  org:      "#FFB300",
  location: "#00FFB2",
  concept:  "#CC44FF",
};
const TYPE_LABELS: Record<string, string> = {
  person: "PERSON", org: "ORG", location: "LOC", concept: "IDEA",
};

const RISK_COLOR = (risk: number) => {
  if (risk >= 70) return "#FF3344";
  if (risk >= 40) return "#FF8C00";
  return null;
};

export default function EntityGraph({ graph, selectedId, onSelect, highlightIds }: Props) {
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const simRef     = useRef<{ nodes: SimNode[]; links: EntityLink[]; raf: number; }>({ nodes: [], links: [], raf: 0 });
  const [hoverId, setHoverId] = useState<string | null>(null);
  const hoverRef   = useRef<string | null>(null);
  const selectedRef = useRef<string | null>(null);
  const dragRef    = useRef<SimNode | null>(null);
  const panRef     = useRef({ x: 0, y: 0, scale: 1 });

  selectedRef.current = selectedId;

  const initSim = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || graph.nodes.length === 0) return;
    const dpr = Math.min(devicePixelRatio, 2);
    const W = canvas.width  = canvas.offsetWidth  * dpr;
    const H = canvas.height = canvas.offsetHeight * dpr;
    const cx = W / 2, cy = H / 2;

    const linkCounts = new Map<string, number>();
    graph.links.forEach(l => {
      linkCounts.set(l.source, (linkCounts.get(l.source) || 0) + 1);
      linkCounts.set(l.target, (linkCounts.get(l.target) || 0) + 1);
    });

    const nodes: SimNode[] = graph.nodes.map((n, i) => {
      const angle = (i / graph.nodes.length) * Math.PI * 2;
      const connections = linkCounts.get(n.id) || 0;
      const r = Math.min(W, H) * (0.15 + 0.2 * (1 - connections / Math.max(1, graph.nodes.length)));
      return { ...n, x: cx + Math.cos(angle) * r + (Math.random() - 0.5) * 30, y: cy + Math.sin(angle) * r + (Math.random() - 0.5) * 30, vx: 0, vy: 0 };
    });
    simRef.current.nodes = nodes;
    simRef.current.links = graph.links;

    const ctx = canvas.getContext("2d")!;
    let alpha = 1;

    const nodeById = new Map(nodes.map(n => [n.id, n]));

    function radius(n: SimNode) { return Math.max(8, Math.min(28, 7 + n.count * 2.2)) * dpr; }

    function tick() {
      alpha = Math.max(0.001, alpha * 0.97);

      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i], b = nodes[j];
          let dx = b.x - a.x, dy = b.y - a.y;
          const dist2 = dx * dx + dy * dy + 1;
          const minDist = (radius(a) + radius(b)) * 2.5;
          const force = -300 * dpr / dist2 * alpha;
          const pushForce = dist2 < minDist * minDist ? -1.5 * alpha : 0;
          const fx = (force + pushForce) * dx, fy = (force + pushForce) * dy;
          a.vx += fx; a.vy += fy;
          b.vx -= fx; b.vy -= fy;
        }
      }

      simRef.current.links.forEach(l => {
        const s = nodeById.get(l.source), t = nodeById.get(l.target);
        if (!s || !t) return;
        const dx = t.x - s.x, dy = t.y - s.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const targetLen = 100 * dpr;
        const force = (dist - targetLen) * 0.04 * (0.3 + l.strength * 0.5) * alpha;
        const fx = (dx / dist) * force, fy = (dy / dist) * force;
        s.vx += fx; s.vy += fy;
        t.vx -= fx; t.vy -= fy;
      });

      const hasDrag = nodes.some(n => n.fx != null);

      nodes.forEach(n => {
        if (n.fx != null) { n.x = n.fx; n.y = n.fy!; n.vx = 0; n.vy = 0; return; }
        n.vx += (cx - n.x) * 0.008 * alpha;
        n.vy += (cy - n.y) * 0.008 * alpha;
        n.vx *= 0.45; n.vy *= 0.45;
        n.x += n.vx; n.y += n.vy;
        const r = radius(n);
        n.x = Math.max(r + 30, Math.min(W - r - 30, n.x));
        n.y = Math.max(r + 30, Math.min(H - r - 30, n.y));
      });

      draw();
      if (alpha > 0.01 || hasDrag) {
        simRef.current.raf = requestAnimationFrame(tick);
      }
    }

    function draw() {
      ctx.clearRect(0, 0, W, H);
      const selId = selectedRef.current;
      const hovId = hoverRef.current;

      const connected = new Set<string>();
      if (selId) {
        simRef.current.links.forEach(l => {
          if (l.source === selId) connected.add(l.target);
          if (l.target === selId) connected.add(l.source);
        });
      }

      simRef.current.links.forEach(l => {
        const s = nodeById.get(l.source), t = nodeById.get(l.target);
        if (!s || !t) return;
        const active = selId && (l.source === selId || l.target === selId);
        const fade = selId && !active;

        ctx.beginPath();
        ctx.moveTo(s.x, s.y); ctx.lineTo(t.x, t.y);

        if (active) {
          ctx.strokeStyle = `rgba(0,210,255,${0.5 + l.strength * 0.5})`;
          ctx.lineWidth = (2 + l.strength * 2) * dpr;
          ctx.setLineDash([]);
        } else if (fade) {
          ctx.strokeStyle = "rgba(0,210,255,0.04)";
          ctx.lineWidth = 0.5 * dpr;
          ctx.setLineDash([4 * dpr, 4 * dpr]);
        } else {
          ctx.strokeStyle = `rgba(0,210,255,${0.12 + l.strength * 0.18})`;
          ctx.lineWidth = (1 + l.strength) * dpr;
          ctx.setLineDash([]);
        }
        ctx.stroke();
        ctx.setLineDash([]);
      });

      nodes.forEach(n => {
        const r = radius(n);
        const isSel = n.id === selId;
        const isHov = n.id === hovId;
        const isConn = connected.has(n.id);
        const fade = selId && !isSel && !isConn;
        const base = TYPE_COLORS[n.type] || "#00D2FF";
        const rc = RISK_COLOR(n.risk);
        const color = rc || base;
        const nodeAlpha = fade ? 0.15 : 1;

        if (isSel || isHov) {
          ctx.beginPath();
          ctx.arc(n.x, n.y, r + 12 * dpr, 0, Math.PI * 2);
          ctx.fillStyle = `${color}15`;
          ctx.fill();
          ctx.beginPath();
          ctx.arc(n.x, n.y, r + 6 * dpr, 0, Math.PI * 2);
          ctx.fillStyle = `${color}25`;
          ctx.fill();
        }

        if (n.risk >= 60 && !fade) {
          ctx.beginPath();
          ctx.arc(n.x, n.y, r + 5 * dpr, 0, Math.PI * 2);
          ctx.strokeStyle = "#FF334455";
          ctx.lineWidth = 2 * dpr;
          ctx.stroke();
        }

        ctx.beginPath();
        ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
        const grad = ctx.createRadialGradient(n.x - r * 0.3, n.y - r * 0.3, 0, n.x, n.y, r);
        if (fade) {
          grad.addColorStop(0, color + "18");
          grad.addColorStop(1, color + "08");
        } else {
          grad.addColorStop(0, color + "55");
          grad.addColorStop(1, color + "22");
        }
        ctx.fillStyle = grad;
        ctx.fill();
        ctx.strokeStyle = fade ? color + "22" : isSel ? color : color + (isConn ? "BB" : "66");
        ctx.lineWidth = isSel ? 2.5 * dpr : 1.2 * dpr;
        ctx.stroke();

        const typeLabel = TYPE_LABELS[n.type] || "?";
        ctx.font = `bold ${Math.max(7, r * 0.45)}px 'Share Tech Mono', monospace`;
        ctx.fillStyle = fade ? color + "22" : color + "AA";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(typeLabel, n.x, n.y);

        {
          const fontSize = Math.max(10, 11 * dpr);
          ctx.font = `bold ${fontSize}px 'Share Tech Mono', monospace`;
          ctx.textAlign = "center";
          ctx.textBaseline = "top";

          const label = n.label.length > 16 ? n.label.slice(0, 15) + "…" : n.label;
          const labelY = n.y + r + 4 * dpr;
          const metrics = ctx.measureText(label);
          const pad = 4 * dpr;

          ctx.fillStyle = "rgba(2,8,16,0.75)";
          ctx.fillRect(n.x - metrics.width / 2 - pad, labelY - 1 * dpr, metrics.width + pad * 2, fontSize + pad);

          ctx.fillStyle = fade ? "rgba(255,255,255,0.12)" : isSel ? "#FFFFFF" : isConn ? "rgba(220,240,255,0.9)" : "rgba(200,220,240,0.7)";
          ctx.fillText(label, n.x, labelY, 120 * dpr);

          if (n.count > 1) {
            ctx.font = `${Math.max(8, 9 * dpr)}px 'Share Tech Mono', monospace`;
            ctx.fillStyle = fade ? "rgba(255,255,255,0.06)" : "rgba(200,220,240,0.35)";
            ctx.fillText(`${n.count} mentions`, n.x, labelY + fontSize + 2 * dpr);
          }
        }
      });
    }

    cancelAnimationFrame(simRef.current.raf);
    tick();
  }, [graph, highlightIds]);

  useEffect(() => { initSim(); }, [initSim]);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const observer = new ResizeObserver(() => {
      if (canvas.offsetWidth > 0 && canvas.offsetHeight > 0) initSim();
    });
    observer.observe(canvas);
    window.addEventListener("resize", initSim);
    return () => { observer.disconnect(); window.removeEventListener("resize", initSim); };
  }, [initSim]);

  const getNode = useCallback((e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const dpr = Math.min(devicePixelRatio, 2);
    const rect = canvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left) * dpr;
    const my = (e.clientY - rect.top) * dpr;
    const nodes = simRef.current.nodes;
    for (let i = nodes.length - 1; i >= 0; i--) {
      const n = nodes[i];
      const r = Math.max(8, Math.min(28, 7 + n.count * 2.2)) * dpr;
      const dx = n.x - mx, dy = n.y - my;
      if (dx * dx + dy * dy <= (r + 6 * dpr) ** 2) return n;
    }
    return null;
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full cursor-crosshair"
      onMouseMove={e => {
        if (dragRef.current) {
          const canvas = canvasRef.current!;
          const dpr = Math.min(devicePixelRatio, 2);
          const rect = canvas.getBoundingClientRect();
          dragRef.current.fx = (e.clientX - rect.left) * dpr;
          dragRef.current.fy = (e.clientY - rect.top) * dpr;
          return;
        }
        const n = getNode(e);
        const id = n?.id || null;
        if (id !== hoverRef.current) { hoverRef.current = id; setHoverId(id); }
        (canvasRef.current!).style.cursor = n ? "pointer" : "crosshair";
      }}
      onMouseLeave={() => { hoverRef.current = null; setHoverId(null); }}
      onMouseDown={e => {
        const n = getNode(e);
        if (n) {
          dragRef.current = n; n.fx = n.x; n.fy = n.y;
          initSim();
        }
      }}
      onMouseUp={() => { if (dragRef.current) { dragRef.current.fx = null; dragRef.current.fy = null; dragRef.current = null; } }}
      onClick={e => {
        if (dragRef.current) return;
        const n = getNode(e);
        onSelect(n ? (n.id === selectedId ? null : n) : null);
      }}
    />
  );
}
