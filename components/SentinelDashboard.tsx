"use client";
import { useState, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import type { Article } from "@/app/api/news/route";
import TopBar from "./TopBar";
import FeedPanel from "./FeedPanel";
import NewsPopup from "./NewsPopup";

const Globe = dynamic(() => import("./Globe"), { ssr: false, loading: () => (
  <div className="flex-1 flex items-center justify-center bg-[#020A10]">
    <div className="font-display text-cyan-400/40 text-sm tracking-widest animate-pulse">
      INITIALIZING GLOBE...
    </div>
  </div>
)});

export default function SentinelDashboard() {
  const [articles, setArticles]         = useState<Article[]>([]);
  const [activeSources, setActiveSources] = useState(new Set(["bbc","guardian","aljazeera","reuters"]));
  const [fetchStatus, setFetchStatus]   = useState("INITIALIZING...");
  const [popup, setPopup]               = useState<{ art: Article; x: number; y: number } | null>(null);
  const [flyTo, setFlyTo]               = useState<[number,number] | null>(null);
  const [coords, setCoords]             = useState({ lat: 0, lon: 0 });
  const [pinCount, setPinCount]         = useState(0);
  const lastFetchRef                    = useRef<string>("--");
  const hasFetchedRef                   = useRef(false);

  const fetchNews = useCallback(async () => {
    setFetchStatus("FETCHING FEEDS...");
    try {
      const res  = await fetch("/api/news");
      const data = await res.json();
      setArticles(data.articles);
      setPinCount(data.articles.filter((a: Article) => a.geo).length);
      const now = new Date();
      const pad = (v: number) => String(v).padStart(2,"0");
      lastFetchRef.current = `${pad(now.getUTCHours())}:${pad(now.getUTCMinutes())}:${pad(now.getUTCSeconds())} UTC`;
      setFetchStatus(`LIVE — ${data.articles.length} STORIES`);
    } catch {
      setFetchStatus("FEED ERROR — RETRY");
    }
  }, []);

  // Auto-fetch on mount
  if (!hasFetchedRef.current) {
    hasFetchedRef.current = true;
    setTimeout(fetchNews, 100);
    setInterval(fetchNews, 5 * 60 * 1000);
  }

  const toggleSource = useCallback((src: string) => {
    setActiveSources(prev => {
      const next = new Set(prev);
      next.has(src) ? next.delete(src) : next.add(src);
      return next;
    });
  }, []);

  const handleArticleClick = useCallback((art: Article) => {
    if (art.geo) setFlyTo(art.geo.coords);
    if (art.link && art.link !== "#") window.open(art.link, "_blank");
  }, []);

  const handlePinHover = useCallback((art: Article | null, x: number, y: number) => {
    setPopup(art ? { art, x, y } : null);
  }, []);

  const handlePinClick = useCallback((art: Article) => {
    if (art.link && art.link !== "#") window.open(art.link, "_blank");
  }, []);

  const handleRotate = useCallback((lat: number, lon: number) => {
    setCoords({ lat, lon });
  }, []);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden">
      <TopBar
        fetchStatus={fetchStatus}
        articleCount={articles.length}
        onRefresh={fetchNews}
      />

      <div className="flex flex-1 overflow-hidden">
        <FeedPanel
          articles={articles}
          activeSources={activeSources}
          onSourceToggle={toggleSource}
          onArticleClick={handleArticleClick}
        />

        {/* Globe area */}
        <div className="flex-1 relative overflow-hidden">
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 font-display text-[0.58rem] tracking-[0.32em] text-cyan-400/30 uppercase pointer-events-none whitespace-nowrap">
            GLOBAL OSINT SURVEILLANCE // LIVE NEWS OVERLAY // PHASE-1
          </div>

          <Globe
            articles={articles}
            activeSources={activeSources}
            onPinHover={handlePinHover}
            onPinClick={handlePinClick}
            onRotate={handleRotate}
            flyTo={flyTo}
          />

          {/* Coords bar */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-5 text-[0.58rem] text-cyan-400/30 tracking-widest pointer-events-none">
            <span>LAT: {coords.lat.toFixed(2)}°</span>
            <span>LON: {coords.lon.toFixed(2)}°</span>
            <span>PINS: <span className="text-cyan-400">{pinCount}</span></span>
            <span>LAST: {lastFetchRef.current}</span>
          </div>

          {/* Pin count badge */}
          <div className="absolute top-3 right-4 font-display text-[0.6rem] text-cyan-400/40 tracking-widest">
            {pinCount} PINS ACTIVE
          </div>

          {/* Popup */}
          {popup && (
            <NewsPopup article={popup.art} x={popup.x} y={popup.y} />
          )}
        </div>
      </div>

      {/* Bottom bar */}
      <footer className="flex items-center justify-between px-4 h-7 bg-[rgba(1,8,16,0.98)] border-t border-cyan-500/15 flex-shrink-0">
        <span className="text-[0.52rem] text-white/20 tracking-wider">
          SENTINEL v3.2 // OSINT GLOBE PHASE-1 // FREE TIER — RSS + OPEN DATA
        </span>
        <div className="flex gap-4 text-[0.52rem] text-white/20">
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block"/>
            PRIMARY NOMINAL
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 inline-block"/>
            AES-256
          </span>
          <span>SOURCES: BBC · GUARDIAN · AL JAZEERA · REUTERS</span>
        </div>
      </footer>
    </div>
  );
}
