import { useEffect, useRef, useState, type PointerEvent as PE } from "react";
import { bridge } from "./bridge";
import { touch } from "./input";
import { setMute, unlockAudio } from "./audio";
import { loadSave, writeSave } from "./save";
import { net } from "./net";

export function GameShell() {
  const parent = useRef<HTMLDivElement>(null);
  const autoJoin = useRef(false);
  const [touchUi, setTouchUi] = useState(false);
  const [muted, setMuted] = useState(() => loadSave().settings.mute);
  const [scene, setScene] = useState(bridge.scene);
  const [actionLabel, setActionLabel] = useState(bridge.actionLabel);
  const [panel, setPanel] = useState(bridge.panel);
  const [netTick, setNetTick] = useState(0);
  const [copied, setCopied] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [joinBusy, setJoinBusy] = useState(false);

  useEffect(() => {
    const off = bridge.subscribe(() => {
      setTouchUi(bridge.showTouch);
      setScene(bridge.scene);
      setActionLabel(bridge.actionLabel);
      setPanel(bridge.panel);
    });
    return off;
  }, []);

  useEffect(() => {
    const off = net.subscribe(() => setNetTick((n) => n + 1));
    return () => {
      off();
    };
  }, []);

  useEffect(() => {
    const el = parent.current;
    if (!el) return;
    let game: { destroy: (b: boolean) => void } | undefined;
    let dead = false;
    void import("./createGame").then((m) => {
      if (dead || !parent.current) return;
      game = m.createGame(parent.current);
    });
    return () => {
      dead = true;
      game?.destroy(true);
    };
  }, []);

  useEffect(() => {
    if (scene !== "attract" || autoJoin.current) return;
    const crew = new URLSearchParams(window.location.search).get("crew");
    if (crew && net.role === "offline") {
      autoJoin.current = true;
      void net.join(crew).catch(() => {});
    }
  }, [scene]);

  function toggleMute() {
    const next = !muted;
    setMuted(next);
    unlockAudio();
    setMute(next);
    const s = loadSave();
    s.settings.mute = next;
    writeSave(s);
  }

  async function submitJoin() {
    setJoinBusy(true);
    try {
      await net.join(joinCode);
      bridge.setPanel("none");
    } catch {
      /* net.error is shown */
    } finally {
      setJoinBusy(false);
    }
  }

  async function copyCrew() {
    const url = net.shareUrl();
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      try {
        await navigator.clipboard.writeText(net.code);
      } catch {
        /* ignore */
      }
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }

  void netTick;

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-bg text-fg">
      <div ref={parent} id="game-root" className="absolute inset-0 touch-none" />
      <div
        className="pointer-events-none absolute inset-0 opacity-40 mix-blend-overlay"
        style={{
          backgroundImage:
            "repeating-linear-gradient(to bottom, rgb(0 0 0 / 0.18) 0, rgb(0 0 0 / 0.18) 1px, transparent 1px, transparent 3px)",
        }}
      />
      <h1 className="sr-only">IT'S POOP AGAIN</h1>
      {net.role !== "offline" && net.code ? (
        <button
          type="button"
          onClick={() => void copyCrew()}
          className="absolute left-3 top-3 z-20 rounded-sm border border-accent bg-surface/90 px-3 py-2 text-left font-arcade text-[8px] leading-relaxed text-accent"
        >
          CREW {net.code}
          <span className="mt-1 block text-[7px] text-muted">
            {copied ? "COPIED!" : net.status || "TAP TO COPY"}
          </span>
        </button>
      ) : null}
      <button
        type="button"
        onClick={toggleMute}
        className="absolute right-3 top-3 z-20 rounded-sm border border-border bg-surface/80 px-3 py-2 font-arcade text-[8px] text-fg"
        aria-label={muted ? "Unmute" : "Mute"}
      >
        {muted ? "MUTED" : "BGM"}
      </button>
      {(scene === "boot" || scene === "preload") && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-bg">
          <p className="text-center font-arcade text-sm leading-relaxed text-primary">IT'S POOP AGAIN</p>
          <p className="font-arcade text-[8px] tracking-widest text-muted">A 90s ARCADE PRANK-EM-UP</p>
          <p className="mt-4 font-arcade text-[8px] text-fg">LOADING . . .</p>
        </div>
      )}
      {panel === "join" && scene === "attract" ? (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-bg/80 p-4">
          <form
            className="w-full max-w-sm rounded-sm border-2 border-primary bg-surface p-5 shadow-lg"
            onSubmit={(e) => {
              e.preventDefault();
              void submitJoin();
            }}
          >
            <p className="font-arcade text-[10px] text-primary">JOIN A CREW</p>
            <p className="mt-2 font-display text-lg text-muted">Type the 4-letter code from your friend.</p>
            <input
              autoFocus
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              maxLength={4}
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 4))}
              className="mt-4 w-full border border-border bg-bg px-3 py-3 font-arcade text-xl tracking-[0.4em] text-fg outline-none"
              placeholder="ABCD"
              aria-label="Crew code"
            />
            {net.error ? <p className="mt-2 font-arcade text-[8px] text-danger">{net.error}</p> : null}
            <div className="mt-4 flex gap-2">
              <button
                type="submit"
                disabled={joinCode.length !== 4 || joinBusy}
                className="flex-1 rounded-sm border border-primary bg-primary px-3 py-3 font-arcade text-[8px] text-bg disabled:opacity-50"
              >
                {joinBusy ? "LINKING" : "JOIN"}
              </button>
              <button
                type="button"
                onClick={() => bridge.setPanel("none")}
                className="rounded-sm border border-border bg-bg px-3 py-3 font-arcade text-[8px] text-fg"
              >
                BACK
              </button>
            </div>
          </form>
        </div>
      ) : null}
      {touchUi ? <TouchPad actionLabel={actionLabel} /> : null}
    </div>
  );
}

