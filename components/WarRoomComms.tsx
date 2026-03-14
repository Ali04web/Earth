"use client";
import { useState, useRef, useEffect } from "react";
import type { WarRoomMessage, WarRoomPin, Analyst } from "@/lib/warRoom";
import { sendMessage, addPin, removePin, getSelf } from "@/lib/warRoom";

interface Props {
  analysts: Analyst[];
  messages: WarRoomMessage[];
  pins: WarRoomPin[];
  onLocalMessage: (m: WarRoomMessage) => void;
  onLocalPin: (p: WarRoomPin) => void;
  onLocalRemovePin: (id: string) => void;
  onPinClick: (lat: number, lon: number) => void;
}

const STATUS_COLORS: Record<string, string> = {
  active: "#00FFB2", idle: "#FFB300", away: "#FF6677",
};
const PIN_COLORS: Record<string, string> = {
  threat: "#FF3344", intel: "#00D2FF", watch: "#FFB300", clear: "#00FFB2",
};

export default function WarRoomComms({ analysts, messages, pins, onLocalMessage, onLocalPin, onLocalRemovePin, onPinClick }: Props) {
  const [tab, setTab]       = useState<"comms" | "pins">("comms");
  const [input, setInput]   = useState("");
  const [pinForm, setPinForm] = useState<{ lat:string; lon:string; type:string; label:string; note:string }>({
    lat:"", lon:"", type:"threat", label:"", note:"",
  });
  const [showPinForm, setShowPinForm] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const me = getSelf();

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function handleSend() {
    if (!input.trim()) return;
    const msg = sendMessage(input.trim());
    onLocalMessage(msg);
    setInput("");
  }

  function handleAddPin() {
    const lat = parseFloat(pinForm.lat), lon = parseFloat(pinForm.lon);
    if (isNaN(lat) || isNaN(lon) || !pinForm.label) return;
    const pin = addPin(lat, lon, pinForm.type as any, pinForm.label, pinForm.note);
    onLocalPin(pin);
    setPinForm({ lat:"", lon:"", type:"threat", label:"", note:"" });
    setShowPinForm(false);
  }

  const MSG_TYPE_STYLES: Record<string, string> = {
    chat:   "",
    alert:  "bg-red-500/10 border-l-2 border-red-500/50",
    system: "opacity-40 italic",
    action: "bg-cyan-500/5 border-l-2 border-cyan-500/30",
  };

  return (
    <div className="flex flex-col h-full">
      {/* Analyst presence */}
      <div className="px-3 py-2 border-b border-cyan-500/10 flex-shrink-0">
        <div className="flex items-center justify-between mb-1.5">
          <span className="font-display text-[0.52rem] tracking-[0.18em] text-cyan-400/50 uppercase">
            ◉ Analysts Online
          </span>
          <span className="text-[0.48rem] text-white/20">{analysts.length + 1} active</span>
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {/* Self */}
          <div className="flex items-center gap-1 px-2 py-0.5 rounded-sm border border-cyan-500/30 bg-cyan-500/[0.08]">
            <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: me.color }} />
            <span className="text-[0.52rem]" style={{ color: me.color }}>{me.name} (YOU)</span>
          </div>
          {analysts.map(a => (
            <div key={a.id} className="flex items-center gap-1 px-2 py-0.5 rounded-sm border border-white/10">
              <div className="w-1.5 h-1.5 rounded-full flex-shrink-0 animate-pulse"
                style={{ background: STATUS_COLORS[a.status] || "#00FFB2" }} />
              <span className="text-[0.52rem] text-white/50">{a.name}</span>
              <span className="text-[0.44rem] text-white/20 uppercase">{a.view}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-cyan-500/10 flex-shrink-0">
        {([["comms", "◎ COMMS"], ["pins", `◈ PINS (${pins.length})`]] as const).map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
            className={`flex-1 py-2 text-[0.52rem] font-display tracking-widest uppercase transition-all ${
              tab === key ? "text-cyan-400 border-b-2 border-cyan-400 bg-cyan-500/[0.06]" : "text-white/25 hover:text-white/50"
            }`}>
            {label}
          </button>
        ))}
      </div>

      {/* COMMS tab */}
      {tab === "comms" && (
        <>
          <div className="flex-1 overflow-y-auto custom-scroll px-2 py-2 flex flex-col gap-0.5">
            {messages.length === 0 && (
              <div className="text-center text-[0.55rem] text-white/15 mt-8">
                War room comms channel active.<br/>Messages sync across all open tabs.
              </div>
            )}
            {messages.map(msg => (
              <div key={msg.id}
                className={`px-2 py-1.5 rounded-sm ${MSG_TYPE_STYLES[msg.type] || ""} animate-slide-in`}>
                {msg.type !== "system" ? (
                  <>
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="text-[0.52rem] font-bold" style={{ color: msg.color }}>
                        {msg.analystName === me.name ? "YOU" : msg.analystName}
                      </span>
                      <span className="text-[0.44rem] text-white/20">
                        {new Date(msg.ts).toUTCString().slice(17,22)} UTC
                      </span>
                    </div>
                    <div className="text-[0.62rem] text-slate-200 leading-snug">{msg.text}</div>
                  </>
                ) : (
                  <div className="text-[0.55rem] text-white/25 text-center">{msg.text}</div>
                )}
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="px-2 py-2 border-t border-cyan-500/10 flex-shrink-0">
            <div className="flex gap-1.5">
              <div className="flex-1 relative">
                <input
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleSend()}
                  placeholder="Send intel to war room..."
                  className="w-full bg-white/[0.03] border border-cyan-500/20 text-[0.62rem] text-slate-200 px-2 py-1.5 rounded-sm outline-none focus:border-cyan-500/50 placeholder:text-white/15 font-mono"
                />
              </div>
              <button onClick={handleSend}
                className="px-3 py-1.5 bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-[0.56rem] rounded-sm hover:bg-cyan-500/20 transition-all font-display tracking-wider">
                SEND
              </button>
            </div>
          </div>
        </>
      )}

      {/* PINS tab */}
      {tab === "pins" && (
        <>
          <div className="flex-1 overflow-y-auto custom-scroll">
            {pins.length === 0 && !showPinForm && (
              <div className="text-center text-[0.55rem] text-white/15 mt-8 px-4">
                No pins placed yet.<br/>Add analyst pins to mark locations.
              </div>
            )}
            {pins.map(pin => (
              <div key={pin.id}
                className="flex items-start gap-2 px-3 py-2 border-b border-white/[0.03] hover:bg-white/[0.02] group">
                <div className="w-3 h-3 rounded-sm mt-0.5 flex-shrink-0"
                  style={{ background: PIN_COLORS[pin.type] + "44", border: `1px solid ${PIN_COLORS[pin.type]}88` }}>
                  <div className="w-full h-full rounded-sm" style={{ background: PIN_COLORS[pin.type] + "66" }} />
                </div>
                <div className="flex-1 min-w-0 cursor-pointer" onClick={() => onPinClick(pin.lat, pin.lon)}>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[0.62rem] text-slate-200 font-bold truncate">{pin.label}</span>
                    <span className="text-[0.48rem] uppercase tracking-wider flex-shrink-0"
                      style={{ color: PIN_COLORS[pin.type] }}>{pin.type}</span>
                  </div>
                  {pin.note && <div className="text-[0.56rem] text-white/40 mt-0.5 truncate">{pin.note}</div>}
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[0.48rem]" style={{ color: pin.color }}>{pin.analystName}</span>
                    <span className="text-[0.46rem] text-white/20">
                      {pin.lat.toFixed(1)}°, {pin.lon.toFixed(1)}°
                    </span>
                  </div>
                </div>
                <button onClick={() => onLocalRemovePin(pin.id)}
                  className="text-white/15 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 flex-shrink-0 text-xs mt-0.5">
                  ✕
                </button>
              </div>
            ))}

            {/* Pin form */}
            {showPinForm && (
              <div className="px-3 py-3 border-b border-cyan-500/15 bg-cyan-500/[0.04]">
                <div className="font-display text-[0.52rem] tracking-widest text-cyan-400/60 uppercase mb-2">
                  Add Analyst Pin
                </div>
                <div className="flex flex-col gap-1.5">
                  {[
                    { key:"label", ph:"Label (e.g. ZONE ALPHA)" },
                    { key:"lat",   ph:"Latitude (e.g. 33.5)" },
                    { key:"lon",   ph:"Longitude (e.g. 36.3)" },
                    { key:"note",  ph:"Note (optional)" },
                  ].map(({ key, ph }) => (
                    <input key={key}
                      value={(pinForm as any)[key]}
                      onChange={e => setPinForm(p => ({ ...p, [key]: e.target.value }))}
                      placeholder={ph}
                      className="bg-white/[0.03] border border-cyan-500/15 text-[0.6rem] text-slate-200 px-2 py-1 rounded-sm outline-none focus:border-cyan-500/40 placeholder:text-white/15 font-mono"
                    />
                  ))}
                  <div className="flex gap-1.5">
                    {(["threat","intel","watch","clear"] as const).map(t => (
                      <button key={t} onClick={() => setPinForm(p=>({...p,type:t}))}
                        className="flex-1 py-1 text-[0.5rem] rounded-sm border uppercase tracking-wider transition-all"
                        style={pinForm.type===t
                          ? { background: PIN_COLORS[t]+"22", borderColor: PIN_COLORS[t], color: PIN_COLORS[t] }
                          : { borderColor:"rgba(255,255,255,0.1)", color:"rgba(255,255,255,0.25)" }}>
                        {t}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-1.5">
                    <button onClick={handleAddPin}
                      className="flex-1 py-1.5 bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-[0.56rem] rounded-sm hover:bg-cyan-500/20 transition-all font-display tracking-wider">
                      PLACE PIN
                    </button>
                    <button onClick={() => setShowPinForm(false)}
                      className="px-3 py-1.5 border border-white/10 text-white/30 text-[0.56rem] rounded-sm hover:text-white/60 transition-all">
                      CANCEL
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {!showPinForm && (
            <div className="px-3 py-2 border-t border-cyan-500/10 flex-shrink-0">
              <button onClick={() => setShowPinForm(true)}
                className="w-full py-1.5 bg-cyan-500/[0.06] border border-cyan-500/20 text-cyan-400/70 text-[0.56rem] rounded-sm hover:bg-cyan-500/12 transition-all font-display tracking-widest uppercase">
                + Add Pin
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
