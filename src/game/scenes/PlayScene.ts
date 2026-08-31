import * as Phaser from "phaser";
import {
  BOSS_DISPLAY,
  CHARACTERS,
  GROUND_Y,
  H,
  QUOTES,
  STAGES,
  TILE,
  TICK,
  W,
  WALK_BOT,
  WALK_TOP,
  WORLD_W,
  type CharId,
  type OwnerId,
  type RosterSlot,
} from "../config";
import { actions, setInjectedKeys, updateInput, type Actions } from "../input";
import { sfx, startMusic, stopMusic, unlockAudio } from "../audio";
import { loadSave, submitScore } from "../save";
import { bridge } from "../bridge";
import { net, type FoeSnap, type HouseSnap, type NetInput } from "../net";

type State = "idle" | "walk" | "punch" | "hurt" | "fill" | "special" | "dead";

type Fighter = {
  slot: number;
  id: CharId;
  human: boolean;
  sprite: Phaser.Physics.Arcade.Sprite;
  bagIcon: Phaser.GameObjects.Sprite;
  hp: number;
  maxHp: number;
  lives: number;
  facing: 1 | -1;
  state: State;
  stateT: number;
  invuln: number;
  holding: boolean;
  premium: boolean;
  specialCd: number;
  fillT: number;
  aiWait: number;
  hitLanded: boolean;
  laneY: number;
  walkHold: number;
  peerId: string | null;
  tx: number;
  ty: number;
};

type House = {
  i: number;
  x: number;
  owner: OwnerId;
  title: string;
  porchX: number;
  doorX: number;
  bushX: number;
  bellY: number;
  bush: Phaser.GameObjects.Sprite;
  bell: Phaser.GameObjects.Sprite;
  ringHint: Phaser.GameObjects.Text;
  state: "ready" | "filling" | "bagged" | "lit" | "rung" | "chaos" | "cleared";
  bag: Phaser.GameObjects.Sprite | null;
  fill: number;
  premium: boolean;
  litT: number;
};

type Foe = {
  kind: "clemens" | "neighbor" | "veronica" | "danny" | "penguin";
  sprite: Phaser.Physics.Arcade.Sprite;
  hp: number;
  maxHp: number;
  facing: 1 | -1;
  state: "idle" | "walk" | "attack" | "hurt" | "stomp" | "dead";
  stateT: number;
  throwCd: number;
  house: House | null;
  yelled: boolean;
  spawnT: number;
  hot: boolean;
};

type Shot = {
  sprite: Phaser.Physics.Arcade.Sprite;
  vx: number;
  vy: number;
  life: number;
  dmg: number;
};

const FONT = '"Press Start 2P", monospace';

export class PlayScene extends Phaser.Scene {
  roster!: RosterSlot[];
  fighters: Fighter[] = [];
  houses: House[] = [];
  foes: Foe[] = [];
  shots: Shot[] = [];
  score = 0;
  combo = 0;
  comboT = 0;
  hitstop = 0;
  acc = 0;
  paused = false;
  over = false;
  won = false;
  continueT = 0;
  gateX = 520;
  penguinSpawned = false;
  hudScore!: Phaser.GameObjects.Text;
  hudCombo!: Phaser.GameObjects.Text;
  hudHint!: Phaser.GameObjects.Text;
  hpBars: Phaser.GameObjects.Rectangle[] = [];
  fillBar!: Phaser.GameObjects.Rectangle;
  marker!: Phaser.GameObjects.Text;
  overlay?: Phaser.GameObjects.Container;
  howto?: Phaser.GameObjects.Container;
  lead!: Fighter;
  trauma = 0;
  howtoT = 0;
  snapAcc = 0;
  inputAcc = 0;
  stage = 0;
  staging = false;
  carry: Array<{ hp: number; lives: number }> | null = null;
  debugSkip = 0;

  constructor() {
    super("play");
  }

  init(data: {
    roster?: RosterSlot[];
    stage?: number;
    score?: number;
    carry?: Array<{ hp: number; lives: number }>;
  }) {
    this.roster = data.roster ?? [
      { id: "billy", human: true },
      { id: "frank", human: false },
      { id: "jack", human: false },
    ];
    this.stage = data.stage ?? 0;
    this.carry = data.carry ?? null;
    this.debugSkip = 0;
    if (typeof window !== "undefined") {
      const q = new URLSearchParams(window.location.search);
      const n = Number(q.get("skip") ?? 0);
      if (Number.isFinite(n) && n > 0) this.debugSkip = Math.min(4, Math.floor(n));
      const st = Number(q.get("stage") ?? this.stage);
      if (data.stage == null && Number.isFinite(st) && st > 0) this.stage = Math.min(STAGES.length - 1, Math.floor(st));
    }
    this.fighters = [];
    this.houses = [];
    this.foes = [];
    this.shots = [];
    this.score = data.score ?? 0;
    this.combo = 0;
    this.comboT = 0;
    this.hitstop = 0;
    this.acc = 0;
    this.paused = false;
    this.over = false;
    this.won = false;
    this.continueT = 0;
    this.gateX = this.debugSkip > 0 ? (this.debugSkip + 1) * TILE - 20 : TILE - 20;
    this.penguinSpawned = false;
    this.trauma = 0;
    this.howtoT = this.stage === 0 && this.debugSkip === 0 ? 3.2 : 0;
    this.snapAcc = 0;
    this.inputAcc = 0;
    this.staging = false;
    this.hpBars = [];
    this.overlay = undefined;
    this.howto = undefined;
  }

  create() {
    bridge.setScene("play");
    unlockAudio();
    startMusic();
    this.physics.world.setBounds(0, WALK_TOP - 8, WORLD_W, WALK_BOT - WALK_TOP + 16);
    this.cameras.main.setBounds(0, 0, WORLD_W, H);
    this.cameras.main.setRoundPixels(true);

    const streetKey = STAGES[this.stage]?.street ?? "street";
    this.add.image(0, 0, "sky").setOrigin(0, 0).setDisplaySize(WORLD_W, H).setScrollFactor(0.08).setDepth(-40);
    this.add.image(0, 18, "far").setOrigin(0, 0).setDisplaySize(WORLD_W * 0.7, H).setScrollFactor(0.22).setDepth(-30);
    this.add.image(0, 0, streetKey).setOrigin(0, 0).setDisplaySize(WORLD_W, H).setDepth(-5);
    for (let i = 1; i < 5; i++) {
      const x = i * TILE;
      this.add.rectangle(x, 186, 12, 78, 0x0c160c).setDepth(-1);
      this.add.rectangle(x - 8, 198, 10, 54, 0x142814).setDepth(-1);
      this.add.rectangle(x + 8, 198, 10, 54, 0x142814).setDepth(-1);
    }

    this.makeHouses();
    this.spawnFighters();
    this.lead =
      this.fighters.find((f) => f.peerId === net.selfId) ??
      this.fighters.find((f) => f.human) ??
      this.fighters[0]!;
    this.cameras.main.startFollow(this.lead.sprite, true, 0.12, 0.08);
    this.cameras.main.setDeadzone(80, 30);

    this.hud();
    if (this.stage === 0) this.showHowto();
    else {
      const st = STAGES[this.stage]!;
      this.banner(`STAGE ${this.stage + 1}`, st.name);
    }

    net.setGameHooks({
      onDropin: (id) => this.takeover(id),
      onPeerLeft: (id) => this.release(id),
    });
    const off = net.subscribe(() => {
      if (net.role !== "client") return;
      if (net.stage !== this.stage && net.phase === "play" && !this.staging) {
        this.staging = true;
        this.scene.start("play", { roster: net.roster, stage: net.stage, score: net.scoreCarry });
      }
    });
    this.events.once("shutdown", () => {
      off();
      this.fighters = [];
      this.foes = [];
      this.shots = [];
      net.setGameHooks(null);
      bridge.setActionLabel("ACTION");
    });

    this.wireControlsTest();
  }

