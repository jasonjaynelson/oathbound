"""Build editable Oathbound models and render native-alpha sprite sequences.

blender --factory-startup --background -noaudio --python-exit-code 1 \
  --python tools/blender/render_assets.py -- --only aldric,skeleton,pillar,shrine,floor
python3 tools/pack_atlases.py
"""
import argparse
import json
import math
from pathlib import Path
import random
import sys
import time

import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
BUILD = ROOT / "art" / "build"
SOURCES = ROOT / "art" / "blender"
BUILD.mkdir(parents=True, exist_ok=True)
SOURCES.mkdir(parents=True, exist_ok=True)
parser = argparse.ArgumentParser()
parser.add_argument("--only", default="all")
parser.add_argument("--force", action="store_true")
opts = parser.parse_args(sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else [])
SELECTED = opts.only.split(",")
random.seed(823)
TAU = math.tau
M = {}
SPECS = {}


def material(name, color, metallic=0, roughness=.7, emission=0):
    if name in M:
        return M[name]
    m = bpy.data.materials.new(name)
    m.use_fake_user = True
    m.diffuse_color = (*color, 1)
    m.use_nodes = True
    bs = m.node_tree.nodes.get("Principled BSDF")
    bs.inputs["Base Color"].default_value = (*color, 1)
    bs.inputs["Metallic"].default_value = metallic
    bs.inputs["Roughness"].default_value = roughness
    if emission:
        bs.inputs["Emission Color"].default_value = (*color, 1)
        bs.inputs["Emission Strength"].default_value = emission
    if name.startswith("stone") or name == "moss":
        noise = m.node_tree.nodes.new("ShaderNodeTexNoise")
        noise.inputs["Scale"].default_value = 8
        noise.inputs["Detail"].default_value = 3
        ramp = m.node_tree.nodes.new("ShaderNodeValToRGB")
        ramp.color_ramp.elements[0].position = .15
        ramp.color_ramp.elements[0].color = (*[c * .35 for c in color], 1)
        ramp.color_ramp.elements[1].position = .85
        ramp.color_ramp.elements[1].color = (*[c * .90 for c in color], 1)
        bump = m.node_tree.nodes.new("ShaderNodeBump")
        bump.inputs["Strength"].default_value = .28
        bump.inputs["Distance"].default_value = .055
        m.node_tree.links.new(noise.outputs["Fac"], ramp.inputs["Fac"])
        m.node_tree.links.new(ramp.outputs["Color"], bs.inputs["Base Color"])
        m.node_tree.links.new(noise.outputs["Fac"], bump.inputs["Height"])
        m.node_tree.links.new(bump.outputs["Normal"], bs.inputs["Normal"])
    M[name] = m
    return m


def palette():
    material("steel", (.19, .23, .30), .65, .36)
    material("edge", (.40, .47, .56), .65, .31)
    material("iron", (.055, .065, .09), .55)
    material("gold", (.47, .29, .08), .65, .38)
    material("cloth", (.26, .025, .045))
    material("ivorycloth", (.57, .52, .39))
    material("grey_cloth", (.17, .18, .20))
    material("skin", (.50, .29, .17))
    material("leather", (.075, .04, .028))
    material("bone", (.56, .51, .37), 0, .82)
    material("boneedge", (.73, .68, .52))
    material("stone", (.19, .18, .16))
    material("stoneedge", (.30, .285, .25))
    material("stone_dark", (.095, .095, .088))
    material("moss", (.08, .12, .067))
    material("soul", (.17, .55, .78), emission=1.2)
    material("ember", (.82, .20, .04), emission=1.1)
    material("violet", (.32, .15, .52), emission=.8)
    material("blood", (.36, .012, .04), roughness=.32)
    material("slime", (.15, .30, .13), roughness=.29)


def setup(size=128, ortho=3.5, top=False, anchor_y=.84):
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for data in list(bpy.data.meshes):
        if not data.users:
            bpy.data.meshes.remove(data)
    scene = bpy.context.scene
    scene.timeline_markers.clear()
    scene.frame_start = 1
    scene.render.engine = "BLENDER_EEVEE"
    if hasattr(scene, "eevee") and hasattr(scene.eevee, "taa_render_samples"):
        scene.eevee.taa_render_samples = 16
    scene.render.resolution_x = scene.render.resolution_y = size
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = True
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.image_settings.color_depth = "8"
    scene.render.image_settings.compression = 85
    scene.render.use_file_extension = True
    scene.render.fps = 12
    scene.view_settings.view_transform = "Standard"
    scene.view_settings.look = "Medium High Contrast" if "Medium High Contrast" in [e.identifier for e in scene.view_settings.bl_rna.properties["look"].enum_items] else "None"
    scene.world.use_nodes = True
    scene.world.node_tree.nodes["Background"].inputs[0].default_value = (.25, .29, .39, 1)
    scene.world.node_tree.nodes["Background"].inputs[1].default_value = .5
    camera = bpy.data.cameras.new("Orthographic export camera")
    camera.type = "ORTHO"
    camera.ortho_scale = ortho
    cam = bpy.data.objects.new("Camera", camera)
    scene.collection.objects.link(cam)
    if top:
        cam.location = (0, 0, 10)
        cam.rotation_euler = (0, 0, 0)
    else:
        # Elevation 35 degrees. Foot anchor remains identical across every frame.
        theta = math.radians(55)
        aim = Vector((0, 0, (anchor_y - .5) * ortho / math.sin(theta)))
        cam.location = aim + Vector((0, -10 * math.sin(theta), 10 * math.cos(theta)))
        cam.rotation_euler = (aim - cam.location).to_track_quat("-Z", "Y").to_euler()
    scene.camera = cam
    for name, rotation, energy, color in [
        ("Moon key", (.45, -.5, -.65), 2.6, (.70, .80, 1)),
        ("Warm fill", (.8, .3, 1.8), 1.15, (1, .76, .49)),
        ("Rim", (-.65, .4, 2.6), 1.5, (.64, .74, 1)),
    ]:
        light = bpy.data.lights.new(name, "SUN")
        light.energy = energy
        light.color = color
        light.angle = .25
        obj = bpy.data.objects.new(name, light)
        scene.collection.objects.link(obj)
        obj.rotation_euler = rotation
    return scene


