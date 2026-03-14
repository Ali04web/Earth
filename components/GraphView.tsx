"use client";
import { useState, useMemo } from "react";
import EntityGraph from "./EntityGraph";
import type { Entity, EntityGraph as EGraph } from "@/lib/entityExtractor";

interface Props {
  graph: EGraph;
  selectedEntity: Entity | null;
  onSelect: (e: Entity | null) => void;
  highlightIds?: Set<string>;
}

export default function GraphView({ graph, selectedEntity, onSelect, highlightIds }: Props) {
  const [filter, setFilter] = useState<string>("all");

  const filtered = useMemo<EGraph>(() => {
    if (filter === "all") return graph;
    const nodes = graph.nodes.filter(n => n.type === filter);
    const ids   = new Set(nodes.map(n => n.id));
    const links = graph.links.filter(l => ids.has(l.source) && ids.has(l.target));
    return { nodes, links };
  }, [graph, filter]);

  const counts = useMemo(() => {
    const c: Record<string,number> = { all: graph.nodes.length, person: 0, org: 0, location: 0, concept: 0 };
    graph.nodes.forEach(n => { c[n.type] = (c[n.type]||0) + 1; });
    return c;
  }, [graph]);

  const TYPE_COLORS: Record<string,string> = {
    all:"#00D2FF", person:"#00D2FF", org:"#FFB300", location:"#00FFB2", concept:"#CC44FF"
  };

  return (
    <div className="flex flex-col h-full">
      {/* Graph Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-cyan-500/15 bg-[rgba(2,8,16,0.9)] flex-shrink-0">
        <div className="flex items-center gap-1.5">
          <span className="font-display text-[0.56rem] tracking-[0.2em] text-cyan-400/60 uppercase mr-2">
            Filter:
          </span>
          {[
            { key:"all",      label:`ALL (${counts.all})` },
            { key:"person",   label:`PERSONS (${counts.person||0})` },
            { key:"org",      label:`ORGS (${counts.org||0})` },
            { key:"location", label:`LOCS (${counts.location||0})` },
            { key:"concept",  label:`CONCEPTS (${counts.concept||0})` },
          ].map(({ key, label }) => (
            <button key={key} onClick={() => setFilter(key)}
              className="text-[0.5rem] px-2 py-0.5 rounded-sm border font-mono tracking-wider uppercase transition-all"
              style={filter === key
                ? { borderColor: TYPE_COLORS[key], color: TYPE_COLORS[key], background: TYPE_COLORS[key]+"18" }
                : { borderColor: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.25)" }}>
              {label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3 text-[0.52rem] text-white/20">
          {selectedEntity && (
            <span style={{ color: "#00D2FF" }}>
              SELECTED: {selectedEntity.label.toUpperCase()}
            </span>
          )}
          <span>{filtered.links.length} CONNECTIONS</span>
          <span>{filtered.nodes.length} NODES</span>
        </div>
      </div>

      {/* Graph Canvas */}
      <div className="flex-1 relative overflow-hidden">
        {graph.nodes.length === 0 ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
            <div className="font-display text-[0.7rem] text-cyan-400/30 tracking-widest animate-pulse">
              EXTRACTING ENTITIES...
            </div>
            <div className="text-[0.58rem] text-white/15">Waiting for news feed data</div>
          </div>
        ) : (
          <>
            <EntityGraph
              graph={filtered}
              selectedId={selectedEntity?.id || null}
              onSelect={onSelect}
              highlightIds={highlightIds}
            />
            {/* Corner watermarks */}
            <div className="absolute top-2 left-3 font-display text-[0.48rem] tracking-[0.22em] text-cyan-400/15 uppercase pointer-events-none">
              ENTITY RESOLUTION ENGINE // PHASE-2
            </div>
            <div className="absolute bottom-2 right-3 text-[0.48rem] text-white/10 pointer-events-none">
              drag nodes · click to inspect · scroll to zoom
            </div>
          </>
        )}
      </div>
    </div>
  );
}