  makeHouses() {
    const specs = STAGES[this.stage]?.houses ?? STAGES[0]!.houses;
    specs.forEach((spec, i) => {
      const bush = this.add
        .sprite(spec.bushX, GROUND_Y - 2, "bush", 0)
        .setOrigin(0.5, 1)
        .setDisplaySize(72, 60)
        .setDepth(4);
      bush.play("bush-idle");
      const bell = this.add
        .sprite(spec.doorX + 10, spec.bellY, "doorbell", 0)
        .setOrigin(0.5, 0.5)
        .setDisplaySize(22, 22)
        .setDepth(6);
      bell.play("bell-idle");
      const ringHint = this.add
        .text(spec.doorX, spec.bellY - 18, "", {
          fontFamily: FONT,
          fontSize: "7px",
          color: "#ff6a00",
          stroke: "#1a0a00",
          strokeThickness: 3,
        })
        .setOrigin(0.5)
        .setDepth(90)
        .setVisible(false);
      this.houses.push({
        i,
        x: spec.tile * TILE + TILE / 2,
        owner: spec.owner,
        title: spec.title,
        porchX: spec.porchX,
        doorX: spec.doorX,
        bushX: spec.bushX,
        bellY: spec.bellY,
        bush,
        bell,
        ringHint,
        state: i < this.debugSkip ? "cleared" : "ready",
        bag: null,
        fill: 0,
        premium: false,
        litT: 0,
      });
      this.add
        .text(spec.tile * TILE + TILE / 2, 38, spec.title, {
          fontFamily: FONT,
          fontSize: "6px",
          color: "#f4e4c1",
          stroke: "#070b14",
          strokeThickness: 3,
        })
        .setOrigin(0.5, 0)
        .setDepth(8);
    });
  }

  spawnFighters() {
    const startX = this.debugSkip > 0 ? this.debugSkip * TILE + 70 : 70;
    this.roster.forEach((r, slot) => {
      const x = startX + slot * 36;
      const laneY = 214 + slot * 14;
      const size = CHARACTERS[r.id].size;
      const spr = this.physics.add.sprite(x, laneY, `${r.id}-idle`, 0);
      spr.setDisplaySize(size, size);
      spr.setOrigin(0.5, 1);
      spr.setCollideWorldBounds(true);
      spr.setDepth(laneY);
      spr.body?.setSize(26, 16);
      spr.body?.setOffset(51, 108);
      spr.play(`${r.id}-idle`);
      const bagIcon = this.add
        .sprite(x + 14, laneY - 22, "bag", 0)
        .setDisplaySize(28, 32)
        .setVisible(false)
        .setDepth(laneY + 1);
      const maxHp = CHARACTERS[r.id].hp;
      const carried = this.carry?.[slot];
      this.fighters.push({
        slot,
        id: r.id,
        human: r.human,
        sprite: spr,
        bagIcon,
        hp: carried ? Math.max(1, carried.hp) : maxHp,
        maxHp,
        lives: carried ? Math.max(1, carried.lives) : 3,
        facing: 1,
        state: "idle",
        stateT: 0,
        invuln: 0,
        holding: false,
        premium: false,
        specialCd: 0,
        fillT: 0,
        aiWait: 0,
        hitLanded: false,
        laneY,
        walkHold: 0,
        peerId: r.peerId ?? null,
        tx: x,
        ty: laneY,
      });
    });
  }

