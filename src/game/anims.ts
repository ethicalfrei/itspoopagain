import * as Phaser from "phaser";

export function makeAnims(scene: Phaser.Scene) {
  const mk = (key: string, tex: string, rate: number, repeat: number, start = 0, end = 3) => {
    if (scene.anims.exists(key)) return;
    scene.anims.create({
      key,
      frames: scene.anims.generateFrameNumbers(tex, { start, end }),
      frameRate: rate,
      repeat,
    });
  };
  mk("billy-idle", "billy-idle", 6, -1);
  mk("billy-walk", "billy-walk", 10, -1);
  mk("billy-attack", "billy-attack", 14, 0);
  mk("frank-idle", "frank-idle", 5, -1);
  mk("frank-walk", "frank-walk", 9, -1);
  mk("frank-attack", "frank-attack", 14, 0);
  mk("jack-idle", "jack-idle", 3, -1);
  mk("jack-walk", "jack-walk", 6, -1, 2, 3);
  mk("jack-attack", "jack-attack", 12, 0);
  mk("billy-poop", "billy-poop", 7, -1);
  mk("frank-poop", "frank-poop", 7, -1);
  mk("jack-poop", "jack-poop", 6, -1);
  mk("clemens-idle", "clemens-idle", 5, -1);
  mk("clemens-walk", "clemens-walk", 8, -1);
  mk("clemens-attack", "clemens-attack", 10, 0);
  mk("clemens-stomp", "clemens-stomp", 7, 0);
  mk("veronica-idle", "veronica", 6, -1);
  mk("danny-idle", "danny", 6, -1);
  mk("penguin-walk", "penguin", 8, -1);
  mk("neighbor-walk", "neighbor", 8, -1);
  mk("bush-idle", "bush", 4, -1, 0, 0);
  mk("bush-shake", "bush", 10, 0);
  mk("bag-idle", "bag", 4, -1, 0, 1);
  mk("bag-fire", "bag", 8, -1, 2, 3);
  mk("bell-idle", "doorbell", 2, -1, 0, 0);
  mk("bell-glow", "doorbell", 8, -1, 1, 3);
  mk("boot-spin", "boot", 12, -1);
  mk("impact", "impact", 16, 0);
}
