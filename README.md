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
| Esc / P | Pause |

## What this improves

The games sold as Knight Survivor / Knight Survival are thin Vampire Survivors clones: ads, empty arenas, geometric slimes, and a knight who somehow shops for a flamethrower. Oathbound keeps the compulsive loop and replaces the rest.

- A 3,200 × 3,200 ruined courtyard fills the window and extends beyond it. The camera follows the knight, with shrines across the central court and outer grounds. Enemies approach beyond the camera, and waves surge through the gates.
- Auto-firing weapons, and a dash that commits to your last direction
- Each knight's dash does something: Aldric cuts, Mara plants a cross, the Hollow leaves blood
- Level-up blessings name the virtue that evolves a weapon. Virtues change how that weapon fights before the evolution
- A shop after each mid-boss, and those purchases survive the next level-up
- Eight weapons, eight virtues, eight evolutions, and evolved weapons can still be raised
- The Wailing Duke, the Bone Hydra, and the Dawn Eater each have a fight you can learn
- Three knights, a gold reliquary, and the Red Hour: a harder vigil whose first dawn kept wakes the Keeper's Brand
- No ads, no stamina, no real-money shop

Survive 8:30, kill the Dawn Eater, see the sun.

## Blender art

Knights, enemies, and bosses now use animated Blender-rendered sprites. The courtyard has rendered stonework and shrine props, and weapons and rewards share a matching icon set. Open `/art/preview.html` on the local server to inspect the animations.

Editable Blender scenes, export commands, and browser verification results are documented in [art/README.md](art/README.md). Add `?art=legacy` to the game URL to compare the original art.

## Knights

- **Sir Aldric** — balanced, starts with Oathblade. Dash cuts a blade arc
- **Sister Mara** — 500 gold, faster, Holy Cross. Dash plants a cross that fires
- **The Hollow** — 1200 gold, huge vitality, Blood Well. Dash leaves a pool of blood

Swear the Red Hour on the title screen for faster gates, elites from the first minute, and no field rations. Win it once and the Keeper's Brand starts every later vigil with a random virtue. A kept Red Hour also pays more gold.

Pair a weapon with the matching virtue at rank 6+ to evolve it (Oathblade + Rage = Crown of Blades, and so on).
