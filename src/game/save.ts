const KEY = "its-poop-again-v1";
const VERSION = 1;

export type SaveData = {
  version: number;
  highScore: number;
  initials: string;
  unlocked: string[];
  settings: { shake: boolean; mute: boolean; music: number; sfx: number };
};

const defaults: SaveData = {
  version: VERSION,
  highScore: 0,
  initials: "AAA",
  unlocked: ["billy", "frank", "jack"],
  settings: { shake: true, mute: false, music: 0.55, sfx: 0.85 },
};

function migrate(raw: SaveData): SaveData {
  const s = { ...defaults, ...raw, settings: { ...defaults.settings, ...raw.settings } };
  s.version = VERSION;
  return s;
}

export function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return structuredClone(defaults);
    return migrate(JSON.parse(raw) as SaveData);
  } catch {
    return structuredClone(defaults);
  }
}

export function writeSave(data: SaveData) {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    /* private mode */
  }
}

export function submitScore(score: number, initials: string) {
  const s = loadSave();
  if (score > s.highScore) {
    s.highScore = score;
    s.initials = initials.slice(0, 3).toUpperCase();
    writeSave(s);
  }
  return s;
}
