# Oathbound session handoff

Updated September 30, 2026.

## Start here

- Project: `/home/batquick/Projects/oathbound`
- GitHub: <https://github.com/jasonjaynelson/oathbound>
- Remote: `git@github.com:jasonjaynelson/oathbound.git`
- Branch: `main`

This update contains the six gameplay/presentation improvements, Lady Mara's Blender model and spell kit, verification artifacts, and this handoff. The user authorized committing and pushing the completed work. All requested implementation is complete; wait for their next direction before starting new work. Check `git status --short --branch` and `git log -1 --oneline` when resuming, and preserve any newer changes. The update was built on `14834b1` (Blender artwork, expanded arena, keyboard blessings).

Keep the game in the browser: plain JavaScript and Canvas 2D, no build step. Blender authors offline assets and is not required to play. No site deployment or GitHub Pages configuration was performed.

## Play and controls

Run `./play.sh` from the repository. It serves port 8765 and opens a Chromium app. Alternatively:

```bash
python3 -m http.server 8765 --bind 127.0.0.1
```

- Main game: <http://127.0.0.1:8765/>
- Direct play: <http://127.0.0.1:8765/?boot=play>
- Built-in self-test: <http://127.0.0.1:8765/?boot=test> — title becomes `PASS`.
- Animation gallery: <http://127.0.0.1:8765/art/preview.html>
- Fallback-art comparison: <http://127.0.0.1:8765/?art=legacy>

Do not assume a server survives between sessions. Refresh existing game windows after code/asset updates. Saves use `oathbound_v1` in localStorage and are specific to browser profile and origin, including the port. Existing gold, champion unlocks/selection, upgrades, and records are preserved; new settings, challenges, and modifier fields receive defaults.

WASD/arrows move; Shift/Space dash; mouse aims directional weapons; Esc/P pause. Blessings accept 1–3, click, or arrows plus Enter/Space, with wrapping and protection against held Enter accepting consecutive popups. **E** immediately accepts a nearby landmark encounter. **R** or the reroll button spends a blessing reroll. Settings are available on title and pause screens. The character menu is now called **Champions**.

## Completed improvements

1. **Exploration:** four landmarks, each with an optional encounter accepted within 130 units. Chapel (850,850): spend 20 seconds inside its defense circle; progress pauses outside. Graveyard (2750,850): destroy a summoning altar. Armory (850,2750): defeat a named elite golem champion. Breached Gate (2750,2750): clear three assault waves. Each pays 50 run gold and a build blessing once per vigil; chapel also grants a shield. At the enemy cap, altar/champion acceptance defers with a visible message.
2. **Combat clarity:** player locator and crowded-scene glow/sprite overlay, bounded aggregated damage numbers, visible hostile projectiles, and attack warnings above actors/effects. Extra charge strokes prioritize four threats; ground hazards remain visible. Damage attribution follows the original weapon/effect and excludes overkill. Fatal hit sources are recorded.
3. **Navigation:** minimap shows unexplored hints, discovered landmarks/shrines, completed encounters, ready/spent shrines, player, viewport, and bosses. Offscreen bosses have directional indicators. Below 70% health, the nearest discovered ready healing shrine also gets an indicator.
4. **Build choices:** numeric base-stat changes and evolution progress. `weaponRankStats()` supplies combat and previews. Three rerolls per run, +1 after Transfiguration, +1 with Pilgrim. Event blessings exclude heal/gold filler; a fully mastered build receives Relic Tempering (+5% run damage).
5. **Atmosphere:** landmark-specific paving, rubble, graves, banners, props, and colored lighting. Web Audio synthesizes footsteps, metal impacts, enemy voices, wind, boss accompaniment, and dawn music locally. Settings control volume, screen shake, and combat numbers; first-save shake defaults respect system reduced-motion preferences.
6. **Replay:** one-time challenge rewards and unlockable modifiers. Keep Warden: two encounters in one run, 150 gold, unlock Siege. Wayfarer: discover four landmarks in one run, 100 gold, unlock Pilgrim. Transfiguration: evolve a weapon, 100 gold, +1 permanent reroll. Siegebreaker: win Siege, 250 gold, completion trophy. Awards settle when a vigil ends and cannot pay twice. Siege adds 20% spawn rate and 25% run gold; Pilgrim adds 15% speed, reduces max HP by 20%, and grants a reroll. Either can combine with Red Hour. End reports show weapon damage, encounters, modifier, challenges, and fatal hit/abandonment.

