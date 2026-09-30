# Oathbound — Last Vigil

A dark-fantasy horde survivor you can play in the browser. Built as a better take on *Knight Survivor* / *Knight Survival*: no ads, no energy gates, a real build system, and bosses that actually fight back.

## Play

Clone and serve locally:

```bash
git clone https://github.com/jasonjaynelson/oathbound.git
cd oathbound
./play.sh
```

Or from the project folder:

```bash
python3 -m http.server 8765 --bind 127.0.0.1
```

Then open `http://127.0.0.1:8765/`.

**Controls**

| Input | Action |
|---|---|
| WASD / arrows | Move |
| Shift or Space | Dash along your last direction |
| Mouse | Aim fire and ice |
| 1 / 2 / 3 | Pick a blessing |
| Arrows + Enter (blessing screen) | Select and accept a blessing |
| E | Accept a nearby landmark encounter |
| R (blessing screen) | Use a limited blessing reroll |
| Esc / P | Pause |

## What this improves

The games sold as Knight Survivor / Knight Survival are thin Vampire Survivors clones: ads, empty arenas, geometric slimes, and a knight who somehow shops for a flamethrower. Oathbound keeps the compulsive loop and replaces the rest.

- A 3,200 × 3,200 ruined courtyard fills the window and extends beyond it. The camera follows the knight, with shrines across the central court and outer grounds. Enemies approach beyond the camera, and waves surge through the gates.
- Auto-firing weapons, and a dash that commits to your last direction
- Each champion's dash does something: Aldric cuts, Lady Mara leaves a binding sigil, the Hollow leaves blood
- Level-up blessings name the virtue that evolves a weapon. Virtues change how that weapon fights before the evolution
- A shop after each mid-boss, and those purchases survive the next level-up
- Nine weapons, eight virtues, nine evolutions, and evolved weapons can still be raised
- The Wailing Duke, the Bone Hydra, and the Dawn Eater each have a fight you can learn
- Three champions, a gold reliquary, and the Red Hour: a harder vigil whose first dawn kept wakes the Keeper's Brand
- No ads, no stamina, no real-money shop

Survive 8:30, kill the Dawn Eater, see the sun.

## Explore and build

The central courtyard connects four landmarks. The minimap marks undiscovered areas with `?`. Approach a landmark and press **E** to begin its optional encounter:

| Landmark | Encounter |
| --- | --- |
| Ruined Chapel | Spend 20 seconds inside the defense circle; leaving pauses progress |
| Graveyard | Destroy the summoning altar before its reinforcements overwhelm you |
| Fallen Armory | Defeat the armored golem champion |
| Breached Gate | Clear three assault waves |

Each encounter rewards a guaranteed build blessing and 50 run gold, once per vigil. The chapel also grants a shield. Nearby shrines appear on the map when discovered; spent shrines dim until ready. Offscreen bosses and discovered healing shrines (when below 70% health) get directional indicators.

Blessings show base damage, projectile counts, timing, and rank changes. Virtues, buffs, and evolutions have additional effects. Evolution progress shows the required rank and matching virtue. Each run starts with three rerolls; use **R** or the reroll button. The Transfiguration challenge adds a permanent fourth reroll.

**Challenges & Oaths** tracks one-time goals and rewards, awarded when a vigil ends. Keep Warden unlocks **Siege** (20% more enemies, 25% more run gold). Wayfarer unlocks **Pilgrim** (15% faster movement, 20% less maximum health, one extra reroll). Both can be combined with the Red Hour. The end report shows damage by weapon, completed encounters, the modifier, challenge rewards, and the fatal hit source.

**Settings**, available from the title screen or pause menu, controls audio volume, screen shake, and damage numbers. System reduced-motion preferences disable screen shake by default. Footsteps, metal impacts, enemy calls, ambient wind, boss accompaniment, and the dawn sequence are synthesized locally with Web Audio; there are no new audio downloads.

## Verification

With the local server running and Playwright available:

```bash
NODE_PATH=../crosswake/node_modules OATHBOUND_URL=http://127.0.0.1:8765/ node tools/check_mage.cjs
NODE_PATH=../crosswake/node_modules OATHBOUND_URL=http://127.0.0.1:8765/ node tools/check_improvements.cjs
NODE_PATH=../crosswake/node_modules OATHBOUND_URL=http://127.0.0.1:8765/ node tools/check_arena.cjs
NODE_PATH=../crosswake/node_modules OATHBOUND_URL=http://127.0.0.1:8765/ node tools/check_browser.cjs
```

The checks use isolated browser profiles, preserve your browser saves, and write screenshots/reports to `art/verification/`. `IMPROVEMENT_PLAN.md` records the scope and completed validation.

## Blender art

Knights, enemies, and bosses now use animated Blender-rendered sprites. The courtyard has rendered stonework and shrine props, and weapons and rewards share a matching icon set. Open `/art/preview.html` on the local server to inspect the animations.

Editable Blender scenes, export commands, and browser verification results are documented in [art/README.md](art/README.md). Add `?art=legacy` to the game URL to compare the original art.

## Champions

- **Sir Aldric** — balanced, starts with Oathblade. Dash cuts a blade arc
- **Lady Mara** — 500 gold, a swift gothic mage in a fitted black gown. Starts with **Hex**, seeking curses that snare and splash nearby foes. **Veilstep** leaves a binding sigil for 2.5 seconds. **Witchblood** restores 1 HP per curse or sigil kill, capped at 3 heals per second
- **The Hollow** — 1200 gold, huge vitality, Blood Well. Dash leaves a pool of blood

Swear the Red Hour on the title screen for faster gates, elites from the first minute, and no field rations. Win it once and the Keeper's Brand starts every later vigil with a random virtue. A kept Red Hour also pays more gold.

Hex + Focus at rank 6+ becomes **Nightbloom**, a volley of curses with much wider blossoms. Lady Mara preserves the former Mara unlock and selection in existing saves.

Pair a weapon with the matching virtue at rank 6+ to evolve it (Oathblade + Rage = Crown of Blades, and so on).
