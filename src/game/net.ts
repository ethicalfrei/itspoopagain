import { P2PRoom, type PeerInfo } from "@/lib/multiplayer";
import type { CharId, RosterSlot } from "./config";

export type NetRole = "offline" | "host" | "client";
export type NetPhase = "menu" | "lobby" | "play";

export type NetInput = {
  mx: number;
  my: number;
  punch: boolean;
  special: boolean;
  action: boolean;
  punchP: boolean;
  specialP: boolean;
  actionP: boolean;
};

export type FighterSnap = {
  slot: number;
  x: number;
  y: number;
  facing: 1 | -1;
  state: string;
  hp: number;
  lives: number;
  holding: boolean;
  fillT: number;
};

export type HouseSnap = { i: number; state: string };
export type FoeSnap = {
  kind: string;
  x: number;
  y: number;
  facing: 1 | -1;
  state: string;
  hp: number;
};

export type SnapMsg = {
  t: "snap";
  score: number;
  combo: number;
  fighters: FighterSnap[];
  houses: HouseSnap[];
  foes: FoeSnap[];
};

export type NetMsg =
  | { t: "hello"; name: string }
  | { t: "claim"; char: CharId }
  | { t: "roster"; slots: RosterSlot[] }
  | { t: "start"; roster: RosterSlot[]; stage?: number; score?: number }
  | { t: "dropin"; slot: number; char: CharId; roster: RosterSlot[]; stage?: number; score?: number }
  | { t: "stage"; stage: number; score: number; roster: RosterSlot[] }
  | { t: "full" }
  | { t: "input"; inp: NetInput }
  | SnapMsg
  | { t: "left"; peer: string };

type Listener = () => void;

const ALPHA = "ABCDEFGHJKLMNPQRSTUVWXYZ";

function code4() {
  let s = "";
  for (let i = 0; i < 4; i++) s += ALPHA[Math.floor(Math.random() * ALPHA.length)];
  return s;
}

function pid() {
  return `p${Math.random().toString(36).slice(2, 10)}`;
}