The keep remains finite: 3200×3200 playable courtyard in a 3600×3600 world, centered at (1800,1800), with camera following. Enemy cap: 340. Boss arrivals: Duke 3:00, Hydra 6:00, Dawn Eater 8:30. Hydra lunges have a 0.28-second warning.

## Lady Mara: second unlock

The user requested an attractive adult gothic mage with a Morticia-inspired gown, made in Blender with new abilities. **Lady Mara** replaces Sister Mara while retaining save/actor ID `mara` and the **500-gold** unlock. Existing Mara unlocks and selection continue to work.

- Appearance: fitted midnight gown with V neckline and bell sleeves, long raven hair, pale face, amethyst jewelry, silver trim, and crescent staff.
- **Hex:** her starting weapon. Seeking violet curses snare the direct target and splash nearby enemies.
- **Nightbloom:** Hex rank 6 + Focus evolution; three seeking curses and much wider bursts (a fourth curse at rank 7).
- **Veilstep:** dash leaves a stationary snaring/damaging sigil for 2.5 seconds, while normal dash invulnerability provides escape.
- **Witchblood:** Hex, Nightbloom, and sigil kills heal 1 HP each, capped at three heals per one-second window and maximum HP. Other weapon kills do not heal; the passive cannot revive a dead mage.

Editable scene: `art/blender/mara.blend`. Six clips (idle, run/glide, dash, hurt, death, cast), four directions, 124 frames, 192-pixel source resolution. Gown and hair have independently keyed pivots. Separate spell models: `art/blender/icon_hex.blend`, `icon_nightbloom.blend`. The full art set has 726 actor frames, 12 actor atlases, and 31 item icons. Matching portrait/fallback sprites are installed. The champion card explains her abilities.

## Implementation map

- `js/game.js`: gameplay, input, rendering, audio, saves, menus, self-test. Content arrays: `LANDMARKS`, `CHALLENGES`, `MODIFIERS`, `CHARS`, `WEAPONS`, `EVOS`.
- Encounters: `startEncounter()`, `finishEncounter()`, `updateExploration()`; state in `encounters`.
- Presentation/navigation: `drawLandmarkGround()`, `drawScenery()`, `drawThreatWarnings()`, `drawPlayerLocator()`, `drawNavigation()`, `paintExplorationHud()`.
- Builds/replay: `weaponRankStats()`, `rankPreview()`, `evolutionProgress()`, `rerollBlessings()`, `renderBlessings()`, `awardChallenges()`, `renderChallenges()`.
- Mage: Hex/Nightbloom branch in `weaponTick()`, `hexBurst()`, Mara branch in `knightDash()`, veil branch in `updateZones()`, and Witchblood in `killEnemy()`. Projectile/zone sources preserve run-report attribution. Explosions use a separate spatial-query buffer to avoid disrupting projectile collision iteration.
- `js/art.js`: manifest/image loading, animation selection, props, cached ground/walls, icons, and fallbacks.
- `index.html`, `css/style.css`: HUD, champion cards, blessings, settings, challenges, and reports.
- `assets/asset-manifest.json`, `assets/atlases/`, `assets/environment/`, `assets/icons/`, `assets/sprites/`: runtime art.
- `README.md`: player instructions. `IMPROVEMENT_PLAN.md`: accepted scope and validation. `art/README.md`: asset workflow. `BLENDER_IMPROVEMENT_PLAN.md`: historical original art plan; its old arena size is obsolete.

## Verification completed

JavaScript syntax checks, Python compilation, and `git diff --check` passed. Browser suites use isolated profiles and leave user saves untouched. No production debug hooks were added.

