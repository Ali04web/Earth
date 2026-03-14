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

  selectedRef.current = selectedId;

  const initSim = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || graph.nodes.length === 0) return;
    const W = canvas.width  = canvas.offsetWidth  * devicePixelRatio;
    const H = canvas.height = canvas.offsetHeight * devicePixelRatio;
    const cx = W / 2, cy = H / 2;

    // Init positions in a circle
    const nodes: SimNode[] = graph.nodes.map((n, i) => {
      const angle = (i / graph.nodes.length) * Math.PI * 2;
      const r = Math.min(W, H) * 0.3;
      return { ...n, x: cx + Math.cos(angle)*r, y: cy + Math.sin(angle)*r, vx: 0, vy: 0 };
    });
    simRef.current.nodes = nodes;
    simRef.current.links = graph.links;

    const ctx = canvas.getContext("2d")!;
    const alpha_decay = 0.015;
    let alpha = 1;

    const nodeById = new Map(nodes.map(n => [n.id, n]));

    function radius(n: SimNode) { return Math.max(5, Math.min(22, 5 + n.count * 1.8)) * devicePixelRatio; }

    function tick() {
      alpha = Math.max(0.001, alpha - alpha_decay);
      const k = alpha * 0.1;

      // Repulsion (simplified n-body)
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i], b = nodes[j];
          const dx = b.x - a.x, dy = b.y - a.y;
          const dist2 = dx*dx + dy*dy + 1;
          const force = -300 / dist2;
          const fx = force * dx, fy = force * dy;
          a.vx += fx; a.vy += fy;
          b.vx -= fx; b.vy -= fy;
        }
      }

      // Link attraction
      simRef.current.links.forEach(l => {
        const s = nodeById.get(l.source), t = nodeById.get(l.target);
        if (!s || !t) return;
        const dx = t.x - s.x, dy = t.y - s.y;
        const dist = Math.sqrt(dx*dx+dy*dy) || 1;
        const targetLen = 120 * devicePixelRatio;
        const force = (dist - targetLen) * 0.04 * (0.3 + l.strength);
        const fx = (dx/dist)*force, fy = (dy/dist)*force;
        s.vx += fx; s.vy += fy;
        t.vx -= fx; t.vy -= fy;
      });

      // Centre gravity
      nodes.forEach(n => {
        if (n.fx != null) { n.x = n.fx; n.y = n.fy!; return; }
        n.vx += (cx - n.x) * 0.01 * k;
        n.vy += (cy - n.y) * 0.01 * k;
        n.vx *= 0.7; n.vy *= 0.7;
        n.x += n.vx; n.y += n.vy;
        // Clamp
        const r = radius(n);
        n.x = Math.max(r, Math.min(W-r, n.x));
        n.y = Math.max(r, Math.min(H-r, n.y));
      });

      draw();
      simRef.current.raf = requestAnimationFrame(tick);
    }

    function draw() {
      ctx.clearRect(0, 0, W, H);
      const selId  = selectedRef.current;
      const hovId  = hoverRef.current;
      const hlIds  = highlightIds;

      const connected = new Set<string>();
      if (selId) {
        simRef.current.links.forEach(l => {
          if (l.source === selId) connected.add(l.target);
          if (l.target === selId) connected.add(l.source);
        });
      }

      // Links
      simRef.current.links.forEach(l => {
        const s = nodeById.get(l.source), t = nodeById.get(l.target);
        if (!s || !t) return;
        const active = selId && (l.source === selId || l.target === selId);
        const fade   = selId && !active;
        ctx.beginPath();
        ctx.moveTo(s.x, s.y); ctx.lineTo(t.x, t.y);
        ctx.strokeStyle = active
          ? `rgba(0,210,255,${0.35 + l.strength*0.4})`
          : fade
            ? "rgba(0,210,255,0.04)"
            : `rgba(0,210,255,${0.08 + l.strength*0.1})`;
        ctx.lineWidth = active ? 1.5*devicePixelRatio : 0.8*devicePixelRatio;
        ctx.stroke();
      });

      // Nodes
      nodes.forEach(n => {
        const r      = radius(n);
        const isSel  = n.id === selId;
        const isHov  = n.id === hovId;
        const isConn = connected.has(n.id);
        const isHl   = hlIds?.has(n.id);
        const fade   = selId && !isSel && !isConn;
        const base   = TYPE_COLORS[n.type] || "#00D2FF";
        const rc     = RISK_COLOR(n.risk);
        const color  = rc || base;

        // Outer glow for selected / hover
        if (isSel || isHov || isHl) {
          ctx.beginPath();
          ctx.arc(n.x, n.y, r + 6*devicePixelRatio, 0, Math.PI*2);
          ctx.fillStyle = `${color}22`;
          ctx.fill();
          ctx.beginPath();
          ctx.arc(n.x, n.y, r + 3*devicePixelRatio, 0, Math.PI*2);
          ctx.fillStyle = `${color}33`;
          ctx.fill();
        }

        // Node body
        ctx.beginPath();
        ctx.arc(n.x, n.y, r, 0, Math.PI*2);
        ctx.fillStyle = fade ? color + "22" : color + "28";
        ctx.fill();
        ctx.strokeStyle = fade ? color + "33" : isSel ? color : color + (isConn ? "CC" : "77");
        ctx.lineWidth = isSel ? 2*devicePixelRatio : devicePixelRatio;
        ctx.stroke();

        // Risk ring
        if (n.risk >= 60 && !fade) {
          ctx.beginPath();
          ctx.arc(n.x, n.y, r + 4*devicePixelRatio, 0, Math.PI*2);
          ctx.strokeStyle = "#FF334444";
          ctx.lineWidth = 1.5*devicePixelRatio;
          ctx.stroke();
        }

        // Type icon dot
        const icon = { person:"◉", org:"⬡", location:"▸", concept:"◈" }[n.type] || "•";
        ctx.font = `${r * 0.9}px 'Share Tech Mono'`;
        ctx.fillStyle = fade ? color + "33" : color + "BB";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(icon, n.x, n.y);

        // Label
        if (isSel || isHov || isConn || (n.count >= 4 && !fade)) {
          ctx.font = `${Math.max(9, 10*devicePixelRatio)}px 'Share Tech Mono'`;
          ctx.fillStyle = fade ? "rgba(255,255,255,0.08)" : isSel ? "#E8F4FF" : "rgba(220,240,255,0.7)";
          ctx.textAlign = "center";
          ctx.textBaseline = "top";
          const maxW = 80*devicePixelRatio;
          const label = n.label.length > 14 ? n.label.slice(0,13)+"…" : n.label;
          ctx.fillText(label, n.x, n.y + r + 3*devicePixelRatio, maxW);
        }
      });
    }

    cancelAnimationFrame(simRef.current.raf);
    tick();
    // Slow down after initial stabilize
    setTimeout(() => { alpha_decay === 0.015 && (alpha = 0.05); }, 3000);
  }, [graph, highlightIds]);

  useEffect(() => { initSim(); }, [initSim]);
  useEffect(() => {
    const handleResize = () => initSim();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [initSim]);

  // Mouse interaction
  const getNode = useCallback((e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left) * devicePixelRatio;
    const my = (e.clientY - rect.top)  * devicePixelRatio;
    const nodes = simRef.current.nodes;
    for (let i = nodes.length-1; i >= 0; i--) {
      const n = nodes[i];
      const r = Math.max(5, Math.min(22, 5 + n.count * 1.8)) * devicePixelRatio;
      const dx = n.x - mx, dy = n.y - my;
      if (dx*dx + dy*dy <= (r+4*devicePixelRatio)**2) return n;
    }
    return null;
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full cursor-crosshair"
      onMouseMove={e => {
        const n = getNode(e);
        const id = n?.id || null;
        if (id !== hoverRef.current) { hoverRef.current = id; setHoverId(id); }
        (canvasRef.current!).style.cursor = n ? "pointer" : "crosshair";
      }}
      onMouseLeave={() => { hoverRef.current = null; setHoverId(null); }}
      onMouseDown={e => { const n = getNode(e); if (n) { dragRef.current = n; n.fx = n.x; n.fy = n.y; } }}
      onMouseUp={() => { if (dragRef.current) { dragRef.current.fx = null; dragRef.current.fy = null; dragRef.current = null; } }}
      onClick={e => {
        const n = getNode(e);
        onSelect(n ? (n.id === selectedId ? null : n) : null);
      }}
    />
  );
}
