"use client";
import type { Article } from "@/app/api/news/route";
import { CAT_HEX } from "@/lib/constants";

interface Props {
  article: Article | null;
  x: number;
  y: number;
}

function timeAgo(iso: string) {
  const sec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (sec < 60) return sec + "s ago";
  if (sec < 3600) return Math.floor(sec/60) + "m ago";
  if (sec < 86400) return Math.floor(sec/3600) + "h ago";
  return Math.floor(sec/86400) + "d ago";
}

export default function NewsPopup({ article, x, y }: Props) {
  if (!article) return null;
  const color = CAT_HEX[article.cat] || "#00D2FF";

  return (
    <div
      className="absolute z-50 bg-[rgba(2,10,20,0.97)] border border-cyan-400/60 rounded-sm p-3 max-w-[260px] pointer-events-none glow-box"
      style={{ left: x + 14, top: y - 14 }}
    >
      <div className="font-display text-[0.52rem] tracking-[0.15em] text-cyan-400 uppercase mb-1">
        {article.sourceName} // 1 STORY
      </div>
      <div
        className="inline-block text-[0.5rem] px-1.5 py-0.5 rounded-sm border mb-1.5 font-bold tracking-widest"
        style={{ color, borderColor: color }}
      >
        {article.cat.toUpperCase()}
      </div>
      <div className="text-[0.68rem] text-slate-100 leading-snug mb-1.5">{article.title}</div>
      {article.geo && (
        <div className="text-[0.58rem] text-amber-400">▸ {article.geo.name}</div>
      )}
      <div className="text-[0.52rem] text-white/25 mt-1">
        {timeAgo(article.pubDate)} · click to open ↗
      </div>
    </div>
  );
}
