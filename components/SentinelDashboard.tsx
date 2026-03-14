"use client";
import { useState, useCallback, useRef, useMemo, useEffect } from "react";
import dynamic from "next/dynamic";
import type { Article } from "@/app/api/news/route";
import type { Entity } from "@/lib/entityExtractor";
import type { Alert } from "@/lib/riskEngine";
import type { Analyst, WarRoomPin, WarRoomMessage } from "@/lib/warRoom";
import { extractEntities } from "@/lib/entityExtractor";
import { runAlertPipeline } from "@/lib/riskEngine";
import { initWarRoom, getSelf, updateStatus } from "@/lib/warRoom";
import { generateHTMLReport, downloadReport } from "@/lib/reportGenerator";
import TopBar from "./TopBar";
import FeedPanel from "./FeedPanel";
import NewsPopup from "./NewsPopup";
import EntityPanel from "./EntityPanel";
import GraphView from "./GraphView";
import RiskDashboard from "./RiskDashboard";
import AlertToast from "./AlertToast";
import WarRoomView from "./WarRoomView";
import ReportModal from "./ReportModal";

const Globe = dynamic(() => import("./Globe"), {
  ssr: false,
  loading: () => (
    <div className="flex-1 flex items-center justify-center bg-[#020A10]">
      <div className="font-display text-cyan-400/40 text-sm tracking-widest animate-pulse">
        INITIALIZING GLOBE...
      </div>
    </div>
  ),
});

type View = "globe" | "graph" | "risk" | "warroom";