def empty(name, loc=(0, 0, 0), parent=None):
    o = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(o)
    o.parent = parent
    o.location = loc
    return o


def finish(o, name, mat, parent):
    o.name = name
    if mat:
        o.data.materials.append(M[mat])
    o.parent = parent
    return o


def sphere(name, loc, scale, mat, parent=None, segments=12):
    if segments == 8:
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=1)
    else:
        bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=8, location=(0, 0, 0))
    o = finish(bpy.context.object, name, mat, parent)
    o.location, o.scale = loc, scale
    for p in o.data.polygons:
        p.use_smooth = segments != 8
    return o


def box(name, loc, scale, mat, parent=None, bevel=.04):
    bpy.ops.mesh.primitive_cube_add(size=1)
    o = finish(bpy.context.object, name, mat, parent)
    o.location, o.scale = loc, scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel:
        mod = o.modifiers.new("Forged edges", "BEVEL")
        mod.width = bevel
        mod.segments = 2
        o.modifiers.new("Weighted normals", "WEIGHTED_NORMAL")
    return o


def cylinder(name, loc, radius, depth, mat, parent=None, vertices=12):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth)
    o = finish(bpy.context.object, name, mat, parent)
    o.location = loc
    o.modifiers.new("Weighted normals", "WEIGHTED_NORMAL")
    return o


def link(name, a, b, radius, mat, parent=None):
    a, b = Vector(a), Vector(b)
    o = cylinder(name, (a + b) / 2, radius, (b - a).length, mat, parent, 8)
    o.rotation_euler = (b - a).to_track_quat("Z", "Y").to_euler()
    return o


def mesh(name, vertices, faces, mat, parent=None):
    data = bpy.data.meshes.new(name)
    data.from_pydata(vertices, [], faces)
    data.update()
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    finish(obj, name, mat, parent)
    return obj


def sword(parent, loc=(0, -.2, -.16), large=False):
    h = empty("Sword", loc, parent)
    s = 1.15 if large else 1
    box("Leather grip", (0, 0, .08), (.09, .09, .28), "leather", h)
    sphere("Pommel", (0, 0, .25), (.095, .075, .08), "gold", h)
    box("Cross guard", (0, 0, -.08), (.43, .1, .085), "gold", h)
    mesh("Tempered blade", [(-.07, -.04, -.13), (.07, -.04, -.13), (0, -.065, -1.02 * s),
        (-.07, .04, -.13), (.07, .04, -.13), (0, .065, -1.02 * s)],
        [(0, 1, 2), (3, 5, 4), (0, 2, 5, 3), (1, 4, 5, 2), (0, 3, 4, 1)], "edge", h)
    return h


def shield(parent, loc):
    pivot = empty("Shield", loc, parent)
    mesh("Crimson kite shield", [(-.33, -.08, .38), (.33, -.08, .38), (.29, -.08, -.14), (0, -.08, -.52), (-.29, -.08, -.14)], [(0, 1, 2, 3, 4)], "cloth", pivot)
    points = [(-.33, -.09, .38), (.33, -.09, .38), (.29, -.09, -.14), (0, -.09, -.52), (-.29, -.09, -.14)]
    for i in range(5):
        link("Shield rim", points[i], points[(i + 1) % 5], .035, "edge", pivot)
    box("Shield oath", (0, -.11, .02), (.055, .025, .38), "gold", pivot)
    box("Shield oath arms", (0, -.11, .08), (.24, .025, .05), "gold", pivot)
    return pivot


