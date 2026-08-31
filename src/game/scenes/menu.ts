import * as Phaser from "phaser";
import { CHARACTERS, type CharId, type RosterSlot, W, H } from "../config";
import { makeAnims } from "../anims";
import { actions, anyStartPressed, hookInput, updateInput } from "../input";
import { sfx, startMusic, unlockAudio } from "../audio";
import { loadSave } from "../save";
import { bridge } from "../bridge";
import { net } from "../net";

const FONT = '"Press Start 2P", monospace';

export class BootScene extends Phaser.Scene {
  constructor() {
    super("boot");
  }
  create() {
    hookInput();
    this.scene.start("preload");
  }
}

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super("preload");
  }
  preload() {
    const barBg = this.add.rectangle(W / 2, H / 2, W - 80, 14, 0x12182a).setStrokeStyle(2, 0xf4e4c1);
    const bar = this.add.rectangle(40, H / 2, 4, 8, 0xff6a00).setOrigin(0, 0.5);
    this.add
      .text(W / 2, H / 2 - 36, "IT'S POOP AGAIN", {
        fontFamily: FONT,
        fontSize: "12px",
        color: "#ff6a00",
      })
      .setOrigin(0.5);
    this.add
      .text(W / 2, H / 2 + 28, "LOADING . . .", { fontFamily: FONT, fontSize: "8px", color: "#f4e4c1" })
      .setOrigin(0.5);

    this.load.on("progress", (p: number) => {
      bar.width = Math.max(4, (W - 88) * p);
    });
    void barBg;

    const v = "?v=8";
    const s = (key: string, file: string) =>
      this.load.spritesheet(key, `/game/sprites/${file}${v}`, { frameWidth: 128, frameHeight: 128 });
    const img = (key: string, path: string) => this.load.image(key, `${path}${path.includes("?") ? "" : v}`);

    img("sky", "/game/map/sky.png");
    img("far", "/game/map/far.png");
    img("street", "/game/map/street.png");
    img("street2", "/game/map/street2.png");
    img("attract", "/game/attract.jpg");
    img("select", "/game/player-select.png");
    img("port-billy", "/game/portraits/billy.png");
    img("port-frank", "/game/portraits/frank.png");
    img("port-jack", "/game/portraits/jack.png");

    for (const id of ["billy", "frank", "jack"] as const) {
      s(`${id}-idle`, `${id}-idle.png`);
      s(`${id}-walk`, `${id}-walk.png`);
      s(`${id}-attack`, `${id}-attack.png`);
      s(`${id}-poop`, `${id}-poop.png`);
    }
    s("clemens-idle", "clemens-idle.png");
    s("clemens-walk", "clemens-walk.png");
    s("clemens-attack", "clemens-attack.png");
    s("clemens-stomp", "clemens-stomp.png");
    s("veronica", "veronica.png");
    s("danny", "danny.png");
    s("penguin", "penguin.png");
    s("neighbor", "neighbor.png");
    s("bush", "bush.png");
    s("bag", "bag.png");
    s("doorbell", "doorbell.png");
    s("boot", "boot.png");
    s("impact", "impact.png");
  }
  create() {
    makeAnims(this);
    this.scene.start("attract");
  }
}

