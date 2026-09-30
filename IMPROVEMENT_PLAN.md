# Oathbound improvement plan

Scope: complete the six improvements approved September 30, 2026. Keep the browser game, existing art, keyboard blessings, and `oathbound_v1` saves.

1. Exploration: four visually distinct landmarks (chapel, graveyard, armory, breached gate), each with a discoverable, optional encounter and a guaranteed build blessing on completion. Show clear start instructions, progress, and rewards; encounters cannot reward twice.
2. Combat clarity: persistent knight silhouette/locator, aggregated damage numbers, enemy warnings above actors/effects, and readable hostile projectiles. Track actual damage by its originating weapon and actual fatal hit source.
3. Navigation: compact minimap with discovery, ready/spent shrines, encounter status, player, viewport, and bosses. Screen-edge guidance for offscreen bosses and discovered healing shrines.
4. Build decisions: numerical next-rank previews, visible evolution requirements/progress, and limited rerolls with mouse and keyboard support. Event blessings exclude heal/gold filler.
5. Atmosphere: differentiated paving, rubble, grave markers, banners, warm/cold landmark lighting; synthesized footsteps, metal impacts, enemy voices, adaptive boss accompaniment, and dawn music. Provide volume and reduced-motion controls.
6. Replay: visible challenge goals, one-time persistent rewards, unlockable run modifiers with clear tradeoffs, and a run report with weapon damage, encounters, modifiers, and defeat source.

Validation: JavaScript syntax, built-in self-test, existing gameplay/art/arena checks, focused browser checks for encounters, rerolls, save migration/rewards, damage attribution, navigation, settings, and responsive UI. Inspect screenshots at normal, crowded, landmark, blessing, and small viewports. Record final results here and update HANDOFF.md.

Status: complete, implemented locally and verified.

## Completed validation

- JavaScript syntax checks and `git diff --check`: PASS.
- Built-in self-test: PASS.
- Existing browser suite: PASS — all knight dashes, boss warnings/phases, Hydra split/lunge, shrine behavior, art gallery, missing-atlas fallback, and small viewport; no runtime errors.
- Arena suite: PASS at 854×480, 1280×720, 1920×1080, 3840×2160, and 5120×1440 — camera following/bounds, boundary collision, exploration range, scenery placement, and offscreen spawning.
- New integration suite: PASS — old-save migration, immediate E acceptance, all four encounters, guaranteed build rewards, repeat-reward prevention, keyboard rerolls/exhaustion, damage aggregation and attribution, overkill exclusion, all sixteen base/evolved weapons, actual evolution trigger, challenge gold paid once across runs, modifier stats/payouts, settings/rewards surviving reload, real meteor fatal-source reporting, starting-build altar combat, and cap handling.
- Screenshot review: chapel, graveyard, gate, blessing cards, report, challenge menu, and crowded combat. The 854×480 blessing layout fits without hiding reroll controls; the 390×740 layout scrolls within its panel.

Artifacts: `art/verification/improvements-report.json`, `improvements-*.png`, and updated existing browser verification screenshots/reports.

Latest headless 1280×720 frame submission measurements: 100 enemies, 5.1 ms update/render median, 9.1 ms p95; 340 enemies, 8.9 ms median, 12.7 ms p95. These are JavaScript submission timings, not measured display FPS or GPU completion times.

The sound is locally synthesized; automation verifies audio construction and controls, while listening quality and long-term encounter balance remain matters for ordinary playtesting. No deployment or remote push was performed.


## Follow-up: gothic mage second unlock

Completed September 30: Lady Mara replaces the second champion with a Morticia-inspired adult gothic gown, long dark hair, bell sleeves, amethyst jewelry, and crescent staff. Her Blender source has four directional sets of idle/run/dash/hurt/death/cast animations, plus a separate high-resolution portrait. The 500-gold price and existing Mara saves are preserved.

Added Hex seeking/splash/binding curses, Nightbloom evolution with Focus, Veilstep's stationary binding sigil, and capped Witchblood healing. Mage integration checks and the general improvement/browser suites passed. All 18 base/evolved weapons are exercised. Re-export of six cast frames from the saved scene matched the generated frames exactly. No atlas frame was empty or clipped. See `art/verification/mage-report.json` and `mage-*.png`.