def humanoid(name):
    root = empty(name)
    body = empty("Body", (0, 0, 1.02), root)
    skeleton = name in ("skeleton", "wight")
    hollow = name == "hollow"
    mara = name == "mara"
    duke = name == "duke"
    cloth = "ivorycloth" if mara else "cloth"
    torso = "bone" if skeleton else "iron" if hollow or duke else "steel"
    hips = sphere("Hip", (0, 0, .04), (.31, .20, .22), torso, body)
    if skeleton:
        link("Spine", (0, 0, .2), (0, 0, .84), .055, "bone", body)
        for i in range(5):
            z = .37 + i * .10
            sphere("Rib left", (-.15, -.03, z), (.20, .095, .045), "bone", body)
            sphere("Rib right", (.15, -.03, z), (.20, .095, .045), "bone", body)
        sphere("Skull", (0, -.02, 1.16), (.23, .2, .28), "boneedge", body)
        box("Jaw", (0, -.09, .98), (.32, .24, .14), "bone", body)
        for side in [-1, 1]:
            sphere("Eye socket", (side * .09, -.205, 1.20), (.073, .031, .086), "iron", body)
            sphere("Soul eye", (side * .09, -.23, 1.20), (.025, .017, .033), "soul", body)
        sphere("Nasal cavity", (0, -.223, 1.08), (.035, .025, .045), "iron", body)
    else:
        sphere("Breastplate", (0, 0, .58), (.40 if hollow else .36, .24, .46), torso, body)
        for z in [.24, .36, .48]:
            box("Plate band", (0, -.21, z), (.65, .065, .10), "edge" if not hollow else "gold", body)
        cylinder("Neck guard", (0, 0, .98), .22, .15, "gold", body)
        if duke:
            sphere("Duke skull", (0, -.01, 1.23), (.265, .215, .30), "boneedge", body)
            for side in [-1, 1]:
                sphere("Duke socket", (side * .10, -.21, 1.30), (.073, .035, .09), "iron", body)
                sphere("Duke eye", (side * .10, -.25, 1.31), (.02, .01, .025), "violet", body)
            sphere("Wailing mouth", (0, -.22, 1.09), (.12, .035, .13), "iron", body)
            box("Duke jaw", (0, -.12, .98), (.31, .22, .09), "bone", body)
            for side in [-1, 1]:
                sphere("Skull clasp", (side * .23, -.24, .81), (.09, .06, .105), "gold", body)
        elif mara:
            sphere("Mara face", (0, -.06, 1.20), (.205, .17, .25), "skin", body)
            sphere("Open helm", (0, .01, 1.39), (.255, .23, .18), "steel", body)
            box("Helm brow", (0, -.21, 1.35), (.40, .055, .045), "gold", body)
            for side in [-1, 1]:
                sphere("Mara eye", (side * .08, -.222, 1.23), (.03, .012, .017), "iron", body)
                box("Helm cheek", (side * .22, -.02, 1.20), (.05, .18, .25), "steel", body)
            sphere("Nose", (0, -.24, 1.18), (.027, .025, .04), "skin", body)
        else:
            sphere("Closed helm", (0, -.01, 1.21), (.255, .235, .31), torso, body)
            box("Visor", (0, -.222, 1.19), (.35, .075, .24), "iron", body)
            box("Brow", (0, -.25, 1.32), (.37, .075, .075), "gold", body)
            for x in [-.105, -.035, .035, .105]:
                box("Visor slit", (x, -.263, 1.17), (.018, .013, .09), "gold" if hollow else "stone_dark", body, .004)
            box("Helm oath", (0, -.22, 1.48), (.035, .025, .14), "gold", body)
            box("Helm oath arms", (0, -.22, 1.48), (.12, .025, .028), "gold", body)
        box("Belt", (0, -.07, .11), (.64, .42, .1), "leather", body)
        box("Buckle", (0, -.29, .12), (.14, .05, .13), "gold", body)
    arms, legs = [], []
    for side in [-1, 1]:
        arm = empty("Arm L" if side < 0 else "Arm R", (side * .39, 0, .81), body)
        arms.append(arm)
        sphere("Shoulder", (0, 0, 0), (.19, .22, .20), torso, arm)
        if not skeleton:
            sphere("Pauldron trim", (side * .025, -.02, .035), (.21, .225, .095), "gold", arm)
        link("Upper arm", (0, 0, -.12), (side * .045, 0, -.39), .065 if skeleton else .125, torso, arm)
        sphere("Elbow", (side * .045, -.015, -.39), (.09, .09, .09), "bone" if skeleton else "gold", arm)
        link("Forearm", (side * .045, 0, -.40), (side * .08, -.08, -.71), .06 if skeleton else .11, torso, arm)
        sphere("Hand", (side * .08, -.08, -.75), (.07, .08, .10), "bone" if skeleton else "iron", arm)
        leg = empty("Leg L" if side < 0 else "Leg R", (side * .18, 0, 0), body)
        legs.append(leg)
        link("Thigh", (0, 0, -.04), (0, 0, -.40), .072 if skeleton else .13, torso, leg)
        sphere("Knee", (0, -.035, -.45), (.095 if skeleton else .145, .12, .12), "bone" if skeleton else "edge", leg)
        link("Shin", (0, 0, -.5), (0, 0, -.88), .065 if skeleton else .115, torso, leg)
        box("Foot", (0, -.10, -.95), (.13 if skeleton else .23, .34, .14), "bone" if skeleton else "iron", leg)
    cape = None
    if not skeleton or name == "wight":
        cape = empty("Cape pivot", (0, .19, .91), body)
        mesh("Tattered cape", [(-.33, 0, 0), (.33, 0, 0), (.53, .20, -1.26), (.25, .26, -1.10), (.08, .29, -1.42),
              (-.11, .28, -1.24), (-.46, .20, -1.34)], [(0, 1, 2, 3, 4, 5, 6)], "grey_cloth" if hollow or duke else cloth, cape)
    if mara:
        held = empty("Holy cross staff", (.08, -.11, -.45), arms[1])
        cylinder("Staff", (0, 0, .03), .025, 1.30, "leather", held)
        box("Staff cross", (0, 0, .78), (.07, .065, .39), "gold", held)
        box("Staff cross arms", (0, 0, .86), (.31, .065, .07), "gold", held)
        sphere("Staff jewel", (0, -.042, .86), (.05, .025, .05), "soul", held)
    else:
        held = sword(arms[1], (.08, -.11, -.72), duke)
    if not skeleton and not mara:
        shield(arms[0], (-.08, -.21, -.52))
    if mara:
        box("Ivory tabard", (0, -.248, .53), (.27, .025, .54), "ivorycloth", body)
        box("Tabard cross", (0, -.27, .60), (.04, .02, .24), "gold", body)
        box("Tabard cross arms", (0, -.27, .65), (.18, .02, .04), "gold", body)
    if hollow:
        for x in [-.14, .14]:
            sphere("Blood-lit visor", (x, -.28, 1.30), (.035, .02, .026), "ember", body)
    if duke:
        for i in range(7):
            angle = TAU * i / 7
            link("Crown spike", (.23 * math.cos(angle), .22 * math.sin(angle), 1.46),
                (.26 * math.cos(angle), .25 * math.sin(angle), 1.77), .025, "gold", body)
        root.scale = (1.23, 1.23, 1.23)
    return {"root": root, "body": body, "arms": arms, "legs": legs, "cape": cape, "weapon": held, "base": body.location.copy()}


