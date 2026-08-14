# ⚔ Dark Fantasy

A dark fantasy arena survival game built with vanilla JS + Canvas. No game libraries — just ES modules, a fixed-timestep loop, and hand-rolled rendering.

## Setup

```bash
npm install
npm run dev        # start the dev server (http://localhost:5173)
npm run build      # production build → dist/
npm run preview    # serve the production build
npm test           # run the unit tests (vitest)
npm run lint       # run eslint
```

## How to play

- **W A S D / arrows** — move
- **SPACE / ⚔ button** — attack (hold to keep swinging)
- **P / Esc** — pause
- **R / ↻** — restart
- **Enter / START** — begin
- **Joystick** — mobile movement (appears on small screens)

## Game loop

- Survive **waves** of enemies: grunts, fast stalkers, armored bulwarks, and a **Pale King boss** every 5th wave
- Clear a wave → an **exit portal** opens → step in to reach the next level (Forest Ruins → Crypt → Highlands, each with its own palette and layout)
- **Clear wave 10** to win
- Enemies scale in HP each wave

## Progression

- **XP & levels** — each kill grants XP; leveling up raises max HP and heals you
- **Health potions** drop from kills (red flask)
- **Sword upgrades** drop occasionally (gold sword): +4 damage, +5 range
- **Score** — kills, wave-clear bonuses, level bonuses; best score is saved in `localStorage`

## Architecture

| File | Purpose |
|------|---------|
| `src/game.js` | Entry point: game loop (fixed 60Hz timestep + render interpolation), wave manager, portal, bootstrap |
| `src/config.js` | Canvas setup, DPR scaling, constants, fixed timestep settings |
| `src/state.js` | Mutable runtime state (game state, wave, stats, high score) shared across modules |
| `src/events.js` | Flow event indirection — breaks import cycles between input/entities and game flow |
| `src/flow.js` | Game-flow actions: start, restart, pause, death, victory, level advance |
| `src/audio.js` | WebAudio synth SFX (no assets) |
| `src/fx.js` | Particles, damage numbers, screen shake, hurt vignette |
| `src/banners.js` | Wave announcements and level-up banners |
| `src/levels.js` | Level data (tile maps, decor, palettes), collision facade, map rendering |
| `src/entities.js` | Player, enemy types/AI, combat, loot, XP, entity rendering |
| `src/input.js` | Keyboard + mobile joystick/attack controls |
| `src/ui.js` | HUD, title/pause/end screens, buttons, click handling |
| `src/logic/*.js` | Pure, framework-free game rules (collision, waves, enemy AI, spawn points, loot rolls) — fully unit-tested |
| `tests/*.test.js` | Vitest unit tests for the pure logic modules |

Key design decisions:

- **ES modules** — no build-step runtime magic; `vite` is only a dev server/bundler. Modules keep the import graph acyclic (state + events modules break the cycles).
- **Fixed timestep** — logic runs at exactly 60Hz regardless of display refresh rate; rendering interpolates between the last two ticks for smooth motion on 120Hz+ screens. Enemy knockback, particle gravity, and AI timers are now frame-rate independent.
- **No softlocks** — the player can shove enemies aside; an enemy only body-blocks when backed by terrain.
- **Spawn safety** — wave spawns fall back through relaxed constraints to a tile scan, so large waves can never produce undefined spawn points.
- **Pure rules** — wave composition, collision, enemy state machine, spawn picking, and loot rolls are pure functions with no DOM/canvas imports, so balance changes are unit-testable.

## Legacy

Pre-0.2.0, the game loaded via plain `<script>` tags and ran from `file://`. That still works from the git history (`git checkout 1a55731^`), but the module layout is the way forward.
