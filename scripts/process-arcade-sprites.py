#!/usr/bin/env python3
"""Strengthen magenta, run generate2dsprite, despill, copy into public/game."""
from __future__ import annotations

import shutil
import subprocess
import sys
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path("/workspace")
PROC = ROOT / ".grok/skills/generate2dsprite/scripts/generate2dsprite.py"
PUB = ROOT / "public/game/sprites"
PORT = ROOT / "public/game/portraits"
MAP = ROOT / "public/game/map"
ASSETS = ROOT / "assets"

PUB.mkdir(parents=True, exist_ok=True)
PORT.mkdir(parents=True, exist_ok=True)
MAP.mkdir(parents=True, exist_ok=True)

JOBS = [
    # heroes
    ("billy", "idle", "player", "idle", "largest", "feet"),
    ("billy", "walk", "player", "walk", "largest", "feet"),
    ("billy", "attack", "player", "attack", "largest", "feet"),
    ("frank", "idle", "player", "idle", "largest", "feet"),
    ("frank", "walk", "player", "walk", "largest", "feet"),
    ("frank", "attack", "player", "attack", "largest", "feet"),
    ("jack", "idle", "player", "idle", "largest", "feet"),
    ("jack", "walk", "player", "walk", "largest", "feet"),
    ("jack", "attack", "player", "attack", "largest", "feet"),
    # enemies
    ("clemens", "idle", "npc", "idle", "largest", "feet"),
    ("clemens", "attack", "npc", "attack", "largest", "feet"),
    ("npc", "neighbor", "npc", "walk", "largest", "feet"),
    ("npc", "veronica", "npc", "idle", "largest", "feet"),
    ("npc", "danny", "npc", "idle", "largest", "feet"),
    ("npc", "penguin", "npc", "walk", "largest", "feet"),
    # props
    ("fx", "bag", "asset", "sheet", "all", "center"),
    ("fx", "doorbell", "asset", "sheet", "largest", "center"),
    ("fx", "bush", "asset", "sheet", "largest", "feet"),
    ("fx", "boot", "asset", "projectile", "largest", "center"),
    ("fx", "impact", "asset", "impact", "all", "center"),
]

RAW = {
    "billy/idle": "ceeca4b1-28be-4205-ba18-9183945bc08a.jpg",  # overwritten below
}


def strengthen_magenta(im: Image.Image) -> Image.Image:
    arr = np.array(im.convert("RGBA"))
    r = arr[:, :, 0].astype(np.int16)
    g = arr[:, :, 1].astype(np.int16)
    b = arr[:, :, 2].astype(np.int16)
    dist = np.abs(r - 255) + np.abs(g - 0) + np.abs(b - 255)
    mag = (dist < 90) | ((r > 190) & (b > 190) & (g < 130))
    arr[mag] = (255, 0, 255, 255)
    rgb = Image.fromarray(arr).convert("RGB")
    return rgb


def despill(path: Path) -> None:
    im = Image.open(path).convert("RGBA")
    arr = np.array(im)
    r = arr[:, :, 0].astype(np.int16)
    g = arr[:, :, 1].astype(np.int16)
    b = arr[:, :, 2].astype(np.int16)
    a = arr[:, :, 3]
    mag = (a > 0) & (r > 175) & (b > 175) & (g < 145)
    arr[mag, 3] = 0
    fringe = (arr[:, :, 3] > 0) & (r > 90) & (b > 90) & (g < r * 0.75) & ((r + b - 2 * g) > 70)
    arr[fringe, 0] = np.minimum(arr[fringe, 0], (g[fringe] + 18).clip(0, 255).astype(np.uint8))
    arr[fringe, 2] = np.minimum(arr[fringe, 2], (g[fringe] + 18).clip(0, 255).astype(np.uint8))
    Image.fromarray(arr).save(path)


def run_job(folder: str, name: str, target: str, mode: str, component: str, align: str, raw: Path) -> Path | None:
    out_dir = ASSETS / "sprites" / folder / name
    out_dir.mkdir(parents=True, exist_ok=True)
    raw_png = out_dir / "raw-sheet.png"
    strengthen_magenta(Image.open(raw)).save(raw_png)
    cmd = [
        sys.executable,
        str(PROC),
        "process",
        "--input",
        str(raw_png),
        "--target",
        target,
        "--mode",
        mode,
        "--output-dir",
        str(out_dir),
        "--rows",
        "2",
        "--cols",
        "2",
        "--cell-size",
        "128",
        "--fit-scale",
        "0.86",
        "--align",
        align,
        "--shared-scale",
        "--component-mode",
        component,
        "--threshold",
        "70",
        "--edge-threshold",
        "110",
        "--edge-clean-depth",
        "2",
        "--trim-border",
        "2",
    ]
    print("PROCESS", folder, name, flush=True)
    r = subprocess.run(cmd, cwd=ROOT, capture_output=True, text=True)
    if r.returncode != 0:
        print(r.stdout[-1500:])
        print(r.stderr[-1500:])
        return None
    sheet = out_dir / "sheet-transparent.png"
    if not sheet.exists():
        print(" missing sheet", out_dir)
        return None
    despill(sheet)
    return sheet


def portrait_from(sheet: Path, dest: Path) -> None:
    im = Image.open(sheet).convert("RGBA")
    cell = im.crop((0, 0, 128, 128))
    # head-ish: upper-middle of cell
    head = cell.crop((32, 8, 96, 72)).resize((48, 48), Image.Resampling.NEAREST)
    dest.parent.mkdir(parents=True, exist_ok=True)
    head.save(dest)


