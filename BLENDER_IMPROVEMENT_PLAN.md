# Oathbound — Blender improvement plan

## Direction

Use Blender to build reusable models, animate them, and render them into 2D assets for the existing browser game. The intended result is a richer ruined keep, expressive knights, and clearer boss attacks, with the speed and accessibility of the current Canvas game.

Keep the illustrated dark-fantasy look established by `title.jpg` and the current character images: steel armor, crimson cloth, bone, weathered stone, cold moonlight, and restrained gold. Favor strong silhouettes and broad shading over fine surface detail that disappears at gameplay size.

The browser implementation is now in place: animated knights, enemies, and bosses; a modular courtyard kit; item icons; and short impact effects. See [the art workflow](art/README.md) for regeneration commands and measured verification results, and [the gallery](art/preview.html) to inspect animations. The phases below remain the design rationale and a guide for further art refinement.

## Browser versus native decision

Decision: keep Oathbound in the browser. The Blender renders are integrated into the existing Canvas game, and the final headless crowded-scene comparison met the proposed JavaScript frame-time budget.

A native release could offer more performance headroom, but there is no benchmark yet establishing that the browser is Oathbound's limiting factor. The current implementation uses Canvas 2D. Moving to a GPU-batched sprite renderer, either in the browser or in a native engine, may matter more than changing the application packaging.

For the current 2D scope, first measure a crowded scene and improve the expensive parts. Candidate areas visible in the code include repeated wall resolution, per-frame sorting and temporary draw-list objects, regenerated gradients, and HUD DOM writes every gameplay frame. These are profiling candidates, not confirmed bottlenecks. The code already uses a spatial hash for nearby-enemy queries.

If the intended direction is a larger desktop game with richer effects, lighting, controller support, and more content, evaluate a small Godot 2D prototype before expanding the art implementation. Recreate movement, one weapon, and a matched 340-enemy stress scene; compare frame time and memory on the same machine. Porting all gameplay, menus, and saves is a separate substantial project. Wrapping the existing web game as a desktop app does not itself demonstrate a rendering speedup.

The proposed Blender sprite pipeline can serve either route. If the direction changes to real-time 3D instead, revise the asset specifications around meshes, rigs, materials, and engine imports before producing the full sprite library.

See [Godot's rendering optimization guidance](https://docs.godotengine.org/en/stable/tutorials/performance/gpu_optimization.html) for batching and measurement, and [MDN's Canvas optimization guidance](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Optimizing_canvas) for caching repeated drawing work.

## What the project currently supports

Reviewed `README.md`, `js/game.js`, `index.html`, `css/style.css`, existing sprite images, and an early-run browser screenshot.

- The game uses Canvas 2D, with three knights, eight weapons and their evolutions, shrines, a Red Hour mode, and three bosses.
- Characters and enemies each use a single PNG. `knightPose()` and `enemyPose()` animate those images through bobbing, rotation, and stretching.
- `drawWall()`, `drawPillar()`, `drawShrine()`, and `drawPickup()` mostly draw simple shapes. The floor repeats one 256 × 256 texture.
- The keep is 936 × 936 world units, with four 156-unit gate openings. Objects are sorted by their ground-level Y coordinate.
- Knights draw at 72 world units tall; regular enemies at 24–88; bosses at 124–156. At smaller viewports, camera zoom reduces those further. Assets must be judged at these sizes.
- The enemy limit is 340, so animation and transparency need a measured browser budget.
- Boss AI already has phases and attack states. Art can communicate these existing behaviors without first redesigning combat.
- The sprite-processing scripts use old `/home/jason/...` paths and magenta-background cleanup. A new render pipeline should use project-relative paths and native transparency.

## Build order

| Step | Deliverable | Improvement | Completion gate |
| --- | --- | --- | --- |
| 1. Art sample and export pipeline | Animated Aldric, a skeleton, a ruined pillar, one shrine, and a floor sample | Establishes a consistent style and proves the Blender-to-browser workflow | Looks coherent at gameplay size; animation works without foot sliding; browser cost is acceptable |
| 2. Courtyard | Modular walls, gate surrounds, pillars, floor variants, and shrine states | Makes the keep feel like a place and makes routes easier to recognize | Art matches collision footprints; entrances, pickups, and warnings stay readable |
| 3. Boss presentation | Wailing Duke, Bone Hydra, and Dawn Eater animations | Makes fights more expressive and attacks easier to learn | Poses agree with actual AI timing, hit areas, and phase changes |
| 4. Remaining cast | Mara, Hollow, and remaining enemy families | Gives characters distinct motion and enemies recognizable identities | Every character is identifiable in a crowd; animation states transition cleanly |
| 5. Weapons and interface assets | Weapon renders, pickup art, blessing icons, and selective effects | Makes builds and rewards feel part of the same world | Icons read at small size; player effects preserve the visibility of enemy attacks |