export class AttractScene extends Phaser.Scene {
  started = false;
  constructor() {
    super("attract");
  }
  init() {
    this.started = false;
  }
  create() {
    bridge.setScene("attract");
    const save = loadSave();
    this.add.image(W / 2, H / 2, "attract").setDisplaySize(W, H);
    this.add.rectangle(W / 2, H / 2, W, H, 0x070b14, 0.42);

    this.add
      .text(W / 2, 28, "IT'S POOP AGAIN", {
        fontFamily: FONT,
        fontSize: "14px",
        color: "#ff6a00",
        stroke: "#1a0a00",
        strokeThickness: 4,
      })
      .setOrigin(0.5);
    this.add
      .text(W / 2, 50, "A 90s ARCADE PRANK-EM-UP", {
        fontFamily: FONT,
        fontSize: "6px",
        color: "#f4e4c1",
      })
      .setOrigin(0.5);

    this.add
      .text(W / 2, 78, `HI-SCORE  ${String(save.highScore).padStart(6, "0")}  ${save.initials}`, {
        fontFamily: FONT,
        fontSize: "8px",
        color: "#3ec6ff",
      })
      .setOrigin(0.5);

    const blink = this.add
      .text(W / 2, 160, "INSERT COIN  ·  SOLO", {
        fontFamily: FONT,
        fontSize: "8px",
        color: "#ff6a00",
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    blink.on("pointerdown", () => this.go("solo"));
    this.tweens.add({ targets: blink, alpha: 0.15, yoyo: true, duration: 420, repeat: -1 });

    const hostBtn = this.add
      .text(W / 2 - 90, 190, "HOST CREW", {
        fontFamily: FONT,
        fontSize: "7px",
        color: "#3ec6ff",
        backgroundColor: "#12182a",
        padding: { x: 8, y: 6 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    hostBtn.on("pointerdown", () => this.go("host"));

    const joinBtn = this.add
      .text(W / 2 + 90, 190, "JOIN CREW", {
        fontFamily: FONT,
        fontSize: "7px",
        color: "#f4e4c1",
        backgroundColor: "#12182a",
        padding: { x: 8, y: 6 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    joinBtn.on("pointerdown", () => {
      unlockAudio();
      sfx.coin();
      bridge.setPanel("join");
    });

    this.add
      .text(W / 2, 222, "FILL  ·  THROW  ·  PLANT  ·  LIGHT  ·  RING", {
        fontFamily: FONT,
        fontSize: "6px",
        color: "#8b7d6a",
      })
      .setOrigin(0.5);
    this.add
      .text(W / 2, 248, "PHONES: HOST A CODE, FRIENDS TAP JOIN", {
        fontFamily: FONT,
        fontSize: "5px",
        color: "#8b7d6a",
      })
      .setOrigin(0.5);

    this.input.keyboard?.on("keydown", () => {
      if (bridge.panel === "join") return;
      this.go("solo");
    });
  }
  go(mode: "solo" | "host") {
    if (this.started) return;
    if (bridge.panel === "join") return;
    this.started = true;
    unlockAudio();
    startMusic();
    sfx.coin();
    if (mode === "host") {
      void net.host().then(() => this.scene.start("select"));
      return;
    }
    net.leave();
    this.scene.start("select");
  }
  update() {
    updateInput();
    if (!this.started) {
      if (net.phase === "lobby") {
        this.started = true;
        this.scene.start("select");
        return;
      }
      if (net.phase === "play") {
        this.started = true;
        this.scene.start("play", { roster: net.roster, stage: net.stage, score: net.scoreCarry });
        return;
      }
    }
    if (bridge.panel === "join") return;
    if (anyStartPressed()) this.go("solo");
  }
}

export type { RosterSlot } from "../config";

export class SelectScene extends Phaser.Scene {
  roster: RosterSlot[] = [
    { id: "billy", human: true, peerId: null },
    { id: "frank", human: false, peerId: null },
    { id: "jack", human: false, peerId: null },
  ];
  cursor: CharId = "billy";
  labels: Phaser.GameObjects.Text[] = [];
  hint!: Phaser.GameObjects.Text;
  startLab!: Phaser.GameObjects.Text;

  constructor() {
    super("select");
  }
  init() {
    if (net.role !== "offline") {
      this.roster = net.roster.map((s) => ({ ...s }));
    } else {
      this.roster = [
        { id: "billy", human: true, peerId: null },
        { id: "frank", human: false, peerId: null },
        { id: "jack", human: false, peerId: null },
      ];
    }
    this.cursor = "billy";
  }
  hintText() {
    if (net.role === "host") return `CREW ${net.code}  ·  TAP YOUR FACE  ·  FRIENDS CAN DROP IN`;
    if (net.role === "client") return `CREW ${net.code}  ·  TAP YOUR FACE  ·  WAITING FOR HOST`;
    return "TAP A FACE  ·  2nd/3rd TAP ADDS A LOCAL HUMAN";
  }
  create() {
    bridge.setScene("select");
    bridge.setPanel("none");
    this.add.image(W / 2, H / 2, "select").setDisplaySize(W, H);
    this.add.rectangle(W / 2, 18, W, 36, 0x070b14, 0.72);
    this.add.rectangle(W / 2, H - 22, W, 48, 0x070b14, 0.78);

    this.add
      .text(W / 2, 12, "PLAYER SELECT", { fontFamily: FONT, fontSize: "10px", color: "#f4e4c1" })
      .setOrigin(0.5, 0);
    this.hint = this.add
      .text(W / 2, 26, this.hintText(), {
        fontFamily: FONT,
        fontSize: "5px",
        color: "#8b7d6a",
      })
      .setOrigin(0.5, 0);

    const zones: Array<{ id: CharId; x: number }> = [
      { id: "billy", x: W * 0.18 },
      { id: "frank", x: W * 0.5 },
      { id: "jack", x: W * 0.82 },
    ];
    this.labels = [];
    for (const z of zones) {
      const hit = this.add.rectangle(z.x, H * 0.52, 140, 170, 0x000000, 0.01).setInteractive({ useHandCursor: true });
      hit.on("pointerdown", () => this.pick(z.id));
      const lab = this.add
        .text(z.x, 44, "", { fontFamily: FONT, fontSize: "7px", color: "#3ec6ff", align: "center" })
        .setOrigin(0.5);
      this.labels.push(lab);
    }
    this.refresh();

    const start = this.add
      .text(W / 2, H - 14, net.role === "client" ? "WAITING FOR HOST TO START" : "START  ·  ENTER / TAP HERE", {
        fontFamily: FONT,
        fontSize: "7px",
        color: "#ff6a00",
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    this.startLab = start;
    start.on("pointerdown", () => this.begin());
    this.tweens.add({ targets: start, alpha: 0.4, yoyo: true, duration: 480, repeat: -1 });

    this.input.keyboard?.on("keydown-ONE", () => this.pick("billy"));
    this.input.keyboard?.on("keydown-TWO", () => this.pick("frank"));
    this.input.keyboard?.on("keydown-THREE", () => this.pick("jack"));
  }
  pick(id: CharId) {
    sfx.coin();
    this.cursor = id;
    if (net.role !== "offline") {
      net.pickLocal(id);
      this.roster = net.roster.map((s) => ({ ...s }));
      this.refresh();
      return;
    }
    const humans = this.roster.filter((r) => r.human).length;
    const existing = this.roster.find((r) => r.id === id)!;
    if (!existing.human && humans < 3) {
      existing.human = true;
    } else if (existing.human && humans > 1) {
      existing.human = false;
    }
    const p1 = this.roster.find((r) => r.id === id)!;
    if (p1.human) {
      this.roster = [p1, ...this.roster.filter((r) => r !== p1)];
    }
    this.refresh();
  }
  refresh() {
    if (net.role !== "offline") this.roster = net.roster.map((s) => ({ ...s }));
    const order: CharId[] = ["billy", "frank", "jack"];
    order.forEach((id, i) => {
      const slot = this.roster.find((r) => r.id === id)!;
      const pIndex = this.roster.indexOf(slot);
      let tag = slot.human ? `P${pIndex + 1}` : "CPU";
      if (net.role !== "offline") {
        if (slot.peerId === net.selfId) tag = "YOU";
        else if (slot.peerId) tag = "P2";
        else tag = "CPU";
      }
      const c = CHARACTERS[id];
      this.labels[i]?.setText(`${tag}\n${c.tag}`);
      this.labels[i]?.setColor(slot.human ? c.color : "#8b7d6a");
    });
    this.hint?.setText(this.hintText());
    if (this.startLab) {
      this.startLab.setText(net.role === "client" ? "WAITING FOR HOST TO START" : "START  ·  ENTER / TAP HERE");
    }
  }
  begin() {
    if (net.role === "client") {
      sfx.hurt();
      return;
    }
    unlockAudio();
    startMusic();
    sfx.special();
    if (net.role === "host") net.startMatch(net.roster);
    this.scene.start("play", { roster: net.role === "offline" ? this.roster : net.roster, stage: net.stage, score: net.scoreCarry });
  }
  update() {
    updateInput();
    if (net.role !== "offline") {
      this.roster = net.roster.map((s) => ({ ...s }));
      this.refresh();
    }
    if (net.phase === "play" && net.role === "client") {
      this.scene.start("play", { roster: net.roster, stage: net.stage, score: net.scoreCarry });
      return;
    }
    if (anyStartPressed() && net.role !== "client") this.begin();
    if (actions[0]!.punchPressed) {
      const ids: CharId[] = ["billy", "frank", "jack"];
      const i = ids.indexOf(this.cursor);
      this.pick(ids[(i + 1) % 3]!);
    }
  }
}