  hud() {
    this.add.rectangle(W / 2, 16, W, 32, 0x070b14, 0.78).setScrollFactor(0).setDepth(2000);
    this.hudScore = this.add
      .text(8, 4, "SCORE 000000", { fontFamily: FONT, fontSize: "8px", color: "#f4e4c1" })
      .setScrollFactor(0)
      .setDepth(2001);
    this.hudCombo = this.add
      .text(W - 8, 4, "", { fontFamily: FONT, fontSize: "8px", color: "#ff6a00" })
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setDepth(2001);

    this.fighters.forEach((f, i) => {
      const x = 10 + i * 118;
      const port = this.add.image(x, 20, `port-${f.id}`).setDisplaySize(18, 18).setOrigin(0, 0.5).setScrollFactor(0).setDepth(2002);
      void port;
      this.add
        .text(x + 22, 14, `${f.human ? "P" + (i + 1) : "CPU"} ${CHARACTERS[f.id].name}`, {
          fontFamily: FONT,
          fontSize: "5px",
          color: CHARACTERS[f.id].color,
        })
        .setScrollFactor(0)
        .setDepth(2001);
      this.add.rectangle(x + 22, 24, 72, 5, 0x2a2030).setOrigin(0, 0.5).setScrollFactor(0).setDepth(2001);
      const hp = this.add.rectangle(x + 22, 24, 72, 5, 0xe23b3b).setOrigin(0, 0.5).setScrollFactor(0).setDepth(2002);
      this.hpBars.push(hp);
    });

    this.add.rectangle(W / 2, H - 11, W, 22, 0x070b14, 0.72).setScrollFactor(0).setDepth(2000);
    this.hudHint = this.add
      .text(W / 2, H - 11, "PRESS ACTION AT THE BUSH  TO FILL A BAG", {
        fontFamily: FONT,
        fontSize: "6px",
        color: "#ffd27a",
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(2001);

    this.fillBar = this.add.rectangle(0, 0, 0, 5, 0x3ec6ff).setVisible(false).setDepth(50);
    this.marker = this.add
      .text(0, 0, "!", { fontFamily: FONT, fontSize: "10px", color: "#ff6a00", stroke: "#1a0a00", strokeThickness: 3 })
      .setOrigin(0.5)
      .setDepth(80);
    const st = STAGES[this.stage];
    if (st) {
      this.add
        .text(W - 8, 16, `STAGE ${this.stage + 1}  ${st.name}`, {
          fontFamily: FONT,
          fontSize: "5px",
          color: "#8b7d6a",
        })
        .setOrigin(1, 0)
        .setScrollFactor(0)
        .setDepth(2001);
    }
  }

  showHowto() {
    const c = this.add.container(W / 2, 86).setScrollFactor(0).setDepth(1800);
    c.add(this.add.rectangle(0, 0, 360, 92, 0x070b14, 0.86).setStrokeStyle(2, 0xff6a00));
    c.add(this.add.text(0, -34, "RING & RUN", { fontFamily: FONT, fontSize: "10px", color: "#ff6a00" }).setOrigin(0.5));
    c.add(this.add.text(0, -14, "1. PRESS ACTION AT THE BUSH", { fontFamily: FONT, fontSize: "6px", color: "#f4e4c1" }).setOrigin(0.5));
    c.add(this.add.text(0, 2, "2. DROP THE BAG ON THE PORCH", { fontFamily: FONT, fontSize: "6px", color: "#f4e4c1" }).setOrigin(0.5));
    c.add(this.add.text(0, 18, "3. LIGHT IT   4. WALK TO THE DOOR", { fontFamily: FONT, fontSize: "6px", color: "#f4e4c1" }).setOrigin(0.5));
    c.add(this.add.text(0, 34, "5. PRESS ACTION TO RING  THEN RUN", { fontFamily: FONT, fontSize: "6px", color: "#3ec6ff" }).setOrigin(0.5));
    this.howto = c;
  }

  banner(title: string, sub: string) {
    const c = this.add.container(W / 2, 78).setDepth(1500).setScrollFactor(0);
    const t = this.add.text(0, 0, title, { fontFamily: FONT, fontSize: "10px", color: "#ff6a00" }).setOrigin(0.5);
    const s = this.add.text(0, 16, sub, { fontFamily: FONT, fontSize: "6px", color: "#f4e4c1" }).setOrigin(0.5);
    c.add([t, s]);
    this.tweens.add({
      targets: c,
      y: 64,
      alpha: 0,
      delay: 1400,
      duration: 400,
      onComplete: () => c.destroy(),
    });
    this.time.delayedCall(2000, () => {
      if (c.active) c.destroy();
    });
  }

  wireControlsTest() {
    const self = this;
    (window as unknown as { __controlsTest: unknown }).__controlsTest = {
      getYaw: () => {
        const f = self.lead;
        return f.facing < 0 ? Math.PI : 0;
      },
      getSpeed: () => {
        const b = self.lead.sprite.body as Phaser.Physics.Arcade.Body | undefined;
        if (!b) return 0;
        return Math.hypot(b.velocity.x, b.velocity.y) / 80;
      },
      getX: () => self.lead.sprite.x,
      setKeys: (codes: string[]) => setInjectedKeys(codes),
    };
  }

  update(_t: number, delta: number) {
    const dt = Math.min(delta, 100) / 1000;
    updateInput();
    if (actions[0]!.startPressed && !this.over) this.paused = !this.paused;
    if (this.paused && !this.over) {
      this.drawPause();
      return;
    }
    if (this.overlay && !this.paused) {
      this.overlay.destroy();
      this.overlay = undefined;
    }
    if (this.hitstop > 0) {
      this.hitstop -= dt;
      this.present();
      return;
    }
    this.acc += dt;
    let steps = 0;
    while (this.acc >= TICK && steps < 4) {
      this.step(TICK);
      this.acc -= TICK;
      steps++;
    }
    this.present();
  }

  step(dt: number) {
    if (net.role === "client") {
      this.stepClient(dt);
      return;
    }
    if (this.over) {
      this.continueT += dt;
      return;
    }
    if (this.howto) {
      this.howtoT -= dt;
      if (this.howtoT <= 0 || actions[0]!.actionPressed || actions[0]!.punchPressed) {
        this.howto.destroy();
        this.howto = undefined;
      }
    }
    this.comboT -= dt;
    if (this.comboT <= 0) this.combo = 0;
    this.trauma = Math.max(0, this.trauma - dt * 1.8);
    if (this.staging) return;

    for (const f of this.fighters) this.stepFighter(f, dt);
    this.separate();
    for (const foe of this.foes) this.stepFoe(foe, dt);
    this.stepShots(dt);
    this.stepHouses(dt);
    this.depthSort();
    this.advanceGate();
    this.maybePenguin();
    this.checkEnd();
    if (net.role === "host") this.flushSnap(dt);
  }

  emptyAct(): Actions {
    return {
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
    };
  }

  netToActions(inp: NetInput | undefined): Actions {
    if (!inp) return this.emptyAct();
    const a = this.emptyAct();
    a.moveX = inp.mx;
    a.moveY = inp.my;
    a.punch = inp.punch;
    a.punchPressed = inp.punchP;
    a.special = inp.special;
    a.specialPressed = inp.specialP;
    a.action = inp.action;
    a.actionPressed = inp.actionP;
    inp.punchP = false;
    inp.specialP = false;
    inp.actionP = false;
    return a;
  }

  actFor(f: Fighter): Actions {
    if (net.role === "host") {
      if (f.peerId && f.peerId !== net.selfId) return this.netToActions(net.remoteInputs.get(f.peerId));
      if (f.human && (!f.peerId || f.peerId === net.selfId)) return actions[0]!;
      return this.ai(f);
    }
    if (net.role === "client") {
      if (f.peerId === net.selfId || f.slot === net.mySlot) return actions[0]!;
      return this.emptyAct();
    }
    if (f.human) return actions[f.slot] ?? actions[0]!;
    return this.ai(f);
  }

  ai(f: Fighter): Actions {
    const a: Actions = {
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
    };
    if (f.state === "dead" || f.state === "hurt") return a;
    const nearFoe = this.foes.find(
      (e) =>
        e.state !== "dead" &&
        e.spawnT > 1.4 &&
        Math.abs(e.sprite.x - f.sprite.x) < 70 &&
        Math.abs(e.sprite.y - f.sprite.y) < 18,
    );
    if (nearFoe) {
      a.moveX = Math.sign(nearFoe.sprite.x - f.sprite.x);
      a.moveY = Math.sign(f.laneY - f.sprite.y) * 0.3;
      if (Math.abs(nearFoe.sprite.x - f.sprite.x) < 30) {
        a.punch = true;
        a.punchPressed = f.state !== "punch";
      }
      return a;
    }

    // Partners run the prank too — each house rotates who squats.
    if (f.holding) {
      const house = this.currentHouse() ?? this.nearestHouse(f.sprite.x);
      if (house && Math.abs(f.sprite.x - house.porchX) < 32) {
        a.action = true;
        a.actionPressed = true;
      } else if (house) {
        a.moveX = Math.sign(house.porchX - f.sprite.x);
      }
      a.moveY = Math.sign(f.laneY - f.sprite.y) * 0.35;
      return a;
    }

    const house = this.currentHouse();
    if (house && house.state !== "chaos" && house.state !== "cleared") {
      const filling = this.fighters.find((x) => x.state === "fill");
      const holder = this.fighters.find((x) => x.holding);
      if (!holder && (house.state === "ready" || house.state === "filling")) {
        if ((!filling || filling === f) && this.designatedFiller(house) === f) {
          const dx = house.bushX - f.sprite.x;
          a.moveY = Math.sign(f.laneY - f.sprite.y) * 0.3;
          if (Math.abs(dx) > 16) a.moveX = Math.sign(dx);
          else {
            a.action = true;
            a.actionPressed = f.state !== "fill";
          }
          return a;
        }
      }
      if (!filling && house.state === "bagged" && house.bag && this.closestLiving(house.porchX) === f) {
        const dx = house.porchX - f.sprite.x;
        if (Math.abs(dx) > 16) a.moveX = Math.sign(dx);
        else {
          a.action = true;
          a.actionPressed = true;
        }
        a.moveY = Math.sign(f.laneY - f.sprite.y) * 0.3;
        return a;
      }
      if (house.state === "lit" && this.closestLiving(house.doorX) === f) {
        const dx = house.doorX - f.sprite.x;
        if (Math.abs(dx) > 18) a.moveX = Math.sign(dx);
        else {
          a.action = true;
          a.actionPressed = true;
        }
        a.moveY = Math.sign(f.laneY - f.sprite.y) * 0.3;
        return a;
      }
    }

    const lead = this.lead;
    const view = this.cameras.main.worldView;
    const minX = view.x + 40;
    const tx = Phaser.Math.Clamp(lead.sprite.x - 36 - f.slot * 24, minX, lead.sprite.x - 22);
    const ty = f.laneY;
    a.moveX = Math.abs(tx - f.sprite.x) > 22 ? Math.sign(tx - f.sprite.x) : 0;
    a.moveY = Math.abs(ty - f.sprite.y) > 10 ? Math.sign(ty - f.sprite.y) * 0.45 : 0;
    return a;
  }

  stepFighter(f: Fighter, dt: number) {
    f.stateT += dt;
    f.invuln = Math.max(0, f.invuln - dt);
    f.specialCd = Math.max(0, f.specialCd - dt);
    const a = this.actFor(f);
    const spr = f.sprite;
    const body = spr.body as Phaser.Physics.Arcade.Body;
    const stats = CHARACTERS[f.id];

    if (f.state === "dead") {
      body.setVelocity(0, 0);
      spr.setAlpha(0.3);
      if (f.human && f.lives > 0 && f.stateT > 1.4) this.respawn(f);
      return;
    }
    if (f.state === "hurt") {
      if (f.stateT > 0.35) this.setState(f, "idle");
      return;
    }
    if (f.state === "punch") {
      if (!f.hitLanded && f.stateT > 0.08 && f.stateT < 0.22) {
        if (this.tryHit(f)) f.hitLanded = true;
      }
      if (f.stateT > 0.28) this.setState(f, "idle");
      body.setVelocity(f.facing * 20, 0);
      return;
    }
    if (f.state === "special") {
      this.stepSpecial(f);
      return;
    }
    if (f.state === "fill") {
      this.stepFill(f, a, dt);
      body.setVelocity(0, 0);
      return;
    }

    const mx = a.moveX;
    const my = a.moveY;
    const spd = stats.speed;
    body.setVelocity(mx * spd, my * spd * 0.55);
    if (mx > 0.18) f.facing = 1;
    if (mx < -0.18) f.facing = -1;
    spr.setFlipX(f.facing < 0);

    // Only the walk cycle for real horizontal travel — lane fidget was
    // making Jack's high-step sheet look like a stomp loop.
    const moving = Math.abs(mx) > 0.42;
    if (moving) f.walkHold = Math.min(10, f.walkHold + 1);
    else f.walkHold = Math.max(0, f.walkHold - 3);
    if (f.walkHold >= 5) this.setState(f, "walk");
    else if (f.walkHold <= 0) this.setState(f, "idle");

    if (spr.y < WALK_TOP) spr.y = WALK_TOP;
    if (spr.y > WALK_BOT) spr.y = WALK_BOT;
    if (spr.x < this.cameras.main.worldView.x + 16) spr.x = this.cameras.main.worldView.x + 16;
    if (spr.x > this.gateX) spr.x = this.gateX;

    if (a.punchPressed) this.startPunch(f);
    else if (a.specialPressed && f.specialCd <= 0) this.startSpecial(f);
    else if (a.actionPressed || a.action) this.tryAction(f, a);

    if (f.holding) {
      f.bagIcon.setVisible(true);
      f.bagIcon.setPosition(spr.x + f.facing * 16, spr.y - 28);
      f.bagIcon.setFlipX(f.facing < 0);
      f.bagIcon.setDepth(spr.y + 1);
    } else f.bagIcon.setVisible(false);
  }

  separate() {
    for (let i = 0; i < this.fighters.length; i++) {
      const a = this.fighters[i]!;
      if (a.state === "dead" || a.state === "fill") continue;
      for (let j = i + 1; j < this.fighters.length; j++) {
        const b = this.fighters[j]!;
        if (b.state === "dead" || b.state === "fill") continue;
        const dx = b.sprite.x - a.sprite.x;
        const dy = b.sprite.y - a.sprite.y;
        if (Math.abs(dx) < 22 && Math.abs(dy) < 12) {
          const push = 10;
          b.sprite.y += Math.sign(dy || 1) * push * 0.15;
          a.sprite.y -= Math.sign(dy || 1) * push * 0.15;
        }
      }
    }
  }

  setState(f: Fighter, s: State) {
    if (f.state === s) return;
    f.state = s;
    f.stateT = 0;
    const id = f.id;
    if (s === "walk") f.sprite.play(`${id}-walk`, true);
    else if (s === "punch" || s === "special") f.sprite.play(`${id}-attack`, true);
    else if (s === "fill") {
      f.sprite.play(`${id}-poop`, true);
    } else f.sprite.play(`${id}-idle`, true);
  }

  startPunch(f: Fighter) {
    this.setState(f, "punch");
    f.hitLanded = false;
    sfx.punch();
  }

  tryHit(f: Fighter): boolean {
    const range = 32;
    const x = f.sprite.x + f.facing * 22;
    const y = f.sprite.y;
    for (const foe of this.foes) {
      if (foe.state === "dead") continue;
      if (Math.abs(foe.sprite.x - x) < range && Math.abs(foe.sprite.y - y) < 16) {
        this.hurtFoe(foe, CHARACTERS[f.id].punch, f.facing);
        this.pop(foe.sprite.x, foe.sprite.y - 36, `+${50 * (this.combo + 1)}`, "#f4e4c1");
        this.addScore(50);
        return true;
      }
    }
    return false;
  }

  startSpecial(f: Fighter) {
    this.setState(f, "special");
    f.specialCd = 2.4;
    sfx.special();
    this.pop(f.sprite.x, f.sprite.y - 40, CHARACTERS[f.id].specialName, CHARACTERS[f.id].color);
  }

  stepSpecial(f: Fighter) {
    const body = f.sprite.body as Phaser.Physics.Arcade.Body;
    const kind = CHARACTERS[f.id].special;
    if (kind === "dash") {
      body.setVelocity(f.facing * 260, 0);
      this.tryHit(f);
      if (f.stateT > 0.28) this.setState(f, "idle");
    } else if (kind === "charge") {
      body.setVelocity(f.facing * 180, 0);
      this.tryHit(f);
      if (f.stateT > 0.4) this.setState(f, "idle");
    } else {
      body.setVelocity(0, 0);
      for (const foe of this.foes) {
        if (foe.state === "dead") continue;
        if (Math.abs(foe.sprite.x - f.sprite.x) < 90 && Math.abs(foe.sprite.y - f.sprite.y) < 22) {
          foe.state = "hurt";
          foe.stateT = 0;
        }
      }
      if (f.stateT > 0.45) this.setState(f, "idle");
    }
  }

  tryAction(f: Fighter, a: Actions) {
    const house = this.interactHouse(f.sprite.x);
    if (!house) return;
    const x = f.sprite.x;
    if (f.holding && Math.abs(x - house.bushX) < 56) {
      if (a.actionPressed) this.pop(x, f.sprite.y - 40, "TAKE IT TO THE PORCH", "#ffd27a");
      return;
    }
    if ((house.state === "ready" || house.state === "filling") && !f.holding && Math.abs(x - house.bushX) < 52) {
      if (this.fighters.some((x) => x !== f && x.state === "fill")) return;
      if (a.actionPressed || (a.action && f.state !== "fill")) {
        this.setState(f, "fill");
        house.state = "filling";
        f.fillT = 0;
        f.sprite.x = house.bushX + 6;
        house.bush.play("bush-shake");
        sfx.bag();
        sfx.strain();
        this.pop(house.bushX, GROUND_Y - 64, "NATURE CALLS...", "#3ec6ff");
      }
      return;
    }
    if (f.holding && Math.abs(x - house.porchX) < 48 && (house.state === "ready" || house.state === "filling" || house.state === "bagged")) {
      if (a.actionPressed) this.plant(f, house);
      return;
    }
    if (!f.holding && house.state === "bagged" && house.bag && Math.abs(x - house.bag.x) < 48) {
      if (a.actionPressed) this.light(house);
      return;
    }
    if (house.state === "lit" && Math.abs(x - house.doorX) < 64) {
      if (a.actionPressed) this.ring(f, house);
    }
  }

  stepFill(f: Fighter, _a: Actions, dt: number) {
    f.fillT += dt;
    const house = this.interactHouse(f.sprite.x);
    if (!house || Math.abs(f.sprite.x - house.bushX) > 64) {
      this.fillBar.setVisible(false);
      if (house && house.state === "filling") house.state = "ready";
      this.setState(f, "idle");
      return;
    }
    const NEED = 1.15;
    house.fill = Math.min(1, f.fillT / NEED);
    this.fillBar.setVisible(true).setPosition(house.bushX, GROUND_Y - 56).setSize(52 * house.fill, 6);
    this.fillBar.setFillStyle(0x5dff7a);
    f.sprite.x = house.bushX + 6;
    if (Math.floor(f.fillT * 7) !== Math.floor((f.fillT - dt) * 7)) {
      const drop = this.add.rectangle(f.sprite.x + 10, f.sprite.y - 56, 3, 5, 0xffe566).setDepth(60);
      this.tweens.add({
        targets: drop,
        y: drop.y - 18,
        alpha: 0,
        duration: 420,
        onComplete: () => drop.destroy(),
      });
    }
    if (f.fillT > 0.45 && f.fillT - dt <= 0.45) {
      sfx.strain();
      house.bush.play("bush-shake");
    }
    if (f.fillT >= NEED) {
      this.fillBar.setVisible(false);
      f.holding = true;
      f.premium = true;
      house.state = "ready";
      this.addScore(100);
      this.pop(f.sprite.x, f.sprite.y - 40, "BAG READY", "#ff6a00");
      sfx.coin();
      this.setState(f, "idle");
    }
  }

  plant(f: Fighter, house: House) {
    f.holding = false;
    f.bagIcon.setVisible(false);
    if (house.bag) house.bag.destroy();
    const bag = this.add.sprite(house.porchX, GROUND_Y - 2, "bag", 0).setOrigin(0.5, 1).setDisplaySize(40, 48).setDepth(7);
    bag.play("bag-idle");
    house.bag = bag;
    house.state = "bagged";
    house.premium = f.premium;
    f.premium = false;
    this.addScore(100);
    this.pop(bag.x, bag.y - 24, "PLANTED", "#f4e4c1");
    sfx.bag();
  }

  light(house: House) {
    if (!house.bag) return;
    house.state = "lit";
    house.litT = 0;
    house.bag.play("bag-fire");
    house.bell.play("bell-glow");
    house.ringHint.setText("RING!").setVisible(true);
    sfx.fire();
    this.addScore(50);
    this.pop(house.bag.x, house.bag.y - 26, "LIT!", "#ff6a00");
    this.trauma = Math.min(1, this.trauma + 0.25);
    this.tweens.add({ targets: house.bell, scaleX: 1.35, scaleY: 1.35, yoyo: true, duration: 180, repeat: 8 });
  }

  ring(f: Fighter, house: House) {
    house.state = "rung";
    house.ringHint.setVisible(false);
    house.bell.play("bell-idle");
    sfx.ding();
    this.addScore(150);
    this.pop(house.doorX, GROUND_Y - 88, "DING DONG", "#3ec6ff");
    this.time.delayedCall(780, () => this.homeowner(house, f));
    this.time.delayedCall(900, () => {
      if (Math.abs(f.sprite.x - house.doorX) > 40) {
        this.addScore(250);
        this.pop(f.sprite.x, f.sprite.y - 40, "RING & RUN!", "#5dff7a");
      }
    });
  }

  homeowner(house: House, _ringer: Fighter) {
    if (house.state === "cleared") return;
    house.state = "chaos";
    const kind = house.owner;
    const tex = kind === "clemens" ? "clemens-idle" : kind === "veronica" ? "veronica" : kind === "danny" ? "danny" : "neighbor";
    const size = kind === "clemens" ? BOSS_DISPLAY : 110;
    const spr = this.physics.add.sprite(house.doorX - 20, 236, tex, 0);
    spr.setDisplaySize(size, size);
    spr.setOrigin(0.5, 1);
    spr.setFlipX(true);
    spr.play(kind === "clemens" ? "clemens-idle" : kind === "neighbor" ? "neighbor-walk" : `${kind}-idle`);
    const hp =
      kind === "clemens"
        ? this.stage === 0
          ? 22
          : 30
        : kind === "veronica"
          ? this.stage === 0
            ? 14
            : 18
          : kind === "danny"
            ? this.stage === 0
              ? 16
              : 20
            : this.stage === 0
              ? 12
              : 16;
    const foe: Foe = {
      kind,
      sprite: spr,
      hp,
      maxHp: hp,
      facing: -1,
      state: "walk",
      stateT: 0,
      throwCd: 1.1,
      house,
      yelled: false,
      spawnT: 0,
      hot: false,
    };
    this.foes.push(foe);
    this.say(foe, QUOTES[kind]?.[0] ?? "HEY!");
    sfx.yell();
    this.banner(house.title, "LOOK OUT!");
  }

  stepFoe(foe: Foe, dt: number) {
    foe.stateT += dt;
    foe.spawnT += dt;
    foe.throwCd = Math.max(0, foe.throwCd - dt);
    const spr = foe.sprite;
    const body = spr.body as Phaser.Physics.Arcade.Body;
    if (foe.state === "dead") {
      body.setVelocity(0, 0);
      spr.setAlpha(Math.max(0, 1 - foe.stateT));
      if (foe.stateT > 0.8) {
        spr.destroy();
        this.foes = this.foes.filter((e) => e !== foe);
      }
      return;
    }
    if (foe.state === "hurt") {
      if (foe.stateT > 0.3) foe.state = "walk";
      return;
    }
    if (foe.state === "stomp") {
      body.setVelocity(0, 0);
      const impact = foe.kind === "clemens" ? 0.28 : 0.22;
      const done = foe.kind === "clemens" ? 1.15 : 0.7;
      if (foe.stateT > impact && foe.house?.bag && foe.house.bag.visible) {
        this.squashBag(foe);
      }
      if (foe.stateT > (foe.kind === "clemens" ? 0.62 : 0.45) && foe.house?.bag) this.stompBag(foe);
      if (foe.kind === "clemens" && foe.hot && foe.stateT > 0.92 && foe.throwCd <= 0) {
        const target = this.closestLiving(spr.x);
        if (target) this.foeThrow(foe, target);
      }
      if (foe.stateT > done) {
        foe.state = "walk";
        if (foe.kind === "clemens") spr.play("clemens-walk", true);
      }
      return;
    }
    if (foe.state === "attack") {
      if (foe.stateT > 0.12 && foe.stateT < 0.22) this.foeStrike(foe);
      if (foe.stateT > 0.4) foe.state = "walk";
      return;
    }

    const house = foe.house;
    if (house?.bag && (house.state === "lit" || house.state === "rung" || house.state === "bagged") && !foe.yelled) {
      const dx = house.bag.x - spr.x;
      body.setVelocity(Math.sign(dx) * 70, 0);
      if (Math.abs(dx) < 22) {
        this.beginStomp(foe);
      }
      return;
    }

    const target = this.closestLiving(spr.x);
    if (!target) {
      body.setVelocity(0, 0);
      return;
    }
    const dx = target.sprite.x - spr.x;
    const dy = target.sprite.y - spr.y;
    foe.facing = dx < 0 ? -1 : 1;
    const baseRight = foe.kind === "penguin";
    spr.setFlipX(baseRight ? foe.facing < 0 : foe.facing > 0);
    body.setVelocity(Math.sign(dx) * 78, Math.sign(dy) * 40);
    if (spr.y < WALK_TOP) spr.y = WALK_TOP;
    if (spr.y > WALK_BOT) spr.y = WALK_BOT;

    if (Math.abs(dx) < 28 && Math.abs(dy) < 14) {
      foe.state = "attack";
      foe.stateT = 0;
      if (foe.kind === "clemens") spr.play("clemens-attack");
    } else if (foe.throwCd <= 0 && Math.abs(dx) > 40) {
      this.foeThrow(foe, target);
    } else if (foe.kind === "clemens") {
      spr.play("clemens-walk", true);
    }
  }

  beginStomp(foe: Foe) {
    const spr = foe.sprite;
    const house = foe.house;
    foe.state = "stomp";
    foe.stateT = 0;
    if (foe.kind === "clemens") {
      spr.play("clemens-stomp");
      if (house?.bag) house.bag.setVisible(false);
    } else {
      this.tweens.add({ targets: spr, y: spr.y - 16, duration: 140, yoyo: true, repeat: 1 });
    }
    sfx.stomp();
  }

  squashBag(foe: Foe) {
    const bag = foe.house?.bag;
    if (!bag || !bag.visible) return;
    this.tweens.add({
      targets: bag,
      scaleY: 0.22,
      y: bag.y + 10,
      duration: 160,
    });
  }

  stompBag(foe: Foe) {
    const house = foe.house;
    if (!house?.bag) return;
    this.burst(house.bag.x, house.bag.y - 8);
    house.bag.destroy();
    house.bag = null;
    foe.yelled = true;
    if (foe.kind === "clemens") foe.hot = true;
    sfx.yell();
    this.say(foe, foe.kind === "clemens" ? "YOU'RE ALL GONNA DIE!" : (QUOTES[foe.kind]?.[0] ?? "ARGH!"));
    this.addScore(150);
    this.pop(foe.sprite.x, foe.sprite.y - 36, foe.kind === "clemens" ? "MY BOOT!!" : "STOMPED", "#ff6a00");
    this.trauma = 1;
    this.cameras.main.shake(220, 0.012);
  }

  foeStrike(foe: Foe) {
    for (const f of this.fighters) {
      if (f.state === "dead") continue;
      if (Math.abs(f.sprite.x - (foe.sprite.x + foe.facing * 14)) < 24 && Math.abs(f.sprite.y - foe.sprite.y) < 16) {
        this.hurtFighter(f, 1, foe.facing);
      }
    }
  }

  foeThrow(foe: Foe, target: Fighter) {
    foe.throwCd = foe.kind === "clemens" ? (foe.hot ? 0.9 : 1.4) : foe.kind === "veronica" ? 1.1 : 1.8;
    const tex = foe.kind === "veronica" ? "impact" : "boot";
    const spr = this.physics.add.sprite(foe.sprite.x, foe.sprite.y - 28, tex, 0);
    const hot = foe.kind === "clemens" && foe.hot;
    spr.setDisplaySize(hot ? 26 : 20, hot ? 26 : 20);
    if (hot) spr.setTint(0xff6a00);
    if (tex === "boot") spr.play("boot-spin");
    const dir = Math.sign(target.sprite.x - foe.sprite.x) || -1;
    this.shots.push({ sprite: spr, vx: dir * (hot ? 170 : 140), vy: -20, life: 2.2, dmg: hot ? 2 : 1 });
    if (foe.kind === "clemens") this.say(foe, hot ? "YOU'RE ALL GONNA DIE!" : "MY BOOT!!");
    if (foe.kind === "veronica") this.say(foe, QUOTES.veronica[1] ?? "DISGRACE!");
    sfx.punch();
  }

  stepShots(dt: number) {
    for (const sh of this.shots) {
      sh.life -= dt;
      sh.sprite.x += sh.vx * dt;
      sh.sprite.y += sh.vy * dt;
      sh.vy += 80 * dt;
      for (const f of this.fighters) {
        if (f.state === "dead" || f.invuln > 0) continue;
        if (Math.abs(f.sprite.x - sh.sprite.x) < 18 && Math.abs(f.sprite.y - 18 - sh.sprite.y) < 22) {
          this.hurtFighter(f, sh.dmg, Math.sign(sh.vx) as 1 | -1);
          sh.life = 0;
          this.burst(sh.sprite.x, sh.sprite.y);
        }
      }
    }
    this.shots = this.shots.filter((s) => {
      if (s.life <= 0 || s.sprite.y > H + 20) {
        s.sprite.destroy();
        return false;
      }
      return true;
    });
  }

  stepHouses(dt: number) {
    for (const h of this.houses) {
      if (h.state === "lit") h.litT += dt;
      if (h.state === "chaos") {
        const alive = this.foes.some((e) => e.house === h && e.state !== "dead");
        if (!alive) {
          h.state = "cleared";
          h.ringHint.setVisible(false);
          this.addScore(400);
          this.banner(h.title, "HOUSE CLEARED");
          sfx.win();
        }
      }
    }
  }

  hurtFoe(foe: Foe, dmg: number, dir: 1 | -1) {
    if (foe.spawnT < 1.2) return;
    foe.hp -= dmg;
    foe.state = "hurt";
    foe.stateT = 0;
    (foe.sprite.body as Phaser.Physics.Arcade.Body).setVelocity(dir * 120, 0);
    foe.sprite.setTint(0xffffff);
    this.time.delayedCall(80, () => foe.sprite.clearTint());
    this.hitstop = 0.05;
    this.trauma = Math.min(1, this.trauma + 0.2);
    sfx.hit();
    this.burst(foe.sprite.x, foe.sprite.y - 16);
    if (foe.hp <= 0) {
      foe.state = "dead";
      foe.stateT = 0;
      this.addScore(200);
      this.pop(foe.sprite.x, foe.sprite.y - 36, "KO", "#ff6a00");
    }
  }

  hurtFighter(f: Fighter, dmg: number, dir: 1 | -1) {
    if (f.invuln > 0 || f.state === "dead") return;
    f.hp -= dmg;
    f.invuln = 0.8;
    this.setState(f, "hurt");
    (f.sprite.body as Phaser.Physics.Arcade.Body).setVelocity(dir * 140, 0);
    f.sprite.setTint(0xff6666);
    this.time.delayedCall(120, () => f.sprite.clearTint());
    this.combo = 0;
    sfx.hurt();
    this.cameras.main.shake(120, 0.008);
    if (f.hp <= 0) {
      f.lives -= 1;
      f.hp = 0;
      this.setState(f, "dead");
      this.pop(f.sprite.x, f.sprite.y - 28, "DOWN", "#e23b3b");
    }
  }

  respawn(f: Fighter) {
    f.hp = f.maxHp;
    f.invuln = 1.5;
    f.holding = false;
    const cam = this.cameras.main.worldView;
    f.sprite.x = cam.x + 48;
    f.sprite.y = f.laneY;
    f.sprite.setAlpha(1);
    this.setState(f, "idle");
  }

  addScore(n: number) {
    const m = 1 + Math.min(8, this.combo) * 0.25;
    this.score += Math.round(n * m);
    this.combo += 1;
    this.comboT = 2.4;
  }

  pop(x: number, y: number, msg: string, color: string) {
    const t = this.add.text(x, y, msg, { fontFamily: FONT, fontSize: "7px", color }).setOrigin(0.5).setDepth(80);
    this.tweens.add({
      targets: t,
      y: y - 22,
      alpha: 0,
      duration: 700,
      ease: "Cubic.easeOut",
      onComplete: () => t.destroy(),
    });
  }

  say(foe: Foe, line: string) {
    const t = this.add
      .text(foe.sprite.x, foe.sprite.y - 48, line, {
        fontFamily: FONT,
        fontSize: "5px",
        color: "#fff3c4",
        backgroundColor: "#1a1020",
        padding: { x: 4, y: 3 },
      })
      .setOrigin(0.5)
      .setDepth(90);
    this.tweens.add({
      targets: t,
      y: t.y - 8,
      duration: 1800,
      onComplete: () => t.destroy(),
    });
  }

  burst(x: number, y: number) {
    const s = this.add.sprite(x, y, "impact", 0).setDisplaySize(32, 32).setDepth(70);
    s.play("impact");
    s.on("animationcomplete", () => s.destroy());
  }

  nearestHouse(x: number) {
    let best: House | null = null;
    let d = 9999;
    for (const h of this.houses) {
      const dd = Math.abs(h.x - x);
      if (dd < d) {
        d = dd;
        best = h;
      }
    }
    return best;
  }

  currentHouse() {
    return this.houses.find((h) => h.state !== "cleared") ?? null;
  }

  designatedFiller(house: House): Fighter | null {
    const living = this.fighters.filter((x) => x.state !== "dead");
    if (!living.length) return null;
    return living[house.i % living.length] ?? living[0]!;
  }

  interactHouse(x: number) {
    const cur = this.currentHouse();
    if (cur) {
      const near =
        Math.abs(x - cur.bushX) < 70 ||
        Math.abs(x - cur.porchX) < 70 ||
        Math.abs(x - cur.doorX) < 80 ||
        (cur.bag && Math.abs(x - cur.bag.x) < 70);
      if (near) return cur;
    }
    return this.nearestHouse(x);
  }

  closestLiving(x: number) {
    let best: Fighter | null = null;
    let d = 9999;
    for (const f of this.fighters) {
      if (f.state === "dead") continue;
      const dd = Math.abs(f.sprite.x - x);
      if (dd < d) {
        d = dd;
        best = f;
      }
    }
    return best;
  }

  depthSort() {
    for (const f of this.fighters) f.sprite.setDepth(f.sprite.y);
    for (const e of this.foes) e.sprite.setDepth(e.sprite.y);
  }

  advanceGate() {
    const uncleared = this.houses.find((h) => h.state !== "cleared");
    if (!uncleared) this.gateX = WORLD_W - 20;
    else this.gateX = Math.max(uncleared.doorX + 90, uncleared.bushX + 80, (uncleared.i + 1) * TILE + 40);
    const humans = this.fighters.filter((f) => f.human && f.state !== "dead");
    const follow = humans[0] ?? this.fighters.find((f) => f.state !== "dead");
    if (follow && follow !== this.lead) {
      this.lead = follow;
      this.cameras.main.startFollow(follow.sprite, true, 0.12, 0.08);
    }
  }

  maybePenguin() {
    if (this.penguinSpawned) return;
    if (this.houses[1] && this.houses[1].state === "cleared") {
      this.penguinSpawned = true;
      const spr = this.physics.add.sprite(this.cameras.main.worldView.x - 40, 230, "penguin", 0);
      spr.setDisplaySize(128, 140);
      spr.setOrigin(0.5, 1);
      spr.play("penguin-walk");
      this.foes.push({
        kind: "penguin",
        sprite: spr,
        hp: 8,
        maxHp: 8,
        facing: 1,
        state: "walk",
        stateT: 0,
        throwCd: 9,
        house: null,
        yelled: true,
        spawnT: 0,
        hot: false,
      });
      this.banner("GIANT PENGUIN", "DON'T LET IT WADDLE YOU");
      this.say(this.foes[this.foes.length - 1]!, "HONK HONK!");
    }
  }

  checkEnd() {
    const humansDead = this.fighters.filter((f) => f.human).every((f) => f.state === "dead" && f.lives <= 0);
    if (humansDead && !this.over) {
      this.over = true;
      this.continueT = 0;
      this.showContinue();
    }
    if (this.houses.every((h) => h.state === "cleared") && !this.over && !this.staging) {
      if (this.stage < STAGES.length - 1) this.advanceStage();
      else {
        this.over = true;
        this.won = true;
        this.showWin();
      }
    }
  }

  advanceStage() {
    this.staging = true;
    const next = this.stage + 1;
    const name = STAGES[next]?.name ?? "NEXT";
    this.banner("STAGE CLEAR", name);
    sfx.win();
    const roster: RosterSlot[] = this.fighters.map((f) => ({ id: f.id, human: f.human, peerId: f.peerId }));
    const carry = this.fighters.map((f) => ({ hp: Math.max(1, f.hp), lives: Math.max(1, f.lives) }));
    this.time.delayedCall(2200, () => {
      if (net.role === "host") {
        net.stage = next;
        net.scoreCarry = this.score;
        net.send({ t: "stage", stage: next, score: this.score, roster });
      }
      this.scene.start("play", { roster, stage: next, score: this.score, carry });
    });
  }

  objective() {
    const house = this.houses.find((h) => h.state !== "cleared") ?? this.houses[this.houses.length - 1]!;
    const f = this.lead;
    if (!house) return { text: "", mx: f.sprite.x, my: f.sprite.y - 50, label: "ACTION" };
    if (house.state === "chaos") return { text: "PUNCH  ·  DON'T GET THE BOOT", mx: house.doorX, my: GROUND_Y - 90, label: "PUNCH" };
    if (house.state === "rung") return { text: "RUN!!!", mx: house.doorX - 80, my: GROUND_Y - 80, label: "ACTION" };
    if (house.state === "lit") {
      const close = Math.abs(f.sprite.x - house.doorX) < 48;
      return {
        text: close ? "PRESS ACTION  ·  RING THE BELL" : "WALK TO THE GLOWING DOORBELL  ·  THEN ACTION",
        mx: house.doorX,
        my: house.bellY - 22,
        label: close ? "RING" : "ACTION",
      };
    }
    if (house.state === "bagged") return { text: "ACTION ON THE BAG  ·  LIGHT IT", mx: house.porchX, my: GROUND_Y - 44, label: "LIGHT" };
    if (f.holding) return { text: "WALK TO THE PORCH  ·  ACTION TO DROP", mx: house.porchX, my: GROUND_Y - 36, label: "DROP" };
    if (house.state === "ready" || house.state === "filling") {
      const close = Math.abs(f.sprite.x - house.bushX) < 52;
      return {
        text: close ? "PRESS ACTION  ·  SQUAT & FILL" : "GO TO THE BUSH  ·  PRESS ACTION",
        mx: house.bushX,
        my: GROUND_Y - 58,
        label: close ? "FILL" : "ACTION",
      };
    }
    return { text: "NEXT HOUSE  →", mx: house.x, my: GROUND_Y - 80, label: "ACTION" };
  }

  present() {
    this.hudScore.setText(`SCORE ${String(this.score).padStart(6, "0")}`);
    this.hudCombo.setText(this.combo > 1 ? `COMBO x${this.combo}` : "");
    this.fighters.forEach((f, i) => {
      const bar = this.hpBars[i];
      if (bar) bar.width = Math.max(0, 72 * (f.hp / f.maxHp));
    });
    const obj = this.objective();
    this.hudHint.setText(obj.text);
    this.marker.setPosition(obj.mx, obj.my + Math.sin(this.time.now / 180) * 3);
    this.marker.setVisible(!this.howto);
    bridge.setActionLabel(obj.label);
    if (this.trauma > 0.02 && loadSave().settings.shake) {
      const mag = this.trauma * this.trauma * 3;
      this.cameras.main.setScroll(
        this.cameras.main.scrollX + (Math.random() - 0.5) * mag,
        this.cameras.main.scrollY + (Math.random() - 0.5) * mag,
      );
    }
  }

  flushSnap(dt: number) {
    this.snapAcc += dt;
    if (this.snapAcc < 0.05) return;
    this.snapAcc = 0;
    net.sendSnap({
      t: "snap",
      score: this.score,
      combo: this.combo,
      fighters: this.fighters.map((f) => ({
        slot: f.slot,
        x: f.sprite.x,
        y: f.sprite.y,
        facing: f.facing,
        state: f.state,
        hp: f.hp,
        lives: f.lives,
        holding: f.holding,
        fillT: f.fillT,
      })),
      houses: this.houses.map((h) => ({ i: h.i, state: h.state })),
      foes: this.foes.map((e) => ({
        kind: e.kind,
        x: e.sprite.x,
        y: e.sprite.y,
        facing: e.facing,
        state: e.state,
        hp: e.hp,
      })),
    });
  }

  flushInput(dt: number) {
    this.inputAcc += dt;
    if (this.inputAcc < 0.05) return;
    this.inputAcc = 0;
    const a = actions[0]!;
    net.sendInput({
      mx: a.moveX,
      my: a.moveY,
      punch: a.punch,
      special: a.special,
      action: a.action,
      punchP: a.punchPressed,
      specialP: a.specialPressed,
      actionP: a.actionPressed,
    });
  }

  stepClient(dt: number) {
    if (this.over) {
      this.continueT += dt;
      return;
    }
    if (this.howto) {
      this.howtoT -= dt;
      if (this.howtoT <= 0 || actions[0]!.actionPressed || actions[0]!.punchPressed) {
        this.howto.destroy();
        this.howto = undefined;
      }
    }
    const me = this.fighters.find((f) => f.peerId === net.selfId) ?? this.fighters[net.mySlot] ?? this.lead;
    this.stepFighter(me, dt);
    this.flushInput(dt);
    this.applySnap(dt);
    this.depthSort();
  }

  applySnap(dt: number) {
    const snap = net.lastSnap;
    if (!snap) return;
    this.score = snap.score;
    this.combo = snap.combo;
    for (const s of snap.fighters) {
      const f = this.fighters[s.slot];
      if (!f) continue;
      f.hp = s.hp;
      f.lives = s.lives;
      f.holding = s.holding;
      f.facing = s.facing;
      f.sprite.setFlipX(s.facing < 0);
      const mine = f.peerId === net.selfId || f.slot === net.mySlot;
      if (mine) {
        const dist = Math.hypot(f.sprite.x - s.x, f.sprite.y - s.y);
        if (dist > 28) {
          f.sprite.x = s.x;
          f.sprite.y = s.y;
        }
        if (s.state === "fill" && f.state !== "fill") this.setState(f, "fill");
        continue;
      }
      f.tx = s.x;
      f.ty = s.y;
      f.sprite.x += (s.x - f.sprite.x) * Math.min(1, dt * 14);
      f.sprite.y += (s.y - f.sprite.y) * Math.min(1, dt * 14);
      if (f.state !== s.state) this.setState(f, s.state as Fighter["state"]);
    }
    for (const hs of snap.houses) {
      const house = this.houses[hs.i];
      if (house) this.mirrorHouse(house, hs);
    }
    this.mirrorFoes(snap.foes);
  }

  mirrorHouse(house: House, hs: HouseSnap) {
    if (house.state === hs.state) return;
    house.state = hs.state as House["state"];
    if (hs.state === "bagged" && !house.bag) {
      const bag = this.add.sprite(house.porchX, GROUND_Y - 2, "bag", 0).setOrigin(0.5, 1).setDisplaySize(40, 48).setDepth(7);
      bag.play("bag-idle");
      house.bag = bag;
    }
    if (hs.state === "lit" && house.bag) {
      house.bag.play("bag-fire");
      house.bell.play("bell-glow");
      house.ringHint.setText("RING!").setVisible(true);
    }
    if (hs.state === "rung" || hs.state === "chaos") {
      house.ringHint.setVisible(false);
      house.bell.play("bell-idle");
    }
    if (hs.state === "cleared" || hs.state === "ready") {
      house.ringHint.setVisible(false);
      if (house.bag && hs.state === "ready") {
        house.bag.destroy();
        house.bag = null;
      }
    }
  }

  mirrorFoes(snaps: FoeSnap[]) {
    while (this.foes.length > snaps.length) {
      const extra = this.foes.pop();
      extra?.sprite.destroy();
    }
    for (let i = 0; i < snaps.length; i++) {
      const s = snaps[i]!;
      let foe = this.foes[i];
      if (!foe) {
        foe = this.spawnFoeVisual(s);
        this.foes.push(foe);
      }
      foe.sprite.x += (s.x - foe.sprite.x) * 0.45;
      foe.sprite.y += (s.y - foe.sprite.y) * 0.45;
      foe.facing = s.facing;
      foe.hp = s.hp;
      foe.state = s.state as Foe["state"];
      const baseRight = foe.kind === "penguin";
      foe.sprite.setFlipX(baseRight ? s.facing < 0 : s.facing > 0);
      if (foe.kind === "clemens") {
        if (s.state === "stomp") foe.sprite.play("clemens-stomp", true);
        else if (s.state === "attack") foe.sprite.play("clemens-attack", true);
        else foe.sprite.play("clemens-walk", true);
      }
    }
  }

  spawnFoeVisual(s: FoeSnap): Foe {
    const kind = s.kind as Foe["kind"];
    const tex =
      kind === "clemens" ? "clemens-idle" : kind === "veronica" ? "veronica" : kind === "danny" ? "danny" : kind === "penguin" ? "penguin" : "neighbor";
    const size = kind === "clemens" ? BOSS_DISPLAY : kind === "penguin" ? 128 : 110;
    const spr = this.physics.add.sprite(s.x, s.y, tex, 0);
    spr.setDisplaySize(size, kind === "penguin" ? 140 : size);
    spr.setOrigin(0.5, 1);
    const anim =
      kind === "clemens" ? "clemens-idle" : kind === "neighbor" ? "neighbor-walk" : kind === "penguin" ? "penguin-walk" : `${kind}-idle`;
    spr.play(anim);
    return {
      kind,
      sprite: spr,
      hp: s.hp,
      maxHp: s.hp,
      facing: s.facing,
      state: s.state as Foe["state"],
      stateT: 0,
      throwCd: 9,
      house: null,
      yelled: true,
      spawnT: 2,
      hot: false,
    };
  }

  takeover(peerId: string) {
    const f = this.fighters.find((x) => !x.peerId && x.state !== "dead") ?? this.fighters.find((x) => !x.human);
    if (!f) {
      net.sendFull(peerId);
      return;
    }
    f.human = true;
    f.peerId = peerId;
    const roster: RosterSlot[] = this.fighters.map((x) => ({ id: x.id, human: x.human, peerId: x.peerId }));
    net.sendDropin(peerId, f.slot, f.id, roster, this.stage, this.score);
    this.banner("PLAYER IN", CHARACTERS[f.id].name);
    this.pop(f.sprite.x, f.sprite.y - 48, "DROPPED IN!", "#3ec6ff");
    sfx.coin();
  }

  release(peerId: string) {
    const f = this.fighters.find((x) => x.peerId === peerId);
    if (!f) return;
    f.peerId = null;
    f.human = false;
    this.banner("PLAYER OUT", CHARACTERS[f.id].name);
  }

  drawPause() {
    if (this.overlay) return;
    this.overlay = this.add.container(W / 2, H / 2).setScrollFactor(0).setDepth(3000);
    this.overlay.add(this.add.rectangle(0, 0, W, H, 0x070b14, 0.7));
    this.overlay.add(this.add.text(0, -10, "PAUSED", { fontFamily: FONT, fontSize: "12px", color: "#ff6a00" }).setOrigin(0.5));
    this.overlay.add(this.add.text(0, 14, "START TO RESUME", { fontFamily: FONT, fontSize: "7px", color: "#f4e4c1" }).setOrigin(0.5));
  }

  showContinue() {
    stopMusic();
    sfx.lose();
    const c = this.add.container(W / 2, H / 2).setScrollFactor(0).setDepth(3000);
    c.add(this.add.rectangle(0, 0, W, H, 0x070b14, 0.82));
    c.add(this.add.text(0, -40, "GAME OVER", { fontFamily: FONT, fontSize: "14px", color: "#ff6a00" }).setOrigin(0.5));
    c.add(
      this.add
        .text(0, -12, `SCORE ${String(this.score).padStart(6, "0")}`, { fontFamily: FONT, fontSize: "8px", color: "#f4e4c1" })
        .setOrigin(0.5),
    );
    c.add(this.add.text(0, 20, "TAP / START  TO CONTINUE", { fontFamily: FONT, fontSize: "7px", color: "#3ec6ff" }).setOrigin(0.5));
    c.add(this.add.text(0, 44, "INSERT COIN", { fontFamily: FONT, fontSize: "8px", color: "#8b7d6a" }).setOrigin(0.5));
    submitScore(this.score, loadSave().initials);
    this.input.once("pointerdown", () => this.scene.start("attract"));
    this.input.keyboard?.once("keydown-ENTER", () => this.scene.start("attract"));
  }

  showWin() {
    sfx.win();
    const c = this.add.container(W / 2, H / 2).setScrollFactor(0).setDepth(3000);
    c.add(this.add.rectangle(0, 0, W, H, 0x070b14, 0.78));
    c.add(this.add.text(0, -50, "YOU WIN", { fontFamily: FONT, fontSize: "14px", color: "#ff6a00" }).setOrigin(0.5));
    c.add(this.add.text(0, -24, "CLEMENS ATE THE BOOT", { fontFamily: FONT, fontSize: "7px", color: "#f4e4c1" }).setOrigin(0.5));
    c.add(
      this.add
        .text(0, 4, `SCORE ${String(this.score).padStart(6, "0")}`, { fontFamily: FONT, fontSize: "10px", color: "#3ec6ff" })
        .setOrigin(0.5),
    );
    c.add(this.add.text(0, 32, "YOU'RE ALL GONNA... WIN!", { fontFamily: FONT, fontSize: "6px", color: "#8b7d6a" }).setOrigin(0.5));
    c.add(this.add.text(0, 56, "TAP TO RETURN", { fontFamily: FONT, fontSize: "7px", color: "#f4e4c1" }).setOrigin(0.5));
    submitScore(this.score, loadSave().initials);
    this.input.once("pointerdown", () => this.scene.start("attract"));
    this.input.keyboard?.once("keydown-ENTER", () => this.scene.start("attract"));
  }
}