def stitch_street() -> None:
    plates = [
        ASSETS / "map/street-0-colonial.jpg",
        ASSETS / "map/street-1-ranch.jpg",
        ASSETS / "map/street-2-vaughn.jpg",
        ASSETS / "map/street-3-dumpster.jpg",
        ASSETS / "map/street-4-clemens.jpg",
    ]
    w, h = 480, 270
    out = Image.new("RGB", (w * len(plates), h))
    for i, p in enumerate(plates):
        im = Image.open(p).convert("RGB").resize((w, h), Image.Resampling.NEAREST)
        out.paste(im, (i * w, 0))
    dest = MAP / "street.png"
    out.save(dest)
    print("street", dest, out.size)

    sky = Image.open(ASSETS / "map/sky.jpg").convert("RGB").resize((960, 270), Image.Resampling.NEAREST)
    sky.save(MAP / "sky.png")
    far_src = ROOT / "artifacts/imagine_images/7ce7c209-ada7-466f-8208-6cb633954e53.jpg"
    if far_src.exists():
        far = Image.open(far_src).convert("RGB").resize((960, 270), Image.Resampling.NEAREST)
        far.save(MAP / "far.png")
    attract = Image.open(plates[0]).convert("RGB").resize((480, 270), Image.Resampling.NEAREST)
    attract.save(ROOT / "public/game/attract.jpg", quality=90)


def main() -> None:
    raws = {
        ("billy", "idle"): ASSETS / "sprites/billy/raw-idle.jpg",
        ("billy", "walk"): ROOT / "artifacts/imagine_images/ceeca4b1-28be-4205-ba18-9183945bc08a.jpg",
        ("billy", "attack"): ROOT / "artifacts/imagine_images/56516d2b-649c-4fb9-9712-6e247408a9ea.jpg",
        ("frank", "idle"): ASSETS / "sprites/frank/raw-idle.jpg",
        ("frank", "walk"): ROOT / "artifacts/imagine_images/cdbd144b-d777-4da7-9000-4848db62fbf5.jpg",
        ("frank", "attack"): ROOT / "artifacts/imagine_images/95e5cea8-0602-486a-93b6-5f8364436e08.jpg",
        ("jack", "idle"): ASSETS / "sprites/jack/raw-idle.jpg",
        ("jack", "walk"): ROOT / "artifacts/imagine_images/4edd5493-45df-4444-ac05-7addcaad8401.jpg",
        ("jack", "attack"): ROOT / "artifacts/imagine_images/7995a3e8-2475-45de-a1ef-046243edd2b0.jpg",
        ("clemens", "idle"): ROOT / "artifacts/imagine_images/ad74b90e-12c3-4cfb-9304-f7c684178bb3.jpg",
        ("clemens", "attack"): ROOT / "artifacts/imagine_images/fcb19729-d2fb-4f1d-b6e6-21960da56d83.jpg",
        ("npc", "neighbor"): ROOT / "artifacts/imagine_images/ee8a0bf9-15db-4486-a5bd-d391d06b811d.jpg",
        ("npc", "veronica"): ROOT / "artifacts/imagine_images/d3396c56-20a4-4128-98e0-c2c0014ab1d2.jpg",
        ("npc", "danny"): ROOT / "artifacts/imagine_images/aa164a81-e419-464f-8420-0f364a8a4e9f.jpg",
        ("npc", "penguin"): ROOT / "artifacts/imagine_images/4dfccf31-ae91-4969-8547-974c8118486d.jpg",
        ("fx", "bag"): ROOT / "artifacts/imagine_images/32057f32-bff5-4a93-883e-c6c386497ca8.jpg",
        ("fx", "doorbell"): ROOT / "artifacts/imagine_images/54814652-6d97-4844-92ec-eae5fa04a002.jpg",
        ("fx", "bush"): ROOT / "artifacts/imagine_images/2a0e3b8d-31df-463c-87a2-21540fa29903.jpg",
        ("fx", "boot"): ROOT / "artifacts/imagine_images/8add0d46-0079-4f84-9fb4-cc9daed4da5d.jpg",
        ("fx", "impact"): ROOT / "artifacts/imagine_images/5da7973b-7f62-4aee-9952-513cc786f063.jpg",
    }

    pub_name = {
        ("billy", "idle"): "billy-idle.png",
        ("billy", "walk"): "billy-walk.png",
        ("billy", "attack"): "billy-attack.png",
        ("frank", "idle"): "frank-idle.png",
        ("frank", "walk"): "frank-walk.png",
        ("frank", "attack"): "frank-attack.png",
        ("jack", "idle"): "jack-idle.png",
        ("jack", "walk"): "jack-walk.png",
        ("jack", "attack"): "jack-attack.png",
        ("clemens", "idle"): "clemens-idle.png",
        ("clemens", "attack"): "clemens-attack.png",
        ("npc", "neighbor"): "neighbor.png",
        ("npc", "veronica"): "veronica.png",
        ("npc", "danny"): "danny.png",
        ("npc", "penguin"): "penguin.png",
        ("fx", "bag"): "bag.png",
        ("fx", "doorbell"): "doorbell.png",
        ("fx", "bush"): "bush.png",
        ("fx", "boot"): "boot.png",
        ("fx", "impact"): "impact.png",
    }

    failed = []
    for folder, name, target, mode, component, align in JOBS:
        raw = raws[(folder, name)]
        if not raw.exists():
            print("MISSING RAW", raw)
            failed.append((folder, name))
            continue
        sheet = run_job(folder, name, target, mode, component, align, raw)
        if sheet is None:
            failed.append((folder, name))
            continue
        dest = PUB / pub_name[(folder, name)]
        shutil.copy2(sheet, dest)
        print(" ->", dest)
        if folder in ("billy", "frank", "jack") and name == "idle":
            portrait_from(sheet, PORT / f"{folder}.png")

    stitch_street()
    print("FAILED", failed)


if __name__ == "__main__":
    main()