def creature(name):
    root = empty(name)
    body = empty("Body", (0, 0, 0), root)
    rig = {"root": root, "body": body, "arms": [], "legs": [], "cape": None, "base": Vector((0, 0, 0))}
    if name == "slime":
        sphere("Slime body", (0, 0, .46), (.63, .49, .52), "slime", body)
        for x in [-.18, .18]:
            sphere("Sunken eye", (x, -.44, .57), (.10, .037, .09), "iron", body)
            sphere("Eye glint", (x, -.475, .58), (.025, .015, .025), "soul", body)
        sphere("Crown bubble", (.24, .03, .87), (.16, .16, .14), "slime", body)
    elif name == "bat":
        body.location.z = .75; rig["base"] = body.location.copy()
        sphere("Bat body", (0, 0, .2), (.17, .18, .39), "leather", body)
        sphere("Bat head", (0, -.11, .50), (.20, .19, .17), "iron", body)
        for side in [-1, 1]:
            link("Ear", (side * .12, -.03, .6), (side * .2, .03, .91), .065, "leather", body)
            sphere("Bat eye", (side * .09, -.28, .52), (.025, .02, .025), "ember", body)
            wing = empty("Wing", (side * .12, .02, .35), body)
            rig["arms"].append(wing)
            pts = [(0, 0, 0), (side * .51, 0, .33), (side * 1.02, 0, .06), (side * .74, -.02, -.12),
                   (side * .45, -.02, -.28), (side * .22, 0, -.10)]
            mesh("Wing membrane", pts, [(0, 1, 2, 3, 4, 5)], "cloth", wing)
            for k in [1, 2, 3, 4]:
                link("Wing finger", (0, 0, 0), pts[k], .019, "bone", wing)
    elif name in ("shade", "dawneater"):
        body.location.z = .25; rig["base"] = body.location.copy()
        sphere("Hood", (0, 0, 1.7), (.38, .30, .46), "iron", body)
        sphere("Hood void", (0, -.26, 1.66), (.24, .06, .29), "stone_dark", body)
        for side in [-1, 1]:
            sphere("Spectral eye", (side * .10, -.32, 1.76), (.047, .018, .027), "ember" if name == "dawneater" else "violet", body)
        mesh("Spectral robe", [(-.34, 0, 1.51), (.34, 0, 1.51), (.57, -.13, .14), (.26, -.23, .35),
              (0, -.29, .05), (-.24, -.23, .36), (-.56, -.13, .16), (0, .35, 1.46), (0, .50, .09)],
             [(0, 1, 2, 3, 4, 5, 6), (0, 7, 8, 6), (1, 2, 8, 7)], "cloth" if name == "dawneater" else "iron", body)
        for side in [-1, 1]:
            arm = empty("Spectral arm", (side * .34, 0, 1.44), body)
            rig["arms"].append(arm)
            link("Sleeve", (0, 0, 0), (side * .35, -.06, -.46), .12, "iron", arm)
            for k in range(3):
                link("Claw", (side * .35 + k * .055, -.06, -.46), (side * .38 + k * .055, -.15, -.70), .025, "bone", arm)
        if name == "dawneater":
            for side in [-1, 1]:
                for i in range(4):
                    link("Crown of night", (side * (.19 + i * .08), .12, 1.95), (side * (.30 + i * .13), .25, 2.24 - i * .07), .027, "bone", body)
            sphere("Eclipsed heart", (0, -.25, 1.17), (.14, .08, .14), "ember", body)
            root.scale = (1.3, 1.3, 1.3)
    elif name == "golem":
        body.location.z = 1; rig["base"] = body.location.copy()
        sphere("Rock torso", (0, 0, .52), (.65, .36, .65), "stone", body, 8)
        sphere("Stone head", (0, -.03, 1.15), (.34, .30, .36), "stoneedge", body, 8)
        for side in [-1, 1]:
            sphere("Rune eye", (side * .12, -.30, 1.20), (.05, .025, .026), "soul", body)
            arm = empty("Stone arm", (side * .62, 0, .72), body)
            rig["arms"].append(arm)
            sphere("Stone upper arm", (side * .07, 0, -.15), (.25, .26, .42), "stone", arm, 8)
            sphere("Stone fist", (side * .12, -.1, -.59), (.31, .28, .28), "stoneedge", arm, 8)
            leg = empty("Stone leg", (side * .30, 0, 0), body)
            rig["legs"].append(leg)
            sphere("Stone shin", (0, 0, -.43), (.23, .25, .48), "stone", leg, 8)
            box("Stone foot", (0, -.08, -.85), (.40, .50, .24), "stone_dark", leg)
        box("Heart rune", (0, -.36, .60), (.055, .028, .43), "soul", body)
        box("Heart rune arms", (0, -.36, .70), (.27, .028, .045), "soul", body)
    elif name == "hydra":
        sphere("Bone body", (0, .12, .65), (.62, .48, .44), "bone", body)
        for side in [-1, 1]:
            for y in [-.16, .42]:
                link("Leg", (side * .38, y, .64), (side * .72, y - .12, .12), .10, "bone", body)
        for i in [-1, 0, 1]:
            head = empty("Hydra neck", (i * .28, -.18, .77), body)
            rig["arms"].append(head)
            link("Neck", (0, 0, 0), (i * .26, -.13, .81 - abs(i) * .12), .105, "bone", head)
            sphere("Hydra skull", (i * .26, -.23, .86 - abs(i) * .12), (.21, .34, .19), "boneedge", head)
            for side in [-1, 1]:
                sphere("Hydra socket", (i * .26 + side * .16, -.36, .93 - abs(i) * .12), (.036, .055, .043), "ember", head)
            for k in [-1, 1]:
                link("Fang", (i * .26 + k * .1, -.47, .80 - abs(i) * .12), (i * .26 + k * .1, -.47, .67 - abs(i) * .12), .027, "boneedge", head)
        for i in range(7):
            sphere("Spinal plate", (0, .08 + i * .16, .87 - i * .075), (.14, .09, .17), "bone", body)
        link("Tail", (0, .58, .61), (.1, 1.5, .14), .09, "bone", body)
    return rig