function TouchPad({ actionLabel }: { actionLabel: string }) {
  const stick = useRef<HTMLDivElement>(null);
  const knob = useRef<HTMLDivElement>(null);
  const pid = useRef<number | null>(null);

  function onStickDown(e: PE<HTMLDivElement>) {
    pid.current = e.pointerId;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    moveStick(e);
  }
  function moveStick(e: PE<HTMLDivElement>) {
    if (pid.current !== e.pointerId || !stick.current || !knob.current) return;
    const r = stick.current.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    let dx = (e.clientX - cx) / (r.width / 2);
    let dy = (e.clientY - cy) / (r.height / 2);
    const m = Math.hypot(dx, dy);
    if (m > 1) {
      dx /= m;
      dy /= m;
    }
    touch.moveX = dx;
    touch.moveY = dy;
    knob.current.style.transform = `translate(${dx * 22}px, ${dy * 22}px)`;
  }
  function onStickUp(e: PE<HTMLDivElement>) {
    if (pid.current !== e.pointerId) return;
    pid.current = null;
    touch.moveX = 0;
    touch.moveY = 0;
    if (knob.current) knob.current.style.transform = "translate(0,0)";
  }

  const hot = actionLabel !== "ACTION" && actionLabel !== "PUNCH";

  return (
    <div className="pointer-events-none absolute inset-0 z-10">
      <div
        ref={stick}
        className="pointer-events-auto absolute bottom-6 left-4 size-[118px] rounded-full border-2 border-fg/30 bg-surface/50"
        onPointerDown={onStickDown}
        onPointerMove={moveStick}
        onPointerUp={onStickUp}
        onPointerCancel={onStickUp}
      >
        <div
          ref={knob}
          className="absolute left-1/2 top-1/2 size-12 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/80"
        />
      </div>
      <div className="pointer-events-auto absolute bottom-6 right-3 flex flex-col items-end gap-2">
        <div className="flex gap-2">
          <PadBtn label="SPECIAL" onHold={(v) => (touch.special = v)} />
          <PadBtn label="PUNCH" accent onHold={(v) => (touch.punch = v)} />
        </div>
        <PadBtn label={actionLabel} wide hot={hot} onHold={(v) => (touch.action = v)} />
      </div>
    </div>
  );
}

function PadBtn({
  label,
  onHold,
  accent,
  wide,
  hot,
}: {
  label: string;
  onHold: (v: boolean) => void;
  accent?: boolean;
  wide?: boolean;
  hot?: boolean;
}) {
  return (
    <button
      type="button"
      className={
        "rounded-full border-2 font-arcade text-[8px] text-fg active:scale-95 " +
        (wide ? "h-14 w-36 " : "size-16 ") +
        (hot ? "border-primary bg-primary/90 " : accent ? "border-fg/40 bg-primary/85 " : "border-fg/40 bg-surface/75")
      }
      onPointerDown={(e) => {
        e.preventDefault();
        onHold(true);
      }}
      onPointerUp={() => onHold(false)}
      onPointerCancel={() => onHold(false)}
      onContextMenu={(e) => e.preventDefault()}
    >
      {label}
    </button>
  );
}