export default function SentinelDashboard() {
  const [articles, setArticles]             = useState<Article[]>([]);
  const [activeSources, setActiveSources]   = useState(new Set(["bbc","guardian","aljazeera","reuters"]));
  const [fetchStatus, setFetchStatus]       = useState("INITIALIZING...");
  const [popup, setPopup]                   = useState<{ article: Article; x: number; y: number } | null>(null);
  const [flyTo, setFlyTo]                   = useState<[number,number] | null>(null);
  const [coords, setCoords]                 = useState({ lat: 0, lon: 0 });
  const [pinCount, setPinCount]             = useState(0);
  const [view, setView]                     = useState<View>("globe");
  const [selectedEntity, setSelectedEntity] = useState<Entity | null>(null);
  const [dismissedAlerts, setDismissedAlerts] = useState(new Set<string>());
  const [ackedAlerts, setAckedAlerts]       = useState(new Set<string>());
  const [showReport, setShowReport]         = useState(false);
  const [mobileFeedOpen, setMobileFeedOpen] = useState(false);
  const [mobileEntityOpen, setMobileEntityOpen] = useState(false);
  // War room state
  const [analysts, setAnalysts]             = useState<Analyst[]>([]);
  const [warPins, setWarPins]               = useState<WarRoomPin[]>([]);
  const [warMessages, setWarMessages]       = useState<WarRoomMessage[]>([]);
  const lastFetchRef = useRef<string>("--");
  const initRef      = useRef(false);

  const graph    = useMemo(() => extractEntities(articles), [articles]);
  const pipeline = useMemo(() => {
    const raw = runAlertPipeline(articles, graph);
    raw.alerts = raw.alerts
      .filter(a => !dismissedAlerts.has(a.id))
      .map(a => ({ ...a, acknowledged: ackedAlerts.has(a.id) }));
    return raw;
  }, [articles, graph, dismissedAlerts, ackedAlerts]);

  const criticalCount = pipeline.alerts.filter(a => a.severity === "critical" && !a.acknowledged).length;
  const activeAlerts  = pipeline.alerts.filter(a => !a.acknowledged).length;

  const highlightIds = useMemo(() => {
    if (!selectedEntity) return undefined;
    const ids = new Set<string>([selectedEntity.id]);
    graph.links.forEach(l => {
      if (l.source === selectedEntity.id) ids.add(l.target);
      if (l.target === selectedEntity.id) ids.add(l.source);
    });
    return ids;
  }, [selectedEntity, graph]);

  // War room init
  useEffect(() => {
    const me = getSelf();
    const cleanup = initWarRoom(event => {
      if (event.kind === "analyst_join") {
        if (event.payload.id === me.id) return;
        setAnalysts(prev => {
          if (prev.find(a => a.id === event.payload.id)) return prev;
          return [...prev, event.payload];
        });
      }
      if (event.kind === "analyst_update") {
        setAnalysts(prev => prev.map(a =>
          a.id === event.payload.id ? { ...a, ...event.payload } : a
        ));
      }
      if (event.kind === "analyst_leave") {
        setAnalysts(prev => prev.filter(a => a.id !== event.payload.id));
      }
      if (event.kind === "pin_add") {
        setWarPins(prev => prev.find(p => p.id === event.payload.id) ? prev : [...prev, event.payload]);
      }
      if (event.kind === "pin_remove") {
        setWarPins(prev => prev.filter(p => p.id !== event.payload.id));
      }
      if (event.kind === "message") {
        if (event.payload.analystId === me.id) return;
        setWarMessages(prev => [...prev, event.payload]);
      }
    });
    return cleanup;
  }, []);

  useEffect(() => { updateStatus("active", view); }, [view]);

  // Close mobile drawers on view change
  useEffect(() => { setMobileFeedOpen(false); setMobileEntityOpen(false); }, [view]);

  const fetchNews = useCallback(async () => {
    setFetchStatus("FETCHING FEEDS...");
    try {
      const res  = await fetch("/api/news");
      const data = await res.json();
      setArticles(data.articles);
      setPinCount(data.articles.filter((a: Article) => a.geo).length);
      const now = new Date();
      const pad = (v: number) => String(v).padStart(2, "0");
      lastFetchRef.current = `${pad(now.getUTCHours())}:${pad(now.getUTCMinutes())}:${pad(now.getUTCSeconds())} UTC`;
      setFetchStatus(`LIVE — ${data.articles.length} STORIES`);
    } catch {
      setFetchStatus("FEED ERROR — RETRY");
    }
  }, []);

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;
    fetchNews();
    const id = setInterval(fetchNews, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [fetchNews]);

  const toggleSource    = useCallback((src: string) => {
    setActiveSources(prev => { const n = new Set(prev); n.has(src) ? n.delete(src) : n.add(src); return n; });
  }, []);
  const handleArticleClick = useCallback((art: Article) => {
    if (art.geo) { setFlyTo(art.geo.coords); if (view !== "risk" && view !== "warroom") setView("globe"); }
    if (art.link && art.link !== "#") window.open(art.link, "_blank");
    setMobileFeedOpen(false);
  }, [view]);
  const handlePinHover  = useCallback((art: Article | null, x: number, y: number) => {
    setPopup(art ? { article: art, x, y } : null);
  }, []);
  const handlePinClick  = useCallback((art: Article) => {
    if (art.link && art.link !== "#") window.open(art.link, "_blank");
  }, []);
  const handleRotate    = useCallback((lat: number, lon: number) => setCoords({ lat, lon }), []);
  const handleEntitySel = useCallback((e: Entity | null) => setSelectedEntity(e), []);
  const handleAck       = useCallback((id: string) => setAckedAlerts(prev => new Set([...prev, id])), []);
  const handleDismiss   = useCallback((id: string) => setDismissedAlerts(prev => new Set([...prev, id])), []);
  const handleAlertClick = useCallback((alert: Alert) => {
    const art = articles.find(a => alert.articleIds.includes(a.id) && a.geo);
    if (art?.geo) setFlyTo(art.geo.coords);
    setView("globe");
  }, [articles]);

  const handleLocalMessage = useCallback((m: WarRoomMessage) => {
    setWarMessages(prev => [...prev, m]);
  }, []);
  const handleLocalPin = useCallback((p: WarRoomPin) => {
    setWarPins(prev => [...prev, p]);
  }, []);
  const handleLocalRemovePin = useCallback((id: string) => {
    setWarPins(prev => prev.filter(p => p.id !== id));
  }, []);

  const handleGenerateReport = useCallback((opts: any) => {
    const html = generateHTMLReport(articles, graph, pipeline, warPins, warMessages, opts);
    const date  = new Date().toISOString().slice(0,10);
    downloadReport(html, `sentinel-brief-${date}.html`);
    setShowReport(false);
  }, [articles, graph, pipeline, warPins, warMessages]);

  const TABS: { key: View; icon: string; label: string; sub: string; badge?: number }[] = [
    { key:"globe",   icon:"⊕", label:"GLOBE",       sub:`${pinCount} pins` },
    { key:"graph",   icon:"⬡", label:"ENTITY GRAPH", sub:`${graph.nodes.length} nodes` },
    { key:"risk",    icon:"⚠", label:"RISK CENTER",  sub:`score ${pipeline.riskScore.overall}`, badge: criticalCount || undefined },
    { key:"warroom", icon:"◎", label:"WAR ROOM",     sub:`${analysts.length+1} analysts · ${warMessages.filter(m=>m.type==="chat").length} msgs` },
  ];

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden">
      <TopBar
        fetchStatus={fetchStatus}
        articleCount={articles.length}
        entityCount={graph.nodes.length}
        connectionCount={graph.links.length}
        riskScore={pipeline.riskScore.overall}
        activeAlerts={activeAlerts}
        onRefresh={fetchNews}
        onReport={() => setShowReport(true)}
        onToggleFeed={() => setMobileFeedOpen(p => !p)}
      />

      <div className="flex flex-1 overflow-hidden relative">
        {/* Left feed panel — desktop: inline; mobile: slide-over */}
        {view !== "warroom" && (
          <>
            {/* Desktop sidebar */}
            <div className="hidden md:flex">
              <FeedPanel
                articles={articles}
                activeSources={activeSources}
                onSourceToggle={toggleSource}
                onArticleClick={handleArticleClick}
              />
            </div>
            {/* Mobile drawer overlay */}
            {mobileFeedOpen && (
              <div className="md:hidden fixed inset-0 z-40 flex">
                <div className="absolute inset-0 bg-black/60" onClick={() => setMobileFeedOpen(false)} />
                <div className="relative z-50 w-[85vw] max-w-[340px] h-full animate-slide-in">
                  <FeedPanel
                    articles={articles}
                    activeSources={activeSources}
                    onSourceToggle={toggleSource}
                    onArticleClick={handleArticleClick}
                  />
                </div>
              </div>
            )}
          </>
        )}

        {/* Centre */}
        <div className="flex-1 relative overflow-hidden flex flex-col min-w-0">
          {/* Tabs — scrollable on mobile */}
          <div className="flex items-center border-b border-cyan-500/15 bg-[rgba(2,8,16,0.95)] flex-shrink-0 overflow-x-auto no-scrollbar">
            {TABS.map(tab => (
              <button key={tab.key} onClick={() => setView(tab.key)}
                className={`relative flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-2 sm:py-2.5 border-r border-cyan-500/10 transition-all group flex-shrink-0 ${
                  view === tab.key ? "bg-cyan-500/[0.08] border-b-2 border-b-cyan-400" : "hover:bg-cyan-500/[0.04]"
                }`}>
                <span className={`text-sm sm:text-base leading-none ${
                  view === tab.key ? "text-cyan-400"
                  : tab.key === "risk" && criticalCount > 0 ? "text-red-400"
                  : tab.key === "warroom" ? "text-emerald-400/70"
                  : "text-white/30 group-hover:text-white/50"
                }`}>{tab.icon}</span>
                <div className="text-left">
                  <div className={`font-display text-[0.48rem] sm:text-[0.55rem] tracking-[0.14em] sm:tracking-[0.18em] ${
                    view === tab.key ? "text-cyan-400" : "text-white/35 group-hover:text-white/55"
                  }`}>{tab.label}</div>
                  <div className="text-[0.38rem] sm:text-[0.44rem] text-white/18 hidden sm:block">{tab.sub}</div>
                </div>
                {tab.badge && tab.badge > 0 && (
                  <span className="absolute top-1 right-0.5 sm:top-1.5 sm:right-1 w-3 h-3 sm:w-3.5 sm:h-3.5 rounded-full bg-red-500 text-white text-[0.36rem] sm:text-[0.42rem] font-bold flex items-center justify-center animate-pulse">
                    {tab.badge}
                  </span>
                )}
              </button>
            ))}
            <div className="flex-1 min-w-0" />
            {/* Tab bar actions — hidden on mobile */}
            <div className="hidden sm:flex items-center gap-4 px-4 flex-shrink-0">
              <div className="flex items-center gap-1.5">
                <span className="text-[0.46rem] text-white/18 uppercase tracking-widest">RISK</span>
                <span className={`font-display text-[0.68rem] font-bold ${pipeline.riskScore.overall >= 70 ? "text-red-400" : pipeline.riskScore.overall >= 45 ? "text-amber-400" : "text-emerald-400"}`}>
                  {pipeline.riskScore.overall}
                </span>
                <span className={`text-[0.52rem] ${pipeline.riskScore.trend === "rising" ? "text-red-400" : pipeline.riskScore.trend === "falling" ? "text-emerald-400" : "text-white/18"}`}>
                  {pipeline.riskScore.trend === "rising" ? "▲" : pipeline.riskScore.trend === "falling" ? "▼" : "—"}
                </span>
              </div>
              {activeAlerts > 0 && (
                <button onClick={() => setView("risk")} className="flex items-center gap-1">
                  <span className="text-[0.5rem] text-red-400 animate-blink">⚠</span>
                  <span className="text-[0.5rem] text-red-400 font-bold">{activeAlerts}</span>
                </button>
              )}
              <button onClick={() => setShowReport(true)}
                className="text-[0.5rem] px-2.5 py-1 border border-cyan-500/25 text-cyan-400/60 rounded-sm hover:border-cyan-400 hover:text-cyan-400 transition-all font-display tracking-widest uppercase">
                ◈ BRIEF
              </button>
            </div>
          </div>

          {/* View content */}
          <div className="flex-1 relative overflow-hidden">
            {/* Globe */}
            <div className={`absolute inset-0 ${view === "globe" ? "block" : "hidden"}`}>
              <div className="absolute top-2 sm:top-3 left-1/2 -translate-x-1/2 z-10 font-display text-[0.42rem] sm:text-[0.52rem] tracking-[0.2em] sm:tracking-[0.3em] text-cyan-400/20 uppercase pointer-events-none whitespace-nowrap">
                OSINT // LIVE NEWS // SEN
              </div>
              <Globe
                articles={articles}
                activeSources={activeSources}
                onPinHover={handlePinHover}
                onPinClick={handlePinClick}
                onRotate={handleRotate}
                flyTo={flyTo}
              />
              <div className="absolute bottom-2 sm:bottom-4 left-1/2 -translate-x-1/2 flex gap-3 sm:gap-5 text-[0.42rem] sm:text-[0.5rem] text-cyan-400/22 tracking-widest pointer-events-none">
                <span>LAT: {coords.lat.toFixed(2)}°</span>
                <span>LON: {coords.lon.toFixed(2)}°</span>
                <span>PINS: <span className="text-cyan-400">{pinCount}</span></span>
                <span className="hidden sm:inline">LAST: {lastFetchRef.current}</span>
              </div>
              {popup && <NewsPopup article={popup.article} x={popup.x} y={popup.y} />}
            </div>

            {/* Graph */}
            <div className={`absolute inset-0 flex ${view === "graph" ? "flex" : "hidden"}`}>
              <GraphView graph={graph} selectedEntity={selectedEntity} onSelect={handleEntitySel} highlightIds={highlightIds} />
            </div>

            {/* Risk */}
            <div className={`absolute inset-0 overflow-auto ${view === "risk" ? "block" : "hidden"}`}>
              <RiskDashboard pipeline={pipeline} onAcknowledge={handleAck} onDismiss={handleDismiss} onAlertClick={handleAlertClick} />
            </div>

            {/* War Room */}
            <div className={`absolute inset-0 ${view === "warroom" ? "block" : "hidden"}`}>
              <WarRoomView
                articles={articles}
                activeSources={activeSources}
                graph={graph}
                pipeline={pipeline}
                analysts={analysts}
                pins={warPins}
                messages={warMessages}
                onLocalMessage={handleLocalMessage}
                onLocalPin={handleLocalPin}
                onLocalRemovePin={handleLocalRemovePin}
                onShowReport={() => setShowReport(true)}
              />
            </div>
          </div>
        </div>

        {/* Right entity panel — desktop: inline; mobile: slide-over */}
        {view === "graph" && (
          <>
            {/* Desktop sidebar */}
            <div className="hidden md:flex">
              <EntityPanel
                graph={graph}
                selected={selectedEntity}
                articles={articles}
                onArticleClick={handleArticleClick}
                onEntityClick={handleEntitySel}
              />
            </div>
            {/* Mobile toggle button */}
            <button
              onClick={() => setMobileEntityOpen(p => !p)}
              className="md:hidden absolute top-14 right-2 z-30 text-[0.5rem] px-2 py-1 bg-cyan-500/10 border border-cyan-500/25 text-cyan-400 rounded-sm"
            >
              {mobileEntityOpen ? "✕ CLOSE" : "◉ ENTITIES"}
            </button>
            {/* Mobile drawer */}
            {mobileEntityOpen && (
              <div className="md:hidden fixed inset-0 z-40 flex justify-end">
                <div className="absolute inset-0 bg-black/60" onClick={() => setMobileEntityOpen(false)} />
                <div className="relative z-50 w-[85vw] max-w-[300px] h-full">
                  <EntityPanel
                    graph={graph}
                    selected={selectedEntity}
                    articles={articles}
                    onArticleClick={(art) => { handleArticleClick(art); setMobileEntityOpen(false); }}
                    onEntityClick={handleEntitySel}
                  />
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Bottom bar */}
      <footer className="flex items-center justify-between px-2 sm:px-4 h-6 sm:h-7 bg-[rgba(1,8,16,0.98)] border-t border-cyan-500/15 flex-shrink-0">
        <span className="text-[0.38rem] sm:text-[0.46rem] text-white/12 tracking-wider truncate">
          SENTINEL v3.4 // PHASE-4
        </span>
        <div className="hidden sm:flex gap-4 text-[0.46rem] text-white/12">
          <span>NODES: {graph.nodes.length}</span>
          <span>EDGES: {graph.links.length}</span>
          <span>ALERTS: {pipeline.alerts.length}</span>
          <span>ANALYSTS: {analysts.length + 1}</span>
          <span>PINS: {warPins.length}</span>
          <span style={{ color: pipeline.riskScore.overall >= 70 ? "#FF3344" : pipeline.riskScore.overall >= 45 ? "#FFB300" : "#00FFB2" }}>
            RISK: {pipeline.riskScore.overall}
          </span>
        </div>
        <span className="flex items-center gap-1 sm:gap-1.5 text-[0.38rem] sm:text-[0.46rem] text-white/12">
          <span className="w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full bg-emerald-400 inline-block"/>
          <span className="hidden sm:inline">ALL SYSTEMS NOMINAL</span>
          <span className="sm:hidden">ONLINE</span>
        </span>
      </footer>

      {/* Report modal */}
      {showReport && (
        <ReportModal onGenerate={handleGenerateReport} onClose={() => setShowReport(false)} />
      )}

      {/* Toast alerts */}
      <AlertToast alerts={pipeline.alerts} />
    </div>
  );
}
