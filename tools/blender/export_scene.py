"""Export an edited actor .blend without rebuilding or overwriting its model."""
import argparse
import json
import math
from pathlib import Path
import sys
import bpy

ROOT = Path(__file__).resolve().parents[2]
parser = argparse.ArgumentParser()
parser.add_argument("--actor", required=True)
parser.add_argument("--file", type=Path)
parser.add_argument("--clip")
parser.add_argument("--direction")
parser.add_argument("--output", type=Path)
args = parser.parse_args(sys.argv[sys.argv.index("--") + 1:])
manifest = json.loads((ROOT / "assets" / "asset-manifest.json").read_text())
asset = manifest["actors"][args.actor]
file = args.file or ROOT / "art" / "blender" / (args.actor + ".blend")
bpy.ops.wm.open_mainfile(filepath=str(file))
scene = bpy.context.scene
root = bpy.data.objects[args.actor]
size = asset["sourceSize"]
scene.render.resolution_x = scene.render.resolution_y = size
scene.render.resolution_percentage = 100
scene.render.film_transparent = True
scene.render.image_settings.file_format = "PNG"
scene.render.image_settings.color_mode = "RGBA"
folder = args.output or ROOT / "art" / "build" / args.actor
folder.mkdir(parents=True, exist_ok=True)
four = len(asset["directions"]) == 4
angles = {"south": 0, "east": math.pi / 2 if four else .65, "north": math.pi, "west": -math.pi / 2 if four else -.65}
frames = []
for direction in asset["directions"]:
    for clip, settings in asset["clips"].items():
        marker = scene.timeline_markers.get(clip)
        if marker is None:
            raise ValueError(f"Missing timeline marker: {clip}")
        for i in range(settings["count"]):
            filename = f"{direction}-{clip}-{i:02d}.png"
            frames.append({"file": filename, "direction": direction, "clip": clip, "index": i})
            if args.clip and args.clip != clip or args.direction and args.direction != direction:
                continue
            scene.frame_set(marker.frame + i)
            root.delta_rotation_euler.z = angles[direction]
            bpy.context.view_layer.update()
            scene.render.filepath = str(folder / filename)
            bpy.ops.render.render(write_still=True)
spec = {"name": args.actor, "size": size, "anchor": asset["sourceAnchor"], "bodyPixels": asset["bodyPixels"],
        "directions": asset["directions"], "clips": {k: {p: v[p] for p in ["duration", "loop", "count"]} for k, v in asset["clips"].items()}, "frames": frames}
(folder / "spec.json").write_text(json.dumps(spec, indent=2) + "\n")
print("EXPORTED_EDITED_SCENE", args.actor, flush=True)
