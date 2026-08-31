import * as Phaser from "phaser";
import { H, W } from "./config";
import { BootScene, PreloadScene, AttractScene, SelectScene } from "./scenes/menu";
import { PlayScene } from "./scenes/PlayScene";

export function createGame(parent: HTMLElement) {
  return new Phaser.Game({
    type: Phaser.CANVAS,
    parent,
    width: W,
    height: H,
    backgroundColor: "#070b14",
    pixelArt: true,
    roundPixels: true,
    antialias: false,
    render: {
      pixelArt: true,
      antialias: false,
      roundPixels: true,
      preserveDrawingBuffer: true,
    },
    audio: { noAudio: false },
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: W,
      height: H,
    },
    physics: {
      default: "arcade",
      arcade: { gravity: { x: 0, y: 0 }, debug: false },
    },
    input: { keyboard: true, gamepad: true },
    scene: [BootScene, PreloadScene, AttractScene, SelectScene, PlayScene],
    callbacks: {
      postBoot: (game) => {
        game.canvas.setAttribute("aria-label", "It's Poop Again arcade game");
        (window as unknown as { __game?: Phaser.Game }).__game = game;
      },
    },
  });
}