def pose(rig, clip, phase, direction):
    root, body = rig["root"], rig["body"]
    root.rotation_euler = (0, 0, direction)
    root.location = (0, 0, 0)
    body.location = rig["base"]
    body.rotation_euler = (0, 0, 0)
    body.scale = (1, 1, 1)
    for part in rig["arms"] + rig["legs"]:
        part.rotation_euler = (0, 0, 0)
    cape = rig["cape"]
    if cape:
        cape.rotation_euler = (0, 0, 0)
    s = math.sin(phase * TAU)
    name = root.name
    moving = clip in ("run", "go", "dash")
    if moving:
        amp = .38 if name != "golem" else .21
        for i, part in enumerate(rig["legs"]):
            part.rotation_euler.x = s * amp * (-1 if i else 1)
        for i, part in enumerate(rig["arms"]):
            part.rotation_euler.x = s * amp * (.55 if i else -.55)
        body.location.z += abs(s) * .035
        body.rotation_euler.y = s * .035
        if cape:
            cape.rotation_euler.x = -.24 + s * .06
    else:
        body.location.z += s * .015
        if cape:
            cape.rotation_euler.x = s * .045
    if name == "bat":
        for i, wing in enumerate(rig["arms"]):
            wing.rotation_euler.y = s * .62 * (1 if i else -1)
        body.location.z += s * .08
    if name == "slime":
        body.scale = (1 + s * .09, 1 + s * .07, 1 - s * .11)
    if name in ("shade", "dawneater", "wight"):
        body.location.z += s * .06
    if name == "hydra":
        for i, head in enumerate(rig["arms"]):
            head.rotation_euler.y = math.sin(phase * TAU + i * 1.2) * .16
    if clip in ("dash", "go"):
        body.rotation_euler.x = -.20
        if cape:
            cape.rotation_euler.x = -.5
    if clip == "hurt":
        body.rotation_euler.x = math.sin(phase * math.pi) * .18
        body.rotation_euler.y = math.sin(phase * math.pi) * -.12
    if clip in ("tel", "cast"):
        for i, arm in enumerate(rig["arms"]):
            arm.rotation_euler.x = -(.45 + phase * .6)
            arm.rotation_euler.y = (.25 + phase * .2) * (-1 if i else 1)
        body.rotation_euler.x = .1 * phase
    if clip == "slam":
        for arm in rig["arms"]:
            arm.rotation_euler.x = -1.2 * (1 - phase) + .40 * phase
        body.rotation_euler.x = -.22 * phase
    if clip == "death":
        # Fall toward the camera, with feet remaining near the ground anchor.
        body.location.z -= phase * .25
        body.rotation_euler.x = phase * 1.20
        for arm in rig["arms"]:
            arm.rotation_euler.y = phase * .5
        if name in ("slime", "bat", "hydra", "shade", "dawneater"):
            body.location = rig["base"]
            body.rotation_euler.x = 0
            body.rotation_euler.y = phase * .15
            body.scale.z = 1 - phase * .48
    bpy.context.view_layer.update()


HERO_CLIPS = {"idle": (4, .8, True), "run": (8, .65, True), "dash": (4, .18, False), "hurt": (3, .25, False), "death": (6, .65, False)}
ENEMY_CLIPS = {"idle": (4, 1, True), "run": (6, .7, True), "hurt": (2, .16, False), "death": (4, .45, False)}
BOSS_CLIPS = {"idle": (4, 1.2, True), "run": (6, 1, True), "tel": (4, .55, False), "go": (4, .4, False),
              "slam": (5, .7, False), "cast": (4, .7, False), "hurt": (2, .16, False), "death": (6, .65, False)}