- Built-in self-test: PASS.
- `tools/check_browser.cjs`: PASS — all champion dashes, boss phases, Hydra warning/lunge/split, shrines, gallery, missing-atlas fallback, and small viewport; no runtime errors.
- `tools/check_arena.cjs`: PASS at 854×480, 1280×720, 1920×1080, 3840×2160, and 5120×1440 — world travel, camera following/bounds, boundary collision, offscreen spawning, and scenery placement.
- `tools/check_improvements.cjs`: PASS — migration, immediate E acceptance, all four encounters, guaranteed/repeat-safe rewards, rerolls, damage aggregation/attribution, overkill exclusion, all **18** base/evolved weapons, evolution trigger, one-time challenge payouts across runs, modifier tradeoffs/payouts, persistent settings/rewards, real meteor fatal-source reporting, starting-build altar combat, and capacity handling.
- `tools/check_mage.cjs`: PASS — real 500-gold purchase, existing Mara save/selection compatibility, homing/splash/snare, casting, stationary Veilstep/expiry, healing cap/reset/overheal protection, Nightbloom, four directional clip sets, gallery, and matching fallback art.
- Saved Blender scene check: re-exported all six east-facing cast frames with `export_scene.py`; they matched the generated frames exactly. Packer found no empty or edge-clipped frames.
- Screenshots reviewed for landmarks, crowded combat, champion selection, blessings, reports, gallery, mage spells/fallback, 854×480, and 390×740 layouts. Compact desktop blessings fit the controls; phone-sized panels scroll.

Reports and screenshots: `art/verification/improvements-report.json`, `mage-report.json`, `blender-report.json`, and corresponding PNGs. Latest headless 1280×720 JavaScript update/render submission: 100 enemies, 4.4 ms median / 6.5 ms p95; 340 enemies, 7.6 ms median / 10.7 ms p95. These are not GPU completion or real-display FPS measurements. Actor atlases total 36.34 MiB decoded; all images loaded during verification used 45,173,984 decoded bytes, excluding ground/wall canvases and browser overhead. The 3200-square RGBA floor cache alone is about 39 MiB.

Browser automation verifies audio construction/settings, rather than human listening quality. Long-term encounter/build balance should continue to be evaluated in normal play.

Run checks with the local server up:

```bash
NODE_PATH=/home/batquick/Projects/crosswake/node_modules OATHBOUND_URL=http://127.0.0.1:8765/ node tools/check_mage.cjs
NODE_PATH=/home/batquick/Projects/crosswake/node_modules OATHBOUND_URL=http://127.0.0.1:8765/ node tools/check_improvements.cjs
NODE_PATH=/home/batquick/Projects/crosswake/node_modules OATHBOUND_URL=http://127.0.0.1:8765/ node tools/check_browser.cjs
NODE_PATH=/home/batquick/Projects/crosswake/node_modules OATHBOUND_URL=http://127.0.0.1:8765/ node tools/check_arena.cjs
```

Chromium: `/usr/bin/chromium`. The browser/arena scripts default to the historical port-8876 URL unless `OATHBOUND_URL` is set. They rewrite verification artifacts. Headless Chromium needs execution outside restricted filesystem/process sandboxes on this machine.

## Blender workflow

Local Blender: 5.2.1 LTS. **Procedural generation rebuilds source scenes and can overwrite manual model edits.** Use `export_scene.py` for manually edited scenes. Preserve root names, animation markers, source camera, and foot anchors. Intermediate files in `art/build/` and `.blend1` backups are ignored.

Regenerate Mara and her icons:

```bash
blender --factory-startup --background -noaudio --python-exit-code 1 --python tools/blender/render_assets.py -- --only mara,hex,nightbloom --force
blender --factory-startup --background -noaudio --python-exit-code 1 --python tools/blender/render_portrait.py -- --actor mara
python3 tools/pack_atlases.py --only mara,hex,nightbloom
cp assets/atlases/mara-portrait.png assets/sprites/mara.png
```

For manual edits, replace the first command with `export_scene.py --actor mara`, then regenerate the portrait and pack `--only mara`. The portrait renderer reads the saved scene and uses a separate 640-pixel beauty render without modifying its source camera. Regenerate the portrait after model edits.

`--only` packing preserves other manifest entries/assets, so it works for targeted updates without all intermediate frames. A fresh checkout still must generate the selected intermediate assets before packing. Full `render_assets.py -- --only all` plus unrestricted `pack_atlases.py` rebuilds the complete set; use it only when that scope is intended.
