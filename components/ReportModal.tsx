"use client";
import { useState } from "react";
import type { ReportOptions } from "@/lib/reportGenerator";
import { getSelf } from "@/lib/warRoom";

interface Props {
  onGenerate: (opts: ReportOptions) => void;
  onClose: () => void;
}

const SECTIONS: { key: keyof ReportOptions["includeSections"]; label: string; desc: string }[] = [
  { key:"executive",      label:"Executive Summary",    desc:"High-level risk overview and key findings" },
  { key:"riskAssessment", label:"Risk Assessment",      desc:"Dimension scores + top threat entities" },
  { key:"alertSummary",   label:"Alert Summary",        desc:"Active alerts with severity and scores" },
  { key:"topStories",     label:"Top Stories",          desc:"Latest intelligence articles (top 12)" },
  { key:"entityAnalysis", label:"Entity Analysis",      desc:"Resolved entities with risk scores" },
  { key:"regionRisks",    label:"Regional Risks",       desc:"Geographic risk heatmap table" },
  { key:"warRoomNotes",   label:"War Room Notes",       desc:"Analyst comms from this session" },
];

const CLASSIFICATIONS = ["UNCLASSIFIED","CONFIDENTIAL","SECRET","TOP SECRET","TOP SECRET // SCI","TS/SCI // NOFORN"];

export default function ReportModal({ onGenerate, onClose }: Props) {
  const me = getSelf();
  const [title, setTitle]           = useState(`SENTINEL INTELLIGENCE BRIEF — ${new Date().toUTCString().slice(5,16).toUpperCase()}`);
  const [classification, setClass]  = useState("TOP SECRET");
  const [analyst, setAnalyst]       = useState(`ANALYST ${me.name}`);
  const [sections, setSections]     = useState<ReportOptions["includeSections"]>({
    executive:true, riskAssessment:true, topStories:true,
    entityAnalysis:true, alertSummary:true, regionRisks:true, warRoomNotes:true,
  });

  function toggle(key: keyof typeof sections) {
    setSections(s => ({ ...s, [key]: !s[key] }));
  }

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/70">
      <div className="w-[520px] max-h-[90vh] overflow-y-auto custom-scroll bg-[#020A10] border border-cyan-500/30 rounded-sm glow-box">
        {/* Header */}
        <div className="px-5 py-4 border-b border-cyan-500/15 bg-cyan-500/[0.04]">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-display text-[0.68rem] tracking-[0.22em] text-cyan-400 uppercase">
                ◈ Generate Intelligence Report
              </div>
              <div className="text-[0.54rem] text-white/25 mt-0.5">HTML brief — downloadable, printable</div>
            </div>
            <button onClick={onClose} className="text-white/20 hover:text-white/60 text-lg transition-colors">✕</button>
          </div>
        </div>

        <div className="px-5 py-4 flex flex-col gap-4">
          {/* Title */}
          <div>
            <label className="block text-[0.52rem] tracking-widest text-white/30 uppercase mb-1.5">Report Title</label>
            <input value={title} onChange={e => setTitle(e.target.value)}
              className="w-full bg-white/[0.03] border border-cyan-500/15 text-[0.64rem] text-slate-200 px-3 py-2 rounded-sm outline-none focus:border-cyan-500/40 font-mono" />
          </div>

          {/* Classification */}
          <div>
            <label className="block text-[0.52rem] tracking-widest text-white/30 uppercase mb-1.5">Classification</label>
            <div className="flex gap-1.5 flex-wrap">
              {CLASSIFICATIONS.map(c => (
                <button key={c} onClick={() => setClass(c)}
                  className={`text-[0.5rem] px-2 py-1 rounded-sm border transition-all tracking-wider ${
                    classification === c
                      ? "border-amber-400 text-amber-400 bg-amber-500/10"
                      : "border-white/10 text-white/25 hover:border-white/25"
                  }`}>
                  {c}
                </button>
              ))}
            </div>
          </div>

          {/* Analyst */}
          <div>
            <label className="block text-[0.52rem] tracking-widest text-white/30 uppercase mb-1.5">Prepared By</label>
            <input value={analyst} onChange={e => setAnalyst(e.target.value)}
              className="w-full bg-white/[0.03] border border-cyan-500/15 text-[0.64rem] text-slate-200 px-3 py-2 rounded-sm outline-none focus:border-cyan-500/40 font-mono" />
          </div>

          {/* Sections */}
          <div>
            <label className="block text-[0.52rem] tracking-widest text-white/30 uppercase mb-2">Include Sections</label>
            <div className="flex flex-col gap-1.5">
              {SECTIONS.map(s => (
                <div key={s.key}
                  onClick={() => toggle(s.key)}
                  className={`flex items-start gap-3 px-3 py-2 rounded-sm border cursor-pointer transition-all ${
                    sections[s.key]
                      ? "border-cyan-500/30 bg-cyan-500/[0.06]"
                      : "border-white/5 hover:border-white/10"
                  }`}>
                  <div className={`w-4 h-4 rounded-sm border mt-0.5 flex-shrink-0 flex items-center justify-center transition-all ${
                    sections[s.key] ? "border-cyan-400 bg-cyan-400" : "border-white/20"
                  }`}>
                    {sections[s.key] && <span className="text-black text-[0.6rem] font-bold">✓</span>}
                  </div>
                  <div>
                    <div className={`text-[0.62rem] font-bold ${sections[s.key] ? "text-slate-100" : "text-white/35"}`}>
                      {s.label}
                    </div>
                    <div className="text-[0.53rem] text-white/25 mt-0.5">{s.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-cyan-500/10 flex items-center justify-between bg-[rgba(2,8,16,0.6)]">
          <span className="text-[0.52rem] text-white/20">
            {Object.values(sections).filter(Boolean).length} sections selected
          </span>
          <div className="flex gap-2">
            <button onClick={onClose}
              className="px-4 py-1.5 border border-white/10 text-white/30 text-[0.56rem] rounded-sm hover:text-white/60 transition-all">
              CANCEL
            </button>
            <button
              onClick={() => onGenerate({ title, classification, analystName: analyst, includeSections: sections })}
              className="px-5 py-1.5 bg-cyan-500/15 border border-cyan-500/40 text-cyan-400 text-[0.56rem] rounded-sm hover:bg-cyan-500/25 transition-all font-display tracking-widest uppercase">
              ↓ GENERATE BRIEF
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