## 1. Prove the pipeline with one playable sample

Create a shared Blender scene with a fixed orthographic camera, lighting, scale guide, and material palette. Match the game's current view with a camera looking down at the scene, with no horizontal rotation of the ground axes. Compare renders in the running game before locking the camera angle.

Model Aldric from his existing design: enclosed helmet, red cape, shield, and recognizable sword. Use a simple rig with deliberately animated cloth; the pilot does not need a cloth simulation. Model a skeleton using compatible proportions and a reusable humanoid rig where practical.

Initial animation scope:

- Aldric: idle, run, dash, hurt, and death. Add a sword gesture only where an existing gameplay event supports it; his orbiting blades remain independent weapons.
- Skeleton: locomotion, hurt, and death. Its current contact damage does not require inventing a timed melee attack.
- Begin with one useful viewing direction to prove animation and framing, then expand Aldric to four directions. Render distinct left/right views where mirroring would swap equipment.

Starting export settings, to be adjusted after the sample:

- Fixed 128 × 128 cells for knight and small-enemy frames; 256 × 256 for boss frames.
- Roughly 4 idle frames, 8 locomotion frames, and 3–6 frames for short actions. Use per-animation timing rather than one playback speed for everything.
- Transparent RGBA PNGs, consistent lighting and color management, padded atlas cells, and an identical foot anchor across every frame.
- Keep shadows separate from character renders initially: the game already draws ground shadows.
- Frame the complete animation bounds, including weapons and cape. Avoid per-frame cropping, which makes characters jitter.

Add an atlas manifest containing frame rectangles, foot anchors, display scale, directions, clip durations, and loop flags. Change `drawSprite()` to select a source rectangle from an atlas. Choose directions from movement, and choose action clips from existing gameplay state. Remove procedural stretching for atlas-animated actors to avoid animating them twice.

Use elapsed game time for animation. Dash and boss action clips must follow their actual action timers; cosmetic animation must not change hit timing. Retain the current image fallback when an atlas fails to load.

**Pilot acceptance:** Aldric and a skeleton animate in the existing courtyard; the test pillar and shrine fit the current art; sprite feet stay attached to their world positions; no alpha fringe is visible on a dark background.

## 2. Give the courtyard a stronger identity

Build a compact modular kit:

- Straight wall sections, corner pieces, broken wall variants, and gate-side structures.
- Two ruined pillar variations fitted to current pillar collision radii.
- Quiet paving, cracked paving, edge rubble, and a central oath seal.
- A shared shrine pedestal with distinct ornaments for each existing shrine kind, plus lit and exhausted states.
- Decorative banners, gravestones, and braziers around the arena boundary.

Render floor tiles from above and props with the same camera used for characters. Use subtle floor variations and larger worn patches to reduce obvious repetition. Put ornate details toward the edges; the central combat area needs a calm background.

Integrate through the existing wall, pillar, shrine, and gate draw functions. Bake static floor details into a cached layer, but keep tall props in the existing Y-sorted draw list. Export wall orientations separately instead of stretching one image across every side.

Match artwork to the existing four gate gaps and obstacle footprints. Place decorative rubble outside movement routes unless it also receives an explicit collision definition. Use shortened foreground walls or fading when necessary so tall art does not hide the knight, warnings, or pickups. Check the top wall against the HUD, which overlaps the arena in the early-run capture.

**Courtyard acceptance:** gates remain obvious spawn entrances; shrine states read without depending only on color; sprites do not appear to walk through solid stone or get blocked by empty space.

## 3. Make bosses communicate their attacks

Build the Duke first because his existing windup and attack states give a clear integration target.

| Boss | Blender animation work | Integration requirement |
| --- | --- | --- |
| Wailing Duke | Heavy walk, charge anticipation, forward charge, raised-weapon slam, recovery, phase poses | Anticipation follows `tel`; charge follows `go`; slam pose follows `slam`. Match the existing 0.55-second charge warning and slam timing |
| Bone Hydra | Independent head motion, spit gesture, lunge, split transition, smaller offspring variation | Follow the current projectile volleys and lunge state. The current lunge begins as its line appears; improving advance warning requires an explicit AI change as well as animation |
| Dawn Eater | Hover, meteor casting, enraged movement, phase transition, collapse | Casting follows actual meteor creation and phase-dependent warning duration; rendered effects must leave the target circles visible |

Use silhouettes and poses as well as color: a lifted weapon for a slam, lowered body for a charge, and an extended casting limb for a meteor. Phase changes can reveal brighter cracks, torn cloth, or additional bone detail.

