"""Render a high-resolution portrait from an existing actor scene without modifying it.

blender --background --python tools/blender/render_portrait.py -- --actor mara
"""
import argparse
import math
from pathlib import Path
import sys
import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--actor', default='mara')
parser.add_argument('--size', type=int, default=640)
args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:])
bpy.ops.wm.open_mainfile(filepath=str(ROOT / 'art' / 'blender' / (args.actor + '.blend')))
scene = bpy.context.scene
marker = scene.timeline_markers.get('idle')
scene.frame_set(marker.frame if marker else 1)
root = bpy.data.objects[args.actor]
root.rotation_euler.z = root.delta_rotation_euler.z = 0
scene.render.resolution_x = scene.render.resolution_y = args.size
scene.render.resolution_percentage = 100
scene.render.film_transparent = True
scene.render.image_settings.color_mode = 'RGBA'
# A shallower beauty camera shows the face while preserving the gameplay source camera.
theta = math.radians(70)
ortho = scene.camera.data.ortho_scale
anchor_y = .84
aim = Vector((0,0,(anchor_y-.5)*ortho/math.sin(theta)))
scene.camera.location = aim + Vector((0,-10*math.sin(theta),10*math.cos(theta)))
scene.camera.rotation_euler = (aim-scene.camera.location).to_track_quat('-Z','Y').to_euler()
output = ROOT / 'art' / 'build' / args.actor / 'portrait.png'
output.parent.mkdir(parents=True, exist_ok=True)
scene.render.filepath = str(output)
bpy.ops.render.render(write_still=True)
print('PORTRAIT_DONE', output, flush=True)
