"""Small device/render check; run with Blender's bundled Python."""
import bpy
import time

scene = bpy.context.scene
scene.render.engine = "BLENDER_EEVEE"
scene.render.resolution_x = scene.render.resolution_y = 128
scene.render.resolution_percentage = 100
scene.render.film_transparent = True
scene.render.image_settings.color_mode = "RGBA"
if hasattr(scene, "eevee") and hasattr(scene.eevee, "taa_render_samples"):
    scene.eevee.taa_render_samples = 8
for frame in range(2):
    scene.render.filepath = f"/tmp/oathbound-render-probe-{frame}.png"
    started = time.perf_counter()
    bpy.ops.render.render(write_still=True)
    print("PROBE", frame, round(time.perf_counter() - started, 2), flush=True)