Keep attack telegraphs in the game renderer so their size and timing continue to reflect the collision rules. Blender-rendered impacts and particles can support them. Brief death animation should be cosmetic after gameplay death; it must not delay rewards or make a defeated boss appear dangerous.

**Boss acceptance:** each warning is visible against both night and dawn backgrounds; the pose accurately predicts the move; effects do not obscure the safe route.

## 4. Expand the animated cast

Finish Mara and Hollow after the Aldric rig and export conventions are proven. Give Mara a fast, light gait and cross-planting dash pose; give Hollow a slow, heavy gait and a blood-trail dash pose. Preserve their existing speed, health, unlock costs, and dash mechanics while implementing the art.

Produce enemy families in this order:

1. Slime and mite: a squash-and-stretch loop, with the mite derived from the same model.
2. Bat: a true wing cycle and a distinct silhouette at its small display size.
3. Wight and shade: separate drifting and charging motion; preserve warning-state visibility.
4. Golem: heavy planted steps and a readable slam anticipation.

Share rigs and materials where appropriate, but keep the silhouettes distinct. Use independent animation phase offsets so a horde does not move in lockstep. Start common enemies with fewer directions than knights and add more only when visibly useful.

## 5. Tie weapons, rewards, and menus together

Render recognizable models for the Oathblade, Holy Cross, Frost Lance, Storm Hammer, skull projectiles, and their evolved variants. Reuse these models for consistent blessing-card and weapon-dock icons. Replace remaining weapon and virtue symbols in a later matching icon pass.

Replace the small generic pickup shapes with readable soul, coin, ration, and chest assets. Small objects need exaggerated silhouettes rather than realistic detail.

Use Blender for short impact sheets, frost shatters, bone bursts, and shrine activation flashes. Keep cheap procedural trails and warning outlines where they already serve the game well. Limit simultaneously active decorative effects.

Polish the title scene or add a brief dawn tableau only after the playable assets work. The existing title illustration is already a strong style reference; menus are a lower priority than the courtyard and combat animation.

## Proposed source layout and automation

```text
art/blender/
  render_template.blend
  characters/
  enemies/
  bosses/
  environment/
  weapons/
tools/blender/
  render_assets.py
tools/pack_atlases.py
assets/atlases/
assets/environment/
assets/icons/
assets/asset-manifest.json
```

Keep editable `.blend` sources and final exports together in a documented pipeline; temporary frame renders can live in an ignored build directory. Resolve paths from the project root and record render settings in the exporter.

Blender supports background rendering and PNG animation output from its CLI. Use scripted exports so regenerating an asset does not depend on manually clicking through render settings. See the [Blender command-line documentation](https://docs.blender.org/manual/de/5.1/advanced/command_line/arguments.html). Orthographic projection is documented in the [camera manual](https://docs.blender.org/manual/nb/5.1/render/cameras.html), and the [alpha glossary](https://docs.blender.org/manual/en/3.6/glossary/index.html) explains PNG transparency conventions.

## Validation and budget gates

Measure the current version on this machine before integrating the pilot. The following are proposed targets, not measured performance claims:

- Compare frame time before and after at matched resolution, enemy count, and effects. Aim for a 60 FPS median and no more than a 10% frame-time regression in a repeatable busy-scene comparison.
- Inspect scenes with 100 enemies, the 340-enemy cap, and a boss with evolved weapons. A fixed preview/stress mode would make these comparisons repeatable.
- Budget the pilot's loaded atlases below 64 MiB of decoded RGBA data. A 2048 × 2048 RGBA atlas costs about 16 MiB before browser overhead. Image file compression does not remove that decoded cost.
- Load shared environment assets and the selected knight first. Load later enemy/boss groups ahead of their arrival. Set the full-run memory and download budgets after measuring the pilot.
- Check native gameplay sizes, 1280 × 720, and a smaller viewport; do not approve an asset only from a large Blender render.
- Check foot anchors, cell padding, dark-background alpha edges, facing transitions, wall occlusion, and silhouette contrast.
- Run the existing `?boot=test` self-test after integration, then exercise dash, shrines, pickups, each boss phase, knight selection, Red Hour, and the dawn transition.

## Recommended first milestone

Deliver one playable art sample: animated Aldric and skeletons, a quiet floor sample, a ruined pillar, and one shrine. Include editable Blender sources, a repeatable export command, atlas metadata, and before/after browser captures with frame-time measurements.

Once that sample meets the style and performance gates, complete the courtyard, then the Duke. Those milestones give Oathbound a stronger visual identity and a more readable signature fight before expanding production to the whole cast.
