import { P1_KEYS, P2_KEYS, P3_KEYS } from "./config";

export type Actions = {
  moveX: number;
  moveY: number;
  punch: boolean;
  punchPressed: boolean;
  special: boolean;
  specialPressed: boolean;
  action: boolean;
  actionPressed: boolean;
  start: boolean;
  startPressed: boolean;
};

const empty = (): Actions => ({
  moveX: 0,
  moveY: 0,
  punch: false,
  punchPressed: false,
  special: false,
  specialPressed: false,
  action: false,
  actionPressed: false,
  start: false,
  startPressed: false,
});

const keys = new Set<string>();
let injected: string[] | null = null;

const prev = [empty(), empty(), empty()];
export const actions: Actions[] = [empty(), empty(), empty()];

export const touch = {
  moveX: 0,
  moveY: 0,
  punch: false,
  special: false,
  action: false,
  start: false,
};

const GAME_CODES = new Set([
  "KeyW",
  "KeyA",
  "KeyS",
  "KeyD",
  "KeyJ",
  "KeyK",
  "KeyL",
  "Space",
  "Enter",
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "ArrowDown",
  "KeyO",
  "KeyP",
  "KeyU",
  "ShiftRight",
  "KeyT",
  "KeyF",
  "KeyG",
  "KeyH",
  "KeyZ",
  "KeyX",
  "KeyC",
  "KeyV",
  "Escape",
  "KeyM",
]);

function down(e: KeyboardEvent) {
  const el = e.target as HTMLElement | null;
  if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA")) return;
  keys.add(e.code);
  if (GAME_CODES.has(e.code)) e.preventDefault();
}
function up(e: KeyboardEvent) {
  keys.delete(e.code);
}
function clear() {
  keys.clear();
}

let hooked = false;
export function hookInput() {
  if (hooked || typeof window === "undefined") return;
  hooked = true;
  window.addEventListener("keydown", down, { passive: false });
  window.addEventListener("keyup", up);
  window.addEventListener("blur", clear);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) clear();
  });
}

export function setInjectedKeys(codes: string[]) {
  injected = codes;
}

function held(code: string) {
  if (injected) return injected.includes(code);
  return keys.has(code);
}

function radial(x: number, y: number, dz = 0.18) {
  const m = Math.hypot(x, y);
  if (m < dz) return { x: 0, y: 0 };
  const scale = (m - dz) / (1 - dz) / m;
  return { x: x * scale, y: y * scale };
}

function fillFromKeys(
  map: { left: string; right: string; up: string; down: string; punch: string; special: string; action: string; action2?: string; start: string },
  a: Actions,
  extra?: { moveX?: number; moveY?: number; punch?: boolean; special?: boolean; action?: boolean; start?: boolean },
) {
  let mx = (held(map.right) ? 1 : 0) - (held(map.left) ? 1 : 0);
  let my = (held(map.down) ? 1 : 0) - (held(map.up) ? 1 : 0);
  if (extra?.moveX) mx += extra.moveX;
  if (extra?.moveY) my += extra.moveY;
  const cl = Math.max(1, Math.hypot(mx, my));
  a.moveX = mx / cl;
  a.moveY = my / cl;
  a.punch = held(map.punch) || !!extra?.punch;
  a.special = held(map.special) || !!extra?.special;
  a.action = held(map.action) || (map.action2 ? held(map.action2) : false) || !!extra?.action;
  a.start = held(map.start) || held("Enter") || !!extra?.start;
}

function pollPad(i: number, a: Actions) {
  const pads = navigator.getGamepads?.() ?? [];
  const p = pads[i];
  if (!p) return;
  const st = radial(p.axes[0] ?? 0, p.axes[1] ?? 0);
  if (Math.abs(st.x) > Math.abs(a.moveX)) a.moveX = st.x;
  if (Math.abs(st.y) > Math.abs(a.moveY)) a.moveY = st.y;
  if (p.buttons[14]?.pressed) a.moveX = -1;
  if (p.buttons[15]?.pressed) a.moveX = 1;
  if (p.buttons[12]?.pressed) a.moveY = -1;
  if (p.buttons[13]?.pressed) a.moveY = 1;
  if (p.buttons[0]?.pressed) a.punch = true;
  if (p.buttons[1]?.pressed || p.buttons[2]?.pressed) a.special = true;
  if (p.buttons[3]?.pressed || (p.buttons[5]?.pressed ?? false)) a.action = true;
  if (p.buttons[9]?.pressed) a.start = true;
}

export function updateInput() {
  for (let i = 0; i < 3; i++) {
    prev[i] = { ...actions[i]! };
    Object.assign(actions[i]!, empty());
  }
  fillFromKeys(P1_KEYS, actions[0]!, {
    moveX: touch.moveX,
    moveY: touch.moveY,
    punch: touch.punch,
    special: touch.special,
    action: touch.action,
    start: touch.start,
  });
  fillFromKeys(P2_KEYS, actions[1]!);
  fillFromKeys(P3_KEYS, actions[2]!);
  pollPad(0, actions[0]!);
  pollPad(1, actions[1]!);
  pollPad(2, actions[2]!);
  for (let i = 0; i < 3; i++) {
    const a = actions[i]!;
    const p = prev[i]!;
    a.punchPressed = a.punch && !p.punch;
    a.specialPressed = a.special && !p.special;
    a.actionPressed = a.action && !p.action;
    a.startPressed = a.start && !p.start;
  }
}

export function anyStartPressed() {
  return actions.some((a) => a.startPressed) || actions[0]!.punchPressed;
}