def render_actor(name):
    hero = name in ("aldric", "mara", "hollow")
    boss = name in ("duke", "hydra", "dawneater")
    size = 192 if boss else 128 if hero else 96
    ortho = 6.0 if boss else 3.4 if hero or name in ("skeleton", "wight", "golem") else 3.0 if name == "shade" else 2.7
    anchor_y = .76 if boss else .84
    scene = setup(size, ortho, anchor_y=anchor_y)
    rig = humanoid(name) if hero or name in ("skeleton", "wight", "duke") else creature(name)
    clips = HERO_CLIPS if hero else BOSS_CLIPS if boss else ENEMY_CLIPS
    directions = {"south": 0, "east": math.pi / 2, "north": math.pi, "west": -math.pi / 2} if hero else {"east": .65, "west": -.65}
    dest = BUILD / name
    dest.mkdir(exist_ok=True)
    frames = []
    timeline = 1
    for clip, (count, duration, loop) in clips.items():
        # Keep a real, editable animation timeline in each source file.
        start = timeline
        for i in range(count):
            phase = i / count if loop else i / max(1, count - 1)
            pose(rig, clip, phase, 0)
            for obj in [rig["root"], rig["body"], *rig["arms"], *rig["legs"], *([rig["cape"]] if rig["cape"] else [])]:
                for prop in ["location", "rotation_euler", "scale"]:
                    obj.keyframe_insert(data_path=prop, frame=timeline)
            timeline += 1
        scene.timeline_markers.new(clip, frame=start)
        timeline += 2
    scene.frame_end = timeline
    rig["root"]["clips"] = json.dumps({k: {"frames": v[0], "duration": v[1], "loop": v[2]} for k, v in clips.items()})
    # Disable keyframe evaluation while rendering explicitly sampled poses.
    for obj in scene.objects:
        if obj.animation_data and obj.animation_data.action:
            obj.animation_data.action.use_fake_user = True
    scene.frame_set(1)
    pose(rig, "idle", 0, 0)
    bpy.ops.wm.save_as_mainfile(filepath=str(SOURCES / f"{name}.blend"))
    for obj in scene.objects:
        obj.animation_data_clear()
    for direction, angle in directions.items():
        for clip, (count, duration, loop) in clips.items():
            for i in range(count):
                filename = f"{direction}-{clip}-{i:02d}.png"
                file = dest / filename
                if opts.force or not file.exists():
                    pose(rig, clip, i / count if loop else i / max(1, count - 1), angle)
                    scene.render.filepath = str(file)
                    bpy.ops.render.render(write_still=True)
                frames.append({"file": filename, "direction": direction, "clip": clip, "index": i})
    # Display sizes refer to body height, independent of atlas padding.
    body_height = {"slime": .97, "bat": 1.35, "hydra": 1.78, "shade": 2.25, "dawneater": 3.15, "golem": 2.5, "duke": 3.3}.get(name, 2.57)
    spec = {"name": name, "size": size, "anchor": [size / 2, size * anchor_y],
            "bodyPixels": body_height * math.sin(math.radians(55)) * size / ortho,
            "clips": {k: {"duration": v[1], "loop": v[2], "count": v[0]} for k, v in clips.items()},
            "directions": list(directions), "frames": frames}
    (dest / "spec.json").write_text(json.dumps(spec, indent=2) + "\n")
    print("ACTOR_DONE", name, len(frames), flush=True)


def prop(name):
    root = empty(name)
    if name.startswith("pillar"):
        cylinder("Foundation", (0, 0, .09), .63, .18, "stone_dark", root)
        cylinder("Base molding", (0, 0, .24), .54, .14, "stoneedge", root)
        for i in range(4 if name == "pillar" else 3):
            o = cylinder("Broken drum", (.025 * i, .018 * i, .47 + i * .3), .40 - i * .025, .28, "stone", root, 10)
            o.rotation_euler.z = i * .20
        cylinder("Broken capital", (.1, .08, 1.55 if name == "pillar" else 1.24), .45, .12, "stoneedge", root, 7)
        for x, y in [(-.27, .03), (.19, -.22), (.20, .13)]:
            sphere("Moss", (x, y, .20), (.17, .12, .035), "moss", root)
        for i in range(4):
            sphere("Fallen stone", (.53 * math.cos(i * 1.7), .35 * math.sin(i * 1.7), .11), (.12, .09, .1), "stone", root, 8)
    elif name.startswith("shrine"):
        cylinder("Shrine base", (0, 0, .08), .46, .16, "stone_dark", root, 8)
        box("Pedestal", (0, 0, .37), (.56, .46, .51), "stone", root)
        box("Cornice", (0, 0, .66), (.76, .59, .13), "stoneedge", root)
        for side in [-1, 1]:
            link("Gold edging", (side * .23, -.241, .19), (side * .23, -.241, .60), .016, "gold", root)
        if name != "shrine_spent":
            kind = name.removeprefix("shrine_")
            color = "soul" if kind in ("soul", "wind") else "ember" if kind in ("wrath", "might", "phial") else "gold" if kind in ("armory", "aegis") else "violet"
            if kind == "armory":
                sword(root, (0, 0, 1.50))
            elif kind == "aegis":
                shield(root, (0, 0, 1.12))
            else:
                cylinder("Relic bowl", (0, 0, .80), .25, .12, "gold", root)
                sphere("Relic", (0, -.01, 1.10), (.12, .12, .22), color, root)
                for i in range(3):
                    link("Relic prong", (.20 * math.cos(i * TAU / 3), .20 * math.sin(i * TAU / 3), .83), (.13 * math.cos(i * TAU / 3), .13 * math.sin(i * TAU / 3), 1.26), .016, "gold", root)
    elif name.startswith("wall"):
        vertical = name == "wall_vertical"
        for row in range(3):
            for i in range(4):
                x = -.68 + i * .45 + (row % 2) * .03
                loc = (0, x, .13 + row * .22) if vertical else (x, 0, .13 + row * .22)
                scale = (.39, .43, .21) if vertical else (.43, .39, .21)
                box("Weathered masonry", loc, scale, "stoneedge" if row == 2 else "stone", root, .024)
        for i in range(3):
            loc = (0, -.6 + i * .6, .85) if vertical else (-.6 + i * .6, 0, .85)
            box("Battlement", loc, (.4, .22, .27) if vertical else (.22, .4, .27), "stoneedge", root)
    elif name == "brazier":
        cylinder("Brazier foot", (0, 0, .06), .28, .12, "stone_dark", root)
        cylinder("Brazier stem", (0, 0, .44), .06, .72, "iron", root)
        sphere("Brazier bowl", (0, 0, .86), (.30, .24, .11), "iron", root)
        for i in range(3):
            sphere("Flame", (.10 * math.sin(i * 2), 0, 1 + i * .08), (.07, .075, .16 - i * .03), "ember", root)
    elif name == "banner":
        cylinder("Banner standard", (0, 0, 1.02), .032, 2.04, "iron", root)
        box("Banner crossbar", (0, 0, 1.84), (.66, .055, .055), "gold", root)
        mesh("Ragged banner", [(-.30, 0, 1.82), (.30, 0, 1.82), (.32, -.07, .80), (.07, -.08, .93), (-.27, -.07, .72)], [(0, 1, 2, 3, 4)], "cloth", root)
        box("Banner oath", (0, -.08, 1.36), (.045, .015, .34), "gold", root)
        box("Banner oath arms", (0, -.08, 1.44), (.22, .015, .04), "gold", root)
    return root


