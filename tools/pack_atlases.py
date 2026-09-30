#!/usr/bin/env python3
"""Pack Blender PNG sequences into padded atlases and a browser manifest."""
import json
import math
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
BUILD = ROOT / "art" / "build"
ASSETS = ROOT / "assets"
manifest = {"version": 1, "generator": "Blender 5.2 / tools/blender/render_assets.py", "actors": {}, "props": {}, "floor": [], "icons": {}, "effects": {}}
PAD = 2


def pack_frames(name, spec):
    size = spec["size"]
    frames = spec["frames"]
    images = [Image.open(BUILD / name / frame["file"]).convert("RGBA") for frame in frames]
    bounds = [im.getchannel("A").getbbox() for im in images]
    assert all(bounds), f"Empty frames: {name}"
    crop = (min(b[0] for b in bounds), min(b[1] for b in bounds), max(b[2] for b in bounds), max(b[3] for b in bounds))
    cw, ch = crop[2] - crop[0], crop[3] - crop[1]
    pitch_x, pitch_y = cw + PAD * 2, ch + PAD * 2
    columns = math.ceil(math.sqrt(len(frames)))
    rows = math.ceil(len(frames) / columns)
    sheet = Image.new("RGBA", (columns * pitch_x, rows * pitch_y))
    clips = {}
    for i, frame in enumerate(frames):
        im = images[i]
        assert im.size == (size, size), frame["file"]
        bbox = im.getchannel("A").getbbox()
        assert bbox, f"Empty frame: {name}/{frame['file']}"
        # Leave a little cell padding, rather than clipping weapons at sheet edges.
        if bbox[0] == 0 or bbox[1] == 0 or bbox[2] == size or bbox[3] == size:
            print("EDGE_WARNING", name, frame["file"], bbox)
        x, y = (i % columns) * pitch_x + PAD, (i // columns) * pitch_y + PAD
        sheet.paste(im.crop(crop), (x, y))
        clips.setdefault(frame["clip"], {}).setdefault(frame["direction"], []).append([x, y, cw, ch])
    target = ASSETS / "atlases" / (name + ".png")
    target.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(target, optimize=True)
    manifest["actors"][name] = {
        "src": str(target.relative_to(ROOT)), "anchor": [spec["anchor"][0] - crop[0], spec["anchor"][1] - crop[1]], "bodyPixels": spec["bodyPixels"],
        "sourceSize": size, "sourceAnchor": spec["anchor"],
        "directions": spec["directions"], "width": sheet.width, "height": sheet.height,
        "clips": {clip: {**spec["clips"][clip], "directions": directions} for clip, directions in clips.items()},
        "poster": clips["idle"]["south" if "south" in spec["directions"] else "east"][0],
    }
    poster = frames[0]["file"]
    portrait = Image.open(BUILD / name / poster).convert("RGBA")
    portrait = portrait.crop(portrait.getchannel("A").getbbox())
    portrait.save(ASSETS / "atlases" / (name + "-portrait.png"), optimize=True)
    manifest["actors"][name]["portrait"] = f"assets/atlases/{name}-portrait.png"
    print("PACKED", name, len(frames), "frames", round(sheet.width * sheet.height * 4 / 1048576, 2), "MiB")


for file in sorted(BUILD.glob("*/spec.json")):
    spec = json.loads(file.read_text())
    if "frames" in spec:
        pack_frames(file.parent.name, spec)

props_spec = BUILD / "props" / "spec.json"
if props_spec.exists():
    spec = json.loads(props_spec.read_text())
    pitch = spec["size"] + PAD * 2
    items = spec["items"]
    sheet = Image.new("RGBA", (4 * pitch, math.ceil(len(items) / 4) * pitch))
    for i, item in enumerate(items):
        im = Image.open(BUILD / "props" / item["file"]).convert("RGBA")
        x, y = (i % 4) * pitch + PAD, (i // 4) * pitch + PAD
        sheet.paste(im, (x, y))
        manifest["props"][item["name"]] = {"rect": [x, y, spec["size"], spec["size"]], "anchor": item["anchor"], "worldWidth": item["worldWidth"]}
    target = ASSETS / "environment" / "props.png"
    target.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(target, optimize=True)
    manifest["propsSrc"] = "assets/environment/props.png"

for file in sorted((BUILD / "floor").glob("floor_*.png")):
    target = ASSETS / "environment" / file.name
    target.parent.mkdir(parents=True, exist_ok=True)
    Image.open(file).convert("RGB").save(target, optimize=True)
    manifest["floor"].append(str(target.relative_to(ROOT)))

for file in sorted((BUILD / "icons").glob("*.png")):
    target = ASSETS / "icons" / file.name
    target.parent.mkdir(parents=True, exist_ok=True)
    im = Image.open(file).convert("RGBA")
    box = im.getchannel("A").getbbox()
    assert box, f"Empty icon: {file}"
    im = im.crop(box)
    side = max(im.size) + 8
    canvas = Image.new("RGBA", (side, side))
    canvas.paste(im, ((side - im.width) // 2, (side - im.height) // 2))
    canvas.resize((64, 64), Image.Resampling.LANCZOS).save(target, optimize=True)
    manifest["icons"][file.stem] = str(target.relative_to(ROOT))

for folder in sorted(BUILD.glob("effect_*")):
    images = [Image.open(file).convert("RGBA") for file in sorted(folder.glob("*.png"))]
    if not images:
        continue
    sheet = Image.new("RGBA", (len(images) * 100, 100))
    frames = []
    for i, im in enumerate(images):
        sheet.paste(im, (i * 100 + 2, 2))
        frames.append([i * 100 + 2, 2, 96, 96])
    target = ASSETS / "atlases" / (folder.name + ".png")
    sheet.save(target, optimize=True)
    manifest["effects"][folder.name.removeprefix("effect_")] = {"src": str(target.relative_to(ROOT)), "frames": frames, "duration": .36}

(ASSETS / "asset-manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
total = sum(a["width"] * a["height"] * 4 for a in manifest["actors"].values())
print("ALL_ACTOR_ATLASES", round(total / 1048576, 2), "MiB decoded")