export const net = {
  role: "offline" as NetRole,
  phase: "menu" as NetPhase,
  code: "",
  room: "",
  selfId: "",
  mySlot: 0,
  myChar: "billy" as CharId,
  roster: [
    { id: "billy" as CharId, human: true, peerId: null as string | null },
    { id: "frank" as CharId, human: false, peerId: null as string | null },
    { id: "jack" as CharId, human: false, peerId: null as string | null },
  ] as RosterSlot[],
  peers: [] as PeerInfo[],
  status: "",
  error: "",
  lastSnap: null as SnapMsg | null,
  remoteInputs: new Map<string, NetInput>(),
  stage: 0,
  scoreCarry: 0,
  p2p: null as P2PRoom | null,
  welcomed: new Set<string>(),
  listeners: new Set<Listener>(),
  hooks: {
    onDropin: null as null | ((peerId: string) => void),
    onPeerLeft: null as null | ((peerId: string) => void),
  },

  subscribe(fn: Listener) {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  },
  emit() {
    for (const fn of this.listeners) fn();
  },

  linked() {
    return this.peers.filter((p) => p.connectionState === "connected").length;
  },

  setGameHooks(h: { onDropin: (id: string) => void; onPeerLeft: (id: string) => void } | null) {
    this.hooks.onDropin = h?.onDropin ?? null;
    this.hooks.onPeerLeft = h?.onPeerLeft ?? null;
  },

  async host() {
    this.leave();
    this.role = "host";
    this.phase = "lobby";
    this.code = code4();
    this.room = `crew-${this.code}`;
    this.selfId = pid();
    this.mySlot = 0;
    this.myChar = "billy";
    this.roster = [
      { id: "billy", human: true, peerId: this.selfId },
      { id: "frank", human: false, peerId: null },
      { id: "jack", human: false, peerId: null },
    ];
    this.status = "WAITING FOR FRIENDS";
    this.error = "";
    this.openRoom("HOST");
    this.pushUrl();
    this.emit();
    return this.code;
  },

  async join(raw: string) {
    const code = raw.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 4);
    if (code.length !== 4) {
      this.error = "NEED A 4-LETTER CODE";
      this.emit();
      throw new Error(this.error);
    }
    this.leave();
    this.role = "client";
    this.phase = "menu";
    this.code = code;
    this.room = `crew-${code}`;
    this.selfId = pid();
    this.status = "LINKING TO CREW…";
    this.error = "";
    this.openRoom("P2");
    this.pushUrl();
    this.emit();
  },

  openRoom(name: string) {
    const p2p = new P2PRoom({
      room: this.room,
      selfId: this.selfId,
      name,
      onPeersChanged: (peers) => this.onPeers(peers),
      onMessage: (from, data, channel) => this.onMsg(from, data, channel),
      onConnected: () => {
        if (this.role === "client" && !this.status.startsWith("LINKED")) {
          this.status = "WAITING FOR HOST…";
          this.emit();
        }
      },
    });
    this.p2p = p2p;
    void p2p.join();
  },

  onPeers(peers: PeerInfo[]) {
    this.peers = peers;
    if (this.role === "host") {
      for (const p of peers) {
        if (p.connectionState === "connected" && !this.welcomed.has(p.id)) {
          this.welcomed.add(p.id);
          this.welcome(p.id);
        }
      }
      for (const id of [...this.welcomed]) {
        const still = peers.find((p) => p.id === id && p.connectionState === "connected");
        if (!still) {
          this.welcomed.delete(id);
          this.onLeft(id);
        }
      }
      const n = this.linked();
      this.status = n === 0 ? "WAITING FOR FRIENDS" : `${n} FRIEND${n === 1 ? "" : "S"} LINKED`;
    } else if (this.role === "client") {
      const n = this.linked();
      if (n > 0 && this.phase === "menu") this.status = "LINKED · WAITING FOR HOST";
      const failed = peers.some((p) => p.connectionState === "failed");
      if (failed && n === 0) this.error = "COULDN'T REACH HOST — TRY SAME WIFI";
    }
    this.emit();
  },

  welcome(peerId: string) {
    if (this.phase === "play") {
      this.hooks.onDropin?.(peerId);
      if (!this.hooks.onDropin) this.send({ t: "roster", slots: this.roster }, peerId);
    } else {
      this.send({ t: "roster", slots: this.roster }, peerId);
    }
  },

  onLeft(peerId: string) {
    for (const slot of this.roster) {
      if (slot.peerId === peerId) {
        slot.human = this.phase === "lobby" ? false : slot.human;
        slot.peerId = null;
        if (this.phase === "lobby") slot.human = false;
      }
    }
    this.remoteInputs.delete(peerId);
    this.hooks.onPeerLeft?.(peerId);
    this.broadcastRoster();
    this.emit();
  },

  onMsg(from: string, data: unknown, channel: "state" | "reliable") {
    if (!data || typeof data !== "object") return;
    const msg = data as NetMsg;
    if (msg.t === "input") {
      this.remoteInputs.set(from, msg.inp);
      return;
    }
    if (msg.t === "snap" && this.role === "client") {
      this.lastSnap = msg;
      return;
    }
    if (msg.t === "claim" && this.role === "host") {
      this.hostClaim(from, msg.char);
      return;
    }
    if (msg.t === "hello" && this.role === "host") {
      this.welcome(from);
      return;
    }
    if (msg.t === "roster" && this.role === "client") {
      this.roster = msg.slots;
      this.syncMine();
      if (!this.roster.some((s) => s.peerId === this.selfId)) {
        const free = this.roster.find((s) => !s.peerId);
        if (free) this.pickLocal(free.id);
      }
      if (this.phase === "menu") this.phase = "lobby";
      this.status = "PICK YOUR FACE";
      this.emit();
      return;
    }
    if (msg.t === "start" && this.role === "client") {
      this.roster = msg.roster;
      this.stage = msg.stage ?? 0;
      this.scoreCarry = msg.score ?? 0;
      this.syncMine();
      this.phase = "play";
      this.status = "LET'S POOP";
      this.emit();
      return;
    }
    if (msg.t === "dropin" && this.role === "client") {
      this.roster = msg.roster;
      this.mySlot = msg.slot;
      this.myChar = msg.char;
      this.stage = msg.stage ?? this.stage;
      this.scoreCarry = msg.score ?? this.scoreCarry;
      this.phase = "play";
      this.status = "DROPPED IN";
      this.emit();
      return;
    }
    if (msg.t === "stage" && this.role === "client") {
      this.roster = msg.roster;
      this.stage = msg.stage;
      this.scoreCarry = msg.score;
      this.phase = "play";
      this.emit();
      return;
    }
    if (msg.t === "full" && this.role === "client") {
      this.error = "CREW IS FULL (3)";
      this.status = "FULL";
      this.emit();
    }
    void channel;
  },

  hostClaim(peerId: string, char: CharId) {
    const taken = this.roster.find((s) => s.id === char);
    if (!taken) return;
    if (taken.peerId && taken.peerId !== peerId) return;
    for (const s of this.roster) {
      if (s.peerId === peerId) {
        s.peerId = null;
        s.human = false;
      }
    }
    taken.peerId = peerId;
    taken.human = true;
    this.broadcastRoster();
    this.emit();
  },

  pickLocal(char: CharId) {
    if (this.role === "offline") return;
    if (this.role === "client") {
      this.send({ t: "claim", char });
      return;
    }
    const taken = this.roster.find((s) => s.id === char);
    if (!taken) return;
    if (taken.peerId && taken.peerId !== this.selfId) return;
    for (const s of this.roster) {
      if (s.peerId === this.selfId) {
        s.peerId = null;
        s.human = false;
      }
    }
    taken.peerId = this.selfId;
    taken.human = true;
    this.myChar = char;
    this.mySlot = this.roster.findIndex((s) => s.id === char);
    this.broadcastRoster();
    this.emit();
  },

  startMatch(roster: RosterSlot[]) {
    this.roster = roster;
    this.phase = "play";
    this.stage = 0;
    this.scoreCarry = 0;
    this.syncMine();
    this.send({ t: "start", roster, stage: 0, score: 0 });
    this.emit();
  },

  sendDropin(peerId: string, slot: number, char: CharId, roster: RosterSlot[], stage = 0, score = 0) {
    this.roster = roster;
    this.send({ t: "dropin", slot, char, roster, stage, score }, peerId);
    this.emit();
  },

  sendFull(peerId: string) {
    this.send({ t: "full" }, peerId);
  },

  broadcastRoster() {
    this.send({ t: "roster", slots: this.roster });
  },

  sendInput(inp: NetInput) {
    this.p2p?.broadcast({ t: "input", inp });
  },

  sendSnap(snap: SnapMsg) {
    this.p2p?.broadcast(snap);
  },

  send(msg: NetMsg, to?: string) {
    this.p2p?.send(msg, to);
  },

  syncMine() {
    const mine = this.roster.find((s) => s.peerId === this.selfId);
    if (mine) {
      this.myChar = mine.id;
      this.mySlot = this.roster.findIndex((s) => s.id === mine.id);
    }
  },

  pushUrl() {
    if (typeof window === "undefined" || !this.code) return;
    const url = new URL(window.location.href);
    url.searchParams.set("crew", this.code);
    window.history.replaceState({}, "", url);
  },

  shareUrl() {
    if (typeof window === "undefined") return this.code;
    const url = new URL(window.location.href);
    url.searchParams.set("crew", this.code);
    return url.toString();
  },

  leave() {
    this.p2p?.close();
    this.p2p = null;
    this.role = "offline";
    this.phase = "menu";
    this.peers = [];
    this.welcomed.clear();
    this.remoteInputs.clear();
    this.lastSnap = null;
    this.stage = 0;
    this.scoreCarry = 0;
    this.status = "";
    this.error = "";
    this.emit();
  },
};
