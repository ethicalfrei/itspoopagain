export const W = 480;
export const H = 270;
export const TILE = 480;
export const WORLD_W = TILE * 5;
export const GROUND_Y = 252;
export const WALK_TOP = 198;
export const WALK_BOT = 252;

export const CHAR_DISPLAY = 118;
export const BOSS_DISPLAY = 132;
export const TICK = 1 / 60;
export const BAG_SLOTS = 1;

export type CharId = "billy" | "frank" | "jack";
export type OwnerId = "clemens" | "neighbor" | "veronica" | "danny";
export type RosterSlot = { id: CharId; human: boolean; peerId?: string | null };

export const CHARACTERS: Record<
  CharId,
  {
    name: string;
    tag: string;
    color: string;
    hp: number;
    speed: number;
    punch: number;
    size: number;
    special: string;
    specialName: string;
  }
> = {
  billy: {
    name: "BILLY",
    tag: "SPEED",
    color: "#3ec6ff",
    hp: 5,
    speed: 118,
    punch: 1,
    size: 118,
    special: "dash",
    specialName: "HAPPY SLAP",
  },
  frank: {
    name: "FRANK",
    tag: "TRICKS",
    color: "#7ec8a3",
    hp: 6,
    speed: 96,
    punch: 1,
    size: 112,
    special: "stun",
    specialName: "WISECRACK",
  },
  jack: {
    name: "JACK",
    tag: "POWER",
    color: "#e8b14a",
    hp: 8,
    speed: 82,
    punch: 2,
    size: 96,
    special: "charge",
    specialName: "SHOULDER",
  },
};

export const P1_KEYS = {
  left: "KeyA",
  right: "KeyD",
  up: "KeyW",
  down: "KeyS",
  punch: "KeyJ",
  special: "KeyK",
  action: "KeyL",
  action2: "Space",
  start: "Enter",
};

export const P2_KEYS = {
  left: "ArrowLeft",
  right: "ArrowRight",
  up: "ArrowUp",
  down: "ArrowDown",
  punch: "KeyO",
  special: "KeyP",
  action: "KeyU",
  start: "ShiftRight",
};

export const P3_KEYS = {
  left: "KeyF",
  right: "KeyH",
  up: "KeyT",
  down: "KeyG",
  punch: "KeyZ",
  special: "KeyX",
  action: "KeyC",
  start: "KeyV",
};

export const HOUSES: Array<{
  tile: number;
  title: string;
  owner: OwnerId;
  doorX: number;
  porchX: number;
  bushX: number;
  bellY: number;
}> = [
  { tile: 0, title: "THE JOHNSONS", owner: "neighbor", doorX: 292, porchX: 268, bushX: 86, bellY: 154 },
  { tile: 1, title: "MRS. BARKLEY", owner: "neighbor", doorX: 648, porchX: 628, bushX: 524, bellY: 158 },
  { tile: 2, title: "MS. VAUGHN", owner: "veronica", doorX: 1210, porchX: 1188, bushX: 1044, bellY: 152 },
  { tile: 3, title: "THE DUMPSTER", owner: "danny", doorX: 1688, porchX: 1664, bushX: 1510, bellY: 156 },
  { tile: 4, title: "OLD MAN CLEMENS", owner: "clemens", doorX: 2176, porchX: 2152, bushX: 2004, bellY: 150 },
];

export const HOUSES_S2: typeof HOUSES = [
  { tile: 0, title: "GRANDMA GILMORE", owner: "neighbor", doorX: 292, porchX: 268, bushX: 86, bellY: 154 },
  { tile: 1, title: "THE DRIVING RANGE", owner: "neighbor", doorX: 648, porchX: 628, bushX: 524, bellY: 158 },
  { tile: 2, title: "THE COUNTRY CLUB", owner: "veronica", doorX: 1210, porchX: 1188, bushX: 1044, bellY: 152 },
  { tile: 3, title: "MAMA BOUCHER", owner: "danny", doorX: 1688, porchX: 1664, bushX: 1510, bellY: 156 },
  { tile: 4, title: "OLD MAN CLEMENS", owner: "clemens", doorX: 2176, porchX: 2152, bushX: 2004, bellY: 150 },
];

export const STAGES: Array<{
  name: string;
  street: string;
  houses: typeof HOUSES;
}> = [
  { name: "WESTPORT LANE", street: "street", houses: HOUSES },
  { name: "FAIRWAY ESTATES", street: "street2", houses: HOUSES_S2 },
];

export const QUOTES: Record<string, string[]> = {
  clemens: ["YOU'RE ALL GONNA DIE!", "GET OFF MY LAWN!", "MY BOOT!!"],
  veronica: ["YOU'RE A DISGRACE!", "IQ OF A FENCE POST!", "SEE ME AFTER CLASS!"],
  danny: ["I LIVE IN A DUMPSTER!", "WANNA TRADE LUNCHES?", "HEH HEH HEH..."],
  neighbor: ["MY PORCH!!", "I'LL CALL THE COPS!", "KIDS THESE DAYS!"],
  penguin: ["HONK HONK!", "WADDLE WADDLE!"],
  billy: ["TOO EASY!", "FORE!", "WHO'S THE MAN?!"],
  frank: ["CLASSIC.", "RING AND RUN, BABY.", "NICE FORM."],
  jack: ["OHHH YEAH!", "THAT'S THE STUFF!", "COME GET SOME!"],
};