def render_props():
    names = ["pillar", "pillar_broken", "shrine_spent", *["shrine_" + n for n in ["armory", "soul", "wind", "wrath", "phial", "might", "aegis", "magnet"]], "wall_horizontal", "wall_vertical", "brazier", "banner"]
    dest = BUILD / "props"
    dest.mkdir(exist_ok=True)
    items = []
    for name in names:
        scene = setup(192, 2.9)
        prop(name)
        bpy.ops.wm.save_as_mainfile(filepath=str(SOURCES / f"{name}.blend"))
        scene.render.filepath = str(dest / (name + ".png"))
        if opts.force or not Path(scene.render.filepath).exists():
            bpy.ops.render.render(write_still=True)
        items.append({"name": name, "file": name + ".png", "anchor": [96, 192 * .84], "worldWidth": 2.9, "bodyPixels": 105})
    (dest / "spec.json").write_text(json.dumps({"size": 192, "items": items}, indent=2) + "\n")
    print("PROPS_DONE", len(items), flush=True)


def render_floor():
    dest = BUILD / "floor"
    dest.mkdir(exist_ok=True)
    for variant in range(3):
        scene = setup(512, 8, True)
        scene.render.film_transparent = False
        random.seed(923 + variant)
        box("Mortar", (0, 0, -.06), (8.3, 8.3, .1), "stone_dark", bevel=0)
        for y in range(-4, 5):
            for x in range(-5, 5):
                # Edge padding repeats the tile pattern without a bright border.
                xx = x + (y % 2) * .5
                m = "stone" if random.random() > .27 else "stone_dark"
                tile = box("Paving", (xx, y, -.015 + random.random() * .009), (.97, .965, .08), m, bevel=.028)
                if variant and random.random() < .12 and abs(xx) < 3.5 and abs(y) < 3.5:
                    link("Paving crack", (xx - .24, y - .12, .032), (xx + .15, y + .13, .032), .008, "stone_dark")
        bpy.ops.wm.save_as_mainfile(filepath=str(SOURCES / f"floor_{variant}.blend"))
        scene.render.filepath = str(dest / f"floor_{variant}.png")
        if opts.force or not Path(scene.render.filepath).exists():
            bpy.ops.render.render(write_still=True)
    print("FLOOR_DONE", flush=True)


