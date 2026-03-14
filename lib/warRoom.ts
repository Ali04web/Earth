// War Room — BroadcastChannel sync (zero-cost, works across tabs/windows)
// For cross-machine: swap BroadcastChannel for Supabase Realtime (free tier)

export type AnalystStatus = "active" | "idle" | "away";
export type PinType = "threat" | "intel" | "watch" | "clear";
export type MsgType = "chat" | "alert" | "system" | "action";

export interface Analyst {
  id: string;
  name: string;
  color: string;
  status: AnalystStatus;
  view: string;
  lastSeen: number;
  initials: string;
}

export interface WarRoomPin {
  id: string;
  lat: number;
  lon: number;
  type: PinType;
  label: string;
  note: string;
  analystId: string;
  analystName: string;
  color: string;
  createdAt: number;
}

export interface WarRoomMessage {
  id: string;
  type: MsgType;
  analystId: string;
  analystName: string;
  color: string;
  text: string;
  ts: number;
  ref?: string; // article/entity id
}

export interface WarRoomState {
  analysts: Analyst[];
  pins: WarRoomPin[];
  messages: WarRoomMessage[];
}

export type WarRoomEvent =
  | { kind: "analyst_join";   payload: Analyst }
  | { kind: "analyst_update"; payload: Partial<Analyst> & { id: string } }
  | { kind: "analyst_leave";  payload: { id: string } }
  | { kind: "pin_add";        payload: WarRoomPin }
  | { kind: "pin_remove";     payload: { id: string } }
  | { kind: "message";        payload: WarRoomMessage }
  | { kind: "ping";           payload: { id: string; ts: number } };

const ANALYST_NAMES  = ["ALPHA","BRAVO","CHARLIE","DELTA","ECHO","FOXTROT","GOLF","HOTEL"];
const ANALYST_COLORS = ["#00D2FF","#00FFB2","#FFB300","#CC44FF","#FF8C00","#FF6677","#4488FF","#FF44CC"];

let _channel: BroadcastChannel | null = null;
let _self: Analyst | null = null;
let _listeners: ((e: WarRoomEvent) => void)[] = [];

export function getSelf(): Analyst {
  if (_self) return _self;
  // Persist identity in sessionStorage so refreshes keep same analyst
  const stored = typeof sessionStorage !== "undefined" ? sessionStorage.getItem("sentinel_analyst") : null;
  if (stored) { _self = JSON.parse(stored); return _self!; }
  const idx   = Math.floor(Math.random() * ANALYST_NAMES.length);
  _self = {
    id:       "analyst_" + Math.random().toString(36).slice(2),
    name:     ANALYST_NAMES[idx],
    initials: ANALYST_NAMES[idx].slice(0,2),
    color:    ANALYST_COLORS[idx],
    status:   "active",
    view:     "globe",
    lastSeen: Date.now(),
  };
  if (typeof sessionStorage !== "undefined") sessionStorage.setItem("sentinel_analyst", JSON.stringify(_self));
  return _self!;
}

export function initWarRoom(onEvent: (e: WarRoomEvent) => void) {
  if (typeof window === "undefined") return () => {};
  _listeners.push(onEvent);

  if (!_channel) {
    _channel = new BroadcastChannel("sentinel_war_room");
    _channel.onmessage = (e: MessageEvent<WarRoomEvent>) => {
      _listeners.forEach(l => l(e.data));
    };
  }

  // Announce join
  const me = getSelf();
  broadcast({ kind: "analyst_join", payload: me });

  // Heartbeat every 8s
  const heartbeat = setInterval(() => {
    broadcast({ kind: "ping", payload: { id: me.id, ts: Date.now() } });
  }, 8000);

  // System message
  broadcast({
    kind: "message",
    payload: {
      id: Math.random().toString(36).slice(2),
      type: "system",
      analystId: me.id,
      analystName: me.name,
      color: me.color,
      text: `ANALYST ${me.name} joined the war room`,
      ts: Date.now(),
    },
  });

  return () => {
    clearInterval(heartbeat);
    broadcast({ kind: "analyst_leave", payload: { id: me.id } });
    _listeners = _listeners.filter(l => l !== onEvent);
  };
}

export function broadcast(event: WarRoomEvent) {
  if (_channel) _channel.postMessage(event);
}

export function sendMessage(text: string, type: MsgType = "chat", ref?: string) {
  const me = getSelf();
  const msg: WarRoomMessage = {
    id: Math.random().toString(36).slice(2),
    type, analystId: me.id, analystName: me.name, color: me.color,
    text, ts: Date.now(), ref,
  };
  broadcast({ kind: "message", payload: msg });
  return msg; // also return for local echo
}

export function addPin(lat: number, lon: number, type: PinType, label: string, note: string): WarRoomPin {
  const me = getSelf();
  const pin: WarRoomPin = {
    id: "pin_" + Math.random().toString(36).slice(2),
    lat, lon, type, label, note,
    analystId: me.id, analystName: me.name, color: me.color,
    createdAt: Date.now(),
  };
  broadcast({ kind: "pin_add", payload: pin });
  return pin;
}

export function removePin(id: string) {
  broadcast({ kind: "pin_remove", payload: { id } });
}

export function updateStatus(status: AnalystStatus, view?: string) {
  const me = getSelf();
  if (me.status === status && (!view || me.view === view)) return;
  me.status = status;
  if (view) me.view = view;
  _self = me;
  broadcast({ kind: "analyst_update", payload: { id: me.id, status, view: me.view } });
}
