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

export type CutBeat = {
  who: string;
  text: string;
  color: string;
  clip?: "poop" | "called" | "best" | "kids" | "die" | "hell" | "stomp" | "shh" | "wait" | "nice";
};

export const LINE_FILES: Record<NonNullable<CutBeat["clip"]>, string> = {
  poop: "/audio/clips/11-its-poop-again.mp3?v=clean1",
  called: "/audio/clips/12-he-called-the-shit-poop.mp3?v=clean1",
  best: "/audio/clips/13-this-is-the-best-night-of-my-life.mp3?v=clean1",
  kids: "/audio/clips/16-ill-get-you-damn-kids-youre-all-gonna-die.mp3?v=clean1",
  die: "/audio/clips/15-youre-all-gonna-die.mp3?v=clean1",
  hell: "/audio/clips/06-who-the-hell-is-it-what-do-you-want.mp3?v=clean1",
  stomp: "/audio/clips/10-call-the-fire-department-outta-control.mp3?v=clean1",
  shh: "/audio/clips/05-shh-here-he-comes.mp3?v=clean1",
  wait: "/audio/clips/02-wait-till-old-man-clemens-realizes-its-shit.mp3?v=clean1",
  nice: "/audio/clips/01-heres-a-nice-piece-of-shit.mp3?v=clean1",
};

export function houseClearBeats(stage: number, houseI: number, owner: OwnerId, title: string): CutBeat[] {
  if (owner === "clemens") {
    return stage === 0
      ? [
          { who: "BILLY", text: "WHO'S THE MAN?!", color: "#3ec6ff" },
          { who: "FRANK", text: "WESTPORT'S DONE.  FAIRWAY NEXT.", color: "#7ec8a3" },
        ]
      : [
          { who: "DANNY", text: "HEH HEH HEH...  GOT HIM.", color: "#c4b4ff" },
          { who: "BILLY", text: "NICE SHOT, DANNY.", color: "#3ec6ff" },
          { who: "FRANK", text: "BEST NIGHT OF MY LIFE.", color: "#7ec8a3", clip: "best" },
        ];
  }
  const table: CutBeat[][][] = [
    [
      [
        { who: "FRANK", text: "CLASSIC.  RING AND RUN, BABY.", color: "#7ec8a3" },
        { who: "BILLY", text: "TOO EASY!", color: "#3ec6ff" },
      ],
      [
        { who: "JACK", text: "OHHH YEAH!  THAT'S THE STUFF!", color: "#e8b14a" },
        { who: "FRANK", text: "NICE FORM.", color: "#7ec8a3" },
      ],
      [
        { who: "BILLY", text: "THAT WAS OUR TEACHER...", color: "#3ec6ff" },
        { who: "FRANK", text: "IQ OF A FENCE POST.  YOURS.", color: "#7ec8a3" },
      ],
      [
        { who: "DANNY", text: "I LIVE IN A DUMPSTER!", color: "#c4b4ff" },
        { who: "BILLY", text: "HEY DANNY...  SORRY ABOUT HIGH SCHOOL.", color: "#3ec6ff" },
      ],
    ],
    [
      [
        { who: "FRANK", text: "GRANDMA NEVER SAW IT COMING.", color: "#7ec8a3" },
        { who: "JACK", text: "COME GET SOME!", color: "#e8b14a" },
      ],
      [
        { who: "BILLY", text: "FORE!", color: "#3ec6ff" },
        { who: "FRANK", text: "KEEP THE BAGS COMING.", color: "#7ec8a3" },
      ],
      [
        { who: "BILLY", text: "COUNTRY CLUB'S GONNA HATE US.", color: "#3ec6ff" },
        { who: "JACK", text: "THAT'S THE STUFF!", color: "#e8b14a" },
      ],
      [
        { who: "FRANK", text: "MAMA BOUCHER'S GONNA LOSE IT.", color: "#7ec8a3" },
        { who: "BILLY", text: "ONE MORE HOUSE.", color: "#3ec6ff" },
      ],
    ],
  ];
  return table[stage]?.[houseI] ?? [{ who: "BILLY", text: `${title}  ·  CLEARED`, color: "#3ec6ff" }];
}

export function clemensIntroBeats(stage: number): CutBeat[] {
  return stage === 0
    ? [
        { who: "BILLY", text: "HERE'S A NICE PIECE OF SHIT.", color: "#3ec6ff", clip: "nice" },
        { who: "FRANK", text: "WAIT TILL OLD MAN CLEMENS REALIZES...", color: "#7ec8a3", clip: "wait" },
        { who: "JACK", text: "SHH.  HERE HE COMES.", color: "#e8b14a", clip: "shh" },
      ]
    : [
        { who: "FRANK", text: "HE'S BACK.  AND HE'S MAD.", color: "#7ec8a3" },
        { who: "BILLY", text: "GOOD.  I LIKE HIM MAD.", color: "#3ec6ff" },
        { who: "JACK", text: "SHH.  HERE HE COMES.", color: "#e8b14a", clip: "shh" },
      ];
}
