/* Music bed + porch lines. Beep SFX stay for hits; voice lines always play to the end. */

import { Howl, Howler } from "howler";

type Bus = { master: GainNode; music: GainNode; sfx: GainNode };

let ctx: AudioContext | null = null;
let bus: Bus | null = null;
let unlocked = false;
let musicHowl: Howl | null = null;
let musicOn = false;
let activeLine: Howl | null = null;
let activeSrc: string | null = null;
let bossOn = false;
let bossTimer: ReturnType<typeof setInterval> | null = null;
let bossGain: GainNode | null = null;

export const LINES = {
  poop: "/audio/clips/11-its-poop-again.mp3?v=clean1",
  called: "/audio/clips/12-he-called-the-shit-poop.mp3?v=clean1",
  best: "/audio/clips/13-this-is-the-best-night-of-my-life.mp3?v=clean1",
  kids: "/audio/clips/16-ill-get-you-damn-kids-youre-all-gonna-die.mp3?v=clean1",
  die: "/audio/clips/15-youre-all-gonna-die.mp3?v=clean1",
  hell: "/audio/clips/06-who-the-hell-is-it-what-do-you-want.mp3?v=clean1",
  stomp: "/audio/clips/10-call-the-fire-department-outta-control.mp3?v=clean1",
} as const;

function ensure() {
  if (ctx) return ctx;
  const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  ctx = new AC({ latencyHint: "interactive" });
  const master = ctx.createGain();
  const music = ctx.createGain();
  const sfx = ctx.createGain();
  music.gain.value = 0.22;
  sfx.gain.value = 0.55;
  master.gain.value = 0.9;
  music.connect(master);
  sfx.connect(master);
  master.connect(ctx.destination);
  bus = { master, music, sfx };
  return ctx;
}

export function unlockAudio() {
  const c = ensure();
  if (c.state === "suspended") void c.resume();
  if (Howler.ctx && Howler.ctx.state === "suspended") void Howler.ctx.resume();
  unlocked = true;
}

export function setMute(m: boolean) {
  if (!bus || !ctx) return;
  bus.master.gain.setTargetAtTime(m ? 0 : 0.9, ctx.currentTime, 0.02);
  Howler.volume(m ? 0 : 1);
}

function envGain(dest: AudioNode, attack = 0.005, hold = 0.05, release = 0.08) {
  const c = ensure();
  const g = c.createGain();
  g.gain.value = 0;
  g.connect(dest);
  const t = c.currentTime;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(1, t + attack);
  g.gain.setValueAtTime(1, t + attack + hold);
  g.gain.exponentialRampToValueAtTime(0.001, t + attack + hold + release);
  return { g, stopAt: t + attack + hold + release + 0.02 };
}

function beep(freq: number, type: OscillatorType, dur: number, dest: AudioNode, slide?: number) {
  const c = ensure();
  const o = c.createOscillator();
  o.type = type;
  o.frequency.value = freq;
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, slide), c.currentTime + dur);
  const { g, stopAt } = envGain(dest, 0.004, dur * 0.4, dur * 0.55);
  o.connect(g);
  o.start();
  o.stop(stopAt);
}

