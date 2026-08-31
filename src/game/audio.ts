/* Tiny chiptune + SFX mixer. Unlock on first gesture. */

type Bus = { master: GainNode; music: GainNode; sfx: GainNode };

let ctx: AudioContext | null = null;
let bus: Bus | null = null;
let musicTimer: number | null = null;
let musicOn = false;
let unlocked = false;

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
  unlocked = true;
}

export function setMute(m: boolean) {
  if (!bus || !ctx) return;
  bus.master.gain.setTargetAtTime(m ? 0 : 0.9, ctx.currentTime, 0.02);
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
  },
  yell() {
    if (!bus) return;
    beep(320, "sawtooth", 0.35, bus.sfx, 180);
    noise(0.3, bus.sfx, 300);
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
    [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => bus && beep(f, "square", 0.12, bus.sfx), i * 90));
  },
  lose() {
    if (!bus) return;
    beep(196, "square", 0.3, bus.sfx, 80);
  },
};

const TUNE: Array<[number, number]> = [
  [0, 196],
  [0.25, 233],
  [0.5, 262],
  [0.75, 311],
  [1.0, 262],
  [1.25, 233],
  [1.5, 196],
  [1.75, 175],
  [2.0, 196],
  [2.25, 262],
  [2.5, 311],
  [2.75, 349],
  [3.0, 311],
  [3.25, 262],
  [3.5, 233],
  [3.75, 196],
  [4.0, 155],
  [4.5, 175],
  [5.0, 196],
  [5.5, 233],
  [6.0, 196],
  [6.5, 175],
  [7.0, 155],
  [7.5, 131],
];

export function startMusic() {
  const c = ensure();
  if (c.state === "suspended") void c.resume();
  musicOn = true;
  if (musicTimer != null) return;
  const loop = () => {
    if (!musicOn || !bus) return;
    const t0 = c.currentTime;
    for (const [when, freq] of TUNE) {
      const o = c.createOscillator();
      o.type = "square";
      o.frequency.value = freq;
      const g = c.createGain();
      g.gain.value = 0;
      o.connect(g);
      g.connect(bus.music);
      const t = t0 + when;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.18, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
      o.start(t);
      o.stop(t + 0.24);
    }
    // bass
    for (let i = 0; i < 8; i++) {
      const o = c.createOscillator();
      o.type = "triangle";
      o.frequency.value = i % 2 === 0 ? 98 : 87;
      const g = c.createGain();
      g.gain.value = 0.12;
      o.connect(g);
      g.connect(bus.music);
      const t = t0 + i;
      o.start(t);
      o.stop(t + 0.4);
    }
    musicTimer = window.setTimeout(loop, 8000);
  };
  loop();
}

export function stopMusic() {
  musicOn = false;
  if (musicTimer != null) {
    clearTimeout(musicTimer);
    musicTimer = null;
  }
}

export function isUnlocked() {
  return unlocked;
}
