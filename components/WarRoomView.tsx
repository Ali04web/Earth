"use client";
import { useState, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import WarRoomComms from "./WarRoomComms";
import type { Article } from "@/app/api/news/route";
import type { EntityGraph } from "@/lib/entityExtractor";
import type { AlertPipeline, Alert } from "@/lib/riskEngine";
import type { Analyst, WarRoomPin, WarRoomMessage } from "@/lib/warRoom";
import { initWarRoom, getSelf, updateStatus, removePin } from "@/lib/warRoom";

const Globe = dynamic(() => import("./Globe"), { ssr: false });

interface Props {
  articles: Article[];
  activeSources: Set<string>;
  graph: EntityGraph;
  pipeline: AlertPipeline;
  analysts: Analyst[];
  pins: WarRoomPin[];
  messages: WarRoomMessage[];
  onLocalMessage: (m: WarRoomMessage) => void;
  onLocalPin: (p: WarRoomPin) => void;
  onLocalRemovePin: (id: string) => void;
  onShowReport: () => void;
}

export default function WarRoomView({
  articles, activeSources, graph, pipeline,
  analysts, pins, messages,
  onLocalMessage, onLocalPin, onLocalRemovePin, onShowReport
}: Props) {
  const [flyTo, setFlyTo] = useState<[number,number]|null>(null);
  const me = getSelf();
  const activeAlerts = pipeline.alerts.filter(a => !a.acknowledged);

  useEffect(() => { updateStatus("active", "warroom"); }, []);

  const handlePinHover  = useCallback(() => {}, []);
  const handlePinClick  = useCallback((art: Article) => {
    if (art.link && art.link !== "#") window.open(art.link, "_blank");
  }, []);
  const handleRotate    = useCallback(() => {}, []);
  const handlePinFly    = useCallback((lat: number, lon: number) => setFlyTo([lat, lon]), []);

  // Combine news articles with war room pins as "articles" with fake geo
  const warRoomArticles = articles;

  return (
    <div className="flex h-full overflow-hidden">
      {/* Globe with war room overlays */}
      <div className="flex-1 relative overflow-hidden">
        {/* War room header overlay */}
        <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-4 py-2 bg-gradient-to-b from-[rgba(2,8,16,0.85)] to-transparent pointer-events-none">
          <div className="font-display text-[0.55rem] tracking-[0.28em] text-cyan-400/35 uppercase">
            WAR ROOM // COLLABORATIVE INTELLIGENCE // PHASE-4
          </div>
          <div className="flex items-center gap-3 pointer-events-auto">
            <button onClick={onShowReport}
              className="flex items-center gap-1.5 px-3 py-1 bg-cyan-500/12 border border-cyan-500/35 text-cyan-400 text-[0.54rem] rounded-sm hover:bg-cyan-500/20 transition-all font-display tracking-widest uppercase">
              ◈ GENERATE BRIEF
            </button>
          </div>
        </div>

        <Globe
          articles={warRoomArticles}
          activeSources={activeSources}
          onPinHover={handlePinHover}
          onPinClick={handlePinClick}
          onRotate={handleRotate}
          flyTo={flyTo}
        />

        {/* Alert ticker */}
        {activeAlerts.length > 0 && (
          <div className="absolute bottom-0 left-0 right-0 bg-red-500/[0.08] border-t border-red-500/20 overflow-hidden h-8">
            <div className="flex items-center h-full">
              <span className="text-[0.52rem] text-red-400 font-bold px-3 border-r border-red-500/20 flex-shrink-0 tracking-widest">
                ⚠ ACTIVE
              </span>
              <div className="overflow-hidden flex-1">
                <div className="animate-ticker whitespace-nowrap text-[0.56rem] text-red-400/70 font-mono">
                  {activeAlerts.map(a => `⚠ ${a.severity.toUpperCase()}: ${a.title}`).join("   //   ")}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Pin overlays on globe (visual indicators) */}
        {pins.length > 0 && (
          <div className="absolute top-12 left-4 flex flex-col gap-1.5">
            {pins.slice(0,5).map(pin => (
              <div key={pin.id}
                onClick={() => handlePinFly(pin.lat, pin.lon)}
                className="flex items-center gap-1.5 px-2 py-1 rounded-sm cursor-pointer transition-all hover:scale-105"
                style={{ background: pin.color+"18", border: `1px solid ${pin.color}44` }}>
                <div className="w-1.5 h-1.5 rounded-full" style={{ background: pin.color }} />
                <span className="text-[0.52rem]" style={{ color: pin.color }}>{pin.label}</span>
              </div>
            ))}
          </div>
        )}

        {/* Live stats overlay */}
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex gap-6 text-[0.52rem] text-cyan-400/28 tracking-widest pointer-events-none">
          <span>ANALYSTS: <span className="text-cyan-400">{analysts.length + 1}</span></span>
          <span>PINS: <span className="text-cyan-400">{pins.length}</span></span>
          <span>ALERTS: <span className={activeAlerts.length > 0 ? "text-red-400" : "text-white/30"}>{activeAlerts.length}</span></span>
          <span>RISK: <span style={{ color: pipeline.riskScore.overall >= 70 ? "#FF3344" : pipeline.riskScore.overall >= 45 ? "#FFB300" : "#00FFB2" }}>{pipeline.riskScore.overall}</span></span>
        </div>
      </div>

      {/* Comms + pins panel */}
      <div className="w-[280px] flex-shrink-0 border-l border-cyan-500/15 bg-[rgba(3,12,22,0.97)] flex flex-col overflow-hidden">
        {/* Panel header */}
        <div className="flex items-center justify-between px-3 py-2.5 border-b border-cyan-500/15 bg-cyan-500/[0.04] flex-shrink-0">
          <div>
            <div className="font-display text-[0.58rem] tracking-[0.2em] text-cyan-400 uppercase">
              ⊕ War Room
            </div>
            <div className="text-[0.48rem] text-white/20 mt-0.5">
              {analysts.length + 1} analyst{analysts.length+1!==1?"s":""} · {messages.filter(m=>m.type==="chat").length} messages
            </div>
          </div>
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        </div>

        {/* Status summary */}
        <div className="grid grid-cols-3 border-b border-cyan-500/10 flex-shrink-0">
          {[
            { val: pipeline.riskScore.overall, label:"RISK", color: pipeline.riskScore.overall >= 70 ? "#FF3344" : "#00FFB2" },
            { val: activeAlerts.length,         label:"ALERTS", color: activeAlerts.length > 0 ? "#FF3344" : "rgba(168,200,216,0.3)" },
            { val: pins.length,                 label:"PINS",   color: "#00D2FF" },
          ].map(({ val, label, color }) => (
            <div key={label} className="py-2 text-center border-r last:border-r-0 border-cyan-500/10">
              <div className="font-display text-base font-bold" style={{ color }}>{val}</div>
              <div className="text-[0.44rem] text-white/20 tracking-widest uppercase mt-0.5">{label}</div>
            </div>
          ))}
        </div>

        {/* Comms */}
        <div className="flex-1 overflow-hidden">
          <WarRoomComms
            analysts={analysts}
            messages={messages}
            pins={pins}
            onLocalMessage={onLocalMessage}
            onLocalPin={onLocalPin}
            onLocalRemovePin={(id) => { removePin(id); onLocalRemovePin(id); }}
            onPinClick={handlePinFly}
          />
        </div>
      </div>
    </div>
  );
}