function noise(dur: number, dest: AudioNode, hp = 400) {
  const c = ensure();
  const n = c.createBufferSource();
  const buf = c.createBuffer(1, Math.max(1, Math.floor(c.sampleRate * dur)), c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  n.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = "highpass";
  f.frequency.value = hp;
  const { g, stopAt } = envGain(dest, 0.001, dur * 0.2, dur * 0.7);
  n.connect(f);
  f.connect(g);
  n.start();
  n.stop(stopAt);
}

function duckMusic(on: boolean) {
  if (!musicHowl) return;
  const rest = bossOn ? 0.1 : 0.55;
  musicHowl.fade(musicHowl.volume(), on ? Math.min(0.08, rest) : rest, on ? 80 : 400);
}

/** Play a porch line all the way through. Pass interrupt to cut a lesser line. Same clip won't restart. */
export function playLine(src: string, interrupt = false) {
  unlockAudio();
  if (activeLine?.playing()) {
    if (activeSrc === src) return;
    if (!interrupt) return;
    activeLine.stop();
    activeLine.unload();
    activeLine = null;
    activeSrc = null;
  }
  const howl = new Howl({
    src: [src],
    html5: true,
    volume: 0.95,
    preload: true,
  });
  activeLine = howl;
  activeSrc = src;
  duckMusic(true);
  howl.once("end", () => {
    if (activeLine === howl) {
      activeLine = null;
      activeSrc = null;
      duckMusic(false);
    }
    howl.unload();
  });
  howl.play();
}

export const sfx = {
  coin() {
    if (!bus) return;
    beep(880, "square", 0.08, bus.sfx);
    setTimeout(() => bus && beep(1320, "square", 0.1, bus.sfx), 70);
  },
  punch() {
    if (!bus) return;
    noise(0.08, bus.sfx, 200);
    beep(180, "square", 0.06, bus.sfx, 80);
  },
  hit() {
    if (!bus) return;
    noise(0.12, bus.sfx, 120);
    beep(140, "sawtooth", 0.09, bus.sfx, 60);
  },
  ding() {
    if (!bus) return;
    beep(1244, "sine", 0.18, bus.sfx);
    beep(1661, "sine", 0.22, bus.sfx);
    playLine(LINES.hell);
  },
  fire() {
    if (!bus) return;
    noise(0.28, bus.sfx, 600);
    beep(240, "sawtooth", 0.2, bus.sfx, 90);
  },
  stomp() {
    if (!bus) return;
    beep(70, "square", 0.16, bus.sfx, 40);
    noise(0.18, bus.sfx, 80);
    playLine(LINES.stomp);
  },
  yell() {
    if (!bus) return;
    beep(320, "sawtooth", 0.18, bus.sfx, 180);
  },
  clemensDie() {
    if (bus) {
      beep(320, "sawtooth", 0.18, bus.sfx, 180);
      noise(0.2, bus.sfx, 220);
    }
    playLine(LINES.die, true);
  },
  clemensSpawn() {
    if (bus) beep(90, "sawtooth", 0.22, bus.sfx, 50);
    playLine(LINES.kids, true);
  },
  bag() {
    if (!bus) return;
    beep(220, "triangle", 0.1, bus.sfx, 140);
  },
  strain() {
    if (!bus) return;
    beep(92, "square", 0.16, bus.sfx, 48);
    beep(64, "triangle", 0.2, bus.sfx, 36);
    noise(0.1, bus.sfx, 90);
  },
  hurt() {
    if (!bus) return;
    beep(400, "square", 0.12, bus.sfx, 120);
  },
  special() {
    if (!bus) return;
    beep(523, "square", 0.08, bus.sfx);
    beep(784, "square", 0.1, bus.sfx);
  },
  win() {
    if (!bus) return;
    [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => bus && beep(f, "square", 0.1, bus.sfx), i * 80));
  },
  victory() {
    playLine(LINES.poop, true);
  },
  lose() {
    playLine(LINES.kids);
  },
};

export function startBossMusic() {
  unlockAudio();
  if (bossOn) return;
  bossOn = true;
  if (musicHowl) {
    musicHowl.rate(1.18);
    musicHowl.fade(musicHowl.volume(), 0.1, 350);
  }
  const c = ensure();
  if (!bus) return;
  bossGain = c.createGain();
  bossGain.gain.value = 0.32;
  bossGain.connect(bus.music);
  const dest = bossGain;
  const pulse = () => {
    if (!bossOn || !dest) return;
    beep(52, "square", 0.14, dest, 30);
    beep(78, "sawtooth", 0.2, dest, 40);
    window.setTimeout(() => {
      if (!bossOn || !dest) return;
      beep(311, "square", 0.07, dest);
    }, 140);
    window.setTimeout(() => {
      if (!bossOn || !dest) return;
      beep(207, "square", 0.08, dest, 160);
    }, 280);
  };
  pulse();
  bossTimer = setInterval(pulse, 460);
}

export function stopBossMusic() {
  bossOn = false;
  if (bossTimer) {
    clearInterval(bossTimer);
    bossTimer = null;
  }
  if (bossGain && ctx) {
    bossGain.gain.setTargetAtTime(0, ctx.currentTime, 0.04);
  }
  bossGain = null;
  if (musicHowl && musicOn) {
    musicHowl.rate(1);
    musicHowl.fade(musicHowl.volume(), 0.55, 500);
  }
}

export function startMusic() {
  unlockAudio();
  musicOn = true;
  if (!musicHowl) {
    musicHowl = new Howl({
      src: ["/audio/music/its-poop-again.mp3?v=clean1"],
      loop: true,
      volume: 0.55,
      html5: true,
      preload: true,
    });
  }
  if (!musicHowl.playing()) musicHowl.play();
}

export function stopMusic() {
  musicOn = false;
  stopBossMusic();
  musicHowl?.fade(musicHowl.volume(), 0, 300);
  setTimeout(() => {
    if (!musicOn) musicHowl?.pause();
  }, 320);
}

export function isUnlocked() {
  return unlocked;
}
