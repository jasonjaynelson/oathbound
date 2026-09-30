# Oathbound art workflow

Oathbound continues to run in the browser with Canvas 2D. Blender is the asset authoring and offline rendering tool.

The current asset set includes 726 animation frames across 12 actor atlases, three paving variants, 15 environment props, 31 weapon/virtue/pickup icons, and three eight-frame impact sheets. The mite uses the slime atlas. Each actor has an editable `.blend` scene with an articulated joint hierarchy, keyed transforms, named animation markers, camera, lights, and embedded materials.

## View and play

Run `./play.sh`, or serve this project with:

```bash
python3 -m http.server 8765 --bind 127.0.0.1
```

Open `http://127.0.0.1:8765/` to play, or `http://127.0.0.1:8765/art/preview.html` for the interactive animation gallery. The gallery lets you inspect movement, facing, damage, death, and boss action clips. Its images are enlarged for inspection; judge final sharpness in the game too.

Add `?art=legacy` to the game URL to compare the original art. Missing atlases automatically fall back to original actor images.

## Generate the procedural models and renders

Requires Blender and Python with Pillow. Paths resolve relative to the project, so the pipeline works from another checkout location.

```bash
blender --factory-startup --background -noaudio --python-exit-code 1 \
  --python tools/blender/render_assets.py -- --only all
python3 tools/pack_atlases.py
```

The model generator rebuilds the source `.blend` files. It reuses existing frame PNGs unless `--force` is supplied. Use a narrower selection while iterating:

```bash
blender --factory-startup --background -noaudio --python-exit-code 1 \
  --python tools/blender/render_assets.py -- --only mara,duke --force
python3 tools/pack_atlases.py
```

Selections include actor names, `props`, `floor`, `icons`, and `effects`. Intermediate renders live in ignored `art/build/`; the browser loads only the packed files in `assets/`.

## Export a manually edited actor

Open an actor in `art/blender/`, edit its meshes/materials or keyed joint transforms, and save it. Preserve its root object name, animation markers, and export camera framing. Use the scene exporter rather than the model generator to preserve manual edits:

```bash
blender --factory-startup --background -noaudio --python-exit-code 1 \
  --python tools/blender/export_scene.py -- --actor aldric
python3 tools/pack_atlases.py
```

An optional `--file` selects another saved `.blend`. For a limited test export, `--clip`, `--direction`, and `--output` can restrict the work. Run a complete export before packing a fresh checkout. The generator and scene exporter share the same source-frame specifications, fixed foot anchor, and browser display scale. The packer crops to the union of all animation bounds, preserving one stable anchor, and adds transparent cell padding.

## Lady Mara, the gothic mage

The second unlock keeps actor/save ID `mara` and the 500-gold price. Her original adult gothic design uses a fitted midnight satin gown with a V neckline, bell sleeves, raven hair, silver piping, an amethyst choker, and a crescent staff. The dedicated `gothic_mage()` builder in `tools/blender/render_assets.py` creates smooth editable gown/hair meshes and curve details. The gown and hair have independent animated pivots. Her atlas has 124 frames at 192×192 source resolution: idle, run/glide, dash, hurt, death, and cast in four directions. All export framing uses the existing foot anchor contract.

Generate only her model and spell icons, then make her portrait and pack without rewriting the rest of the art manifest:

```bash
blender --factory-startup --background -noaudio --python-exit-code 1 --python tools/blender/render_assets.py -- --only mara,hex,nightbloom --force
blender --factory-startup --background -noaudio --python-exit-code 1 --python tools/blender/render_portrait.py -- --actor mara
python3 tools/pack_atlases.py --only mara,hex,nightbloom
cp assets/atlases/mara-portrait.png assets/sprites/mara.png
```

For manual model edits, export with `export_scene.py --actor mara`, then regenerate the portrait and pack with `--only mara`. The portrait renderer reads her saved scene and uses a separate 640-pixel beauty render; it does not modify the gameplay source camera. Regenerate the portrait after changing the model. The matching fallback sprite is copied from the new portrait, so missing atlases and `?art=legacy` keep the mage's appearance.

Spell icons have their own editable `icon_hex.blend` and `icon_nightbloom.blend` scenes. Their combat effects remain procedural Canvas geometry. `tools/check_mage.cjs` verifies purchase/save compatibility, homing/splash/snare behavior, Veilstep, Witchblood healing limits, evolution, clips, gallery, and fallback; artifacts are under `art/verification/mage-*`.

## Browser integration

`js/art.js` handles the manifest, image loading, frame selection, props, cached walls and paving, and icons. `js/game.js` continues to own gameplay. It supplies actor state and a visual clock that pauses with gameplay. The selected knight and early enemies preload; later enemies load on demand, and bosses preload before arrival.

Attack warning shapes stay procedural and follow gameplay geometry. The Hydra now warns for 0.28 seconds before starting its lunge. Cosmetic corpse and impact counts are capped. Death animation does not delay rewards.

The cast's atlases now total 36.34 MiB decoded, including the higher-resolution mage. The following totals and benchmark table describe the original Blender set before the mage update; current measurements are in `art/verification/blender-report.json`. Loading every actor, floor tile, prop sheet, icon, and effect in verification used about 34.46 MiB of decoded image data, excluding original fallback sprites, cached canvases, and browser overhead. Packed browser asset files total about 4.6 MiB on disk; normal gameplay initially loads a subset.

## Verification

The existing game self-test is available at `?boot=test`. The browser verification script requires Playwright and an installed Chromium:

```bash
node tools/check_browser.cjs
```

Set `OATHBOUND_URL` when the local server uses another address, and use `NODE_PATH` if Playwright is installed elsewhere. The script checks the self-test, all knight dashes, boss phases, Hydra warning/lunge/split, shrines, missing-atlas fallback, the gallery, and a smaller viewport. It captures screenshots and a JSON report under `art/verification/`.

Measured in headless Chromium at 1280 × 720, DPR 1:

| Scene | Original render median | Blender render median | Original full frame median | Blender full frame median |
| --- | --- | --- | --- | --- |
| 100 enemies | 2.3 ms | 2.0 ms | 3.3 ms | 3.0 ms |
| 340 enemies | 3.8 ms | 3.4 ms | 6.2 ms | 5.6 ms |

These are JavaScript frame submission measurements, not GPU completion times or displayed FPS guarantees. The scenes include a Duke and evolved weapons; the full-frame measurements include simulation. Final browser checks passed with no runtime errors. The packer reported no empty or clipped actor frames.
