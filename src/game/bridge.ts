export type GameSceneName = "boot" | "preload" | "attract" | "select" | "play" | "howto";
export type BridgePanel = "none" | "join";

type Listener = () => void;
const listeners = new Set<Listener>();

export const bridge = {
  scene: "boot" as GameSceneName,
  showTouch: false,
  paused: false,
  actionLabel: "ACTION",
  panel: "none" as BridgePanel,
  setScene(s: GameSceneName) {
    this.scene = s;
    this.showTouch = s === "play";
    listeners.forEach((l) => l());
  },
  setActionLabel(label: string) {
    if (this.actionLabel === label) return;
    this.actionLabel = label;
    listeners.forEach((l) => l());
  },
  setPanel(p: BridgePanel) {
    if (this.panel === p) return;
    this.panel = p;
    listeners.forEach((l) => l());
  },
  subscribe(fn: Listener) {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
};