def icon(name):
    root = empty(name)
    if name in ("oathblade", "crown", "firebrand", "dragon", "might", "rage"):
        sword(root, (0, 0, .85))
        root.rotation_euler.y = -.5
        if name in ("crown", "dragon", "rage"):
            for side in [-1, 1]:
                h = sword(root, (side * .28, .08, .65))
                h.rotation_euler.y = side * .30
    elif name in ("holy", "judgment", "faith", "aegis"):
        box("Sacred cross", (0, 0, .7), (.17, .14, 1.2), "gold", root)
        box("Sacred arms", (0, 0, .90), (.84, .14, .16), "gold", root)
        sphere("Cross gem", (0, -.10, .90), (.08, .04, .08), "soul", root)
    elif name in ("frost", "glacier", "focus", "xp"):
        for i in range(3 if name != "xp" else 1):
            x = (i - 1) * .28 if name != "xp" else 0
            mesh("Frost crystal", [(x, 0, 1.4), (x - .18, -.13, .5), (x + .18, -.13, .5), (x + .18, .13, .5), (x - .18, .13, .5), (x, 0, .17)],
                 [(0, 1, 2), (0, 2, 3), (0, 3, 4), (0, 4, 1), (5, 2, 1), (5, 3, 2), (5, 4, 3), (5, 1, 4)], "soul", root)
    elif name in ("grave", "soulstorm", "bone"):
        sphere("Relic skull", (0, 0, .80), (.40, .28, .43), "boneedge", root)
        for side in [-1, 1]:
            sphere("Skull socket", (side * .16, -.255, .86), (.11, .04, .12), "iron", root)
        box("Skull jaw", (0, -.10, .48), (.55, .33, .19), "bone", root)
    elif name in ("storm", "tempest", "wrath"):
        cylinder("Hammer haft", (0, 0, .55), .06, 1.10, "leather", root)
        box("Storm hammer", (0, 0, 1.13), (.78, .37, .38), "steel", root)
        box("Hammer rune", (0, -.195, 1.13), (.075, .025, .26), "soul", root)
    elif name in ("thorn", "worldthorn", "swift", "magnet"):
        for i in range(9):
            a = TAU * i / 9
            b = TAU * (i + 1) / 9
            link("Thorn halo", (.43 * math.cos(a), 0, .75 + .43 * math.sin(a)), (.43 * math.cos(b), 0, .75 + .43 * math.sin(b)), .045, "moss", root)
            link("Thorn", (.43 * math.cos(a), 0, .75 + .43 * math.sin(a)), (.62 * math.cos(a), 0, .75 + .62 * math.sin(a)), .024, "gold", root)
    elif name in ("bloodwell", "crimson", "vitality", "meat"):
        sphere("Crimson relic", (0, 0, .74), (.32, .23, .43), "blood", root)
        for side in [-1, 1]:
            sphere("Heart lobe", (side * .18, 0, 1), (.23, .23, .23), "blood", root)
        box("Reliquary band", (0, -.245, .79), (.06, .04, .57), "gold", root)
    elif name == "gold":
        for i in range(3):
            o = cylinder("Coin", ((i - 1) * .25, i * .03, .68 + i * .05), .25, .05, "gold", root, 16)
            o.rotation_euler.x = math.pi / 2
    elif name == "chest":
        box("Relic chest", (0, 0, .57), (.96, .55, .60), "leather", root)
        sphere("Chest lid", (0, 0, .86), (.49, .29, .18), "leather", root)
        for x in [-.32, .32]:
            box("Chest band", (x, -.285, .58), (.10, .04, .61), "gold", root)
        box("Chest clasp", (0, -.31, .71), (.15, .045, .18), "gold", root)
    return root


def render_icons():
    names = ["oathblade", "holy", "firebrand", "frost", "storm", "thorn", "bloodwell", "grave",
             "crown", "judgment", "dragon", "glacier", "tempest", "worldthorn", "crimson", "soulstorm",
             "might", "rage", "vitality", "swift", "focus", "faith", "wrath", "magnet", "xp", "gold", "meat", "chest", "bone"]
    dest = BUILD / "icons"; dest.mkdir(exist_ok=True)
    for name in names:
        scene = setup(96, 2.05)
        # Icon framing centers each object instead of placing it at character feet.
        icon(name)
        scene.render.filepath = str(dest / (name + ".png"))
        if opts.force or not Path(scene.render.filepath).exists():
            bpy.ops.render.render(write_still=True)
        bpy.ops.wm.save_as_mainfile(filepath=str(SOURCES / ("icon_" + name + ".blend")))
    bpy.ops.wm.save_as_mainfile(filepath=str(SOURCES / "icon_studio.blend"))
    print("ICONS_DONE", len(names), flush=True)


def render_effects():
    for kind, mat in [("frost", "soul"), ("bone", "bone"), ("holy", "gold")]:
        dest = BUILD / ("effect_" + kind); dest.mkdir(exist_ok=True)
        scene = setup(96, 2.8)
        aim = Vector((0, 0, .35))
        theta = math.radians(55)
        scene.camera.location = aim + Vector((0, -10 * math.sin(theta), 10 * math.cos(theta)))
        scene.camera.rotation_euler = (aim - scene.camera.location).to_track_quat("-Z", "Y").to_euler()
        shards = []
        for i in range(9):
            a = TAU * i / 9
            shard = sphere("Fragment", (0, 0, .35), (.08, .06, .13), mat, segments=8)
            shards.append((shard, a, shard.scale.copy()))
        for frame in range(8):
            phase = frame / 7
            for shard, a, scale in shards:
                r = .18 + phase * .82
                shard.location = (math.cos(a) * r, math.sin(a) * r, .35 + math.sin(phase * math.pi) * .22)
                shard.rotation_euler = (phase * 3, a, phase * 2)
                shard.scale = scale * (.25 + math.sin(phase * math.pi) * 1.1)
                for prop in ["location", "rotation_euler", "scale"]:
                    shard.keyframe_insert(data_path=prop, frame=frame + 1)
            scene.frame_set(frame + 1)
            scene.render.filepath = str(dest / f"{frame:02d}.png")
            if opts.force or not Path(scene.render.filepath).exists():
                bpy.ops.render.render(write_still=True)
        scene.frame_end = 8
        scene.frame_set(3)
        bpy.ops.wm.save_as_mainfile(filepath=str(SOURCES / ("effect_" + kind + ".blend")))
    print("EFFECTS_DONE", flush=True)


palette()
setup(128, 3.4)
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCES / "render_template.blend"))
actors = ["aldric", "skeleton", "mara", "hollow", "slime", "bat", "wight", "shade", "golem", "duke", "hydra", "dawneater"]
started = time.perf_counter()
for name in actors:
    if "all" in SELECTED or name in SELECTED:
        render_actor(name)
if "all" in SELECTED or any(n in SELECTED for n in ["props", "pillar", "shrine"]):
    render_props()
if "all" in SELECTED or "floor" in SELECTED:
    render_floor()
if "all" in SELECTED or "icons" in SELECTED:
    render_icons()
if "all" in SELECTED or "effects" in SELECTED:
    render_effects()
print("EXPORT_DONE", round(time.perf_counter() - started, 1), "seconds", flush=True)
