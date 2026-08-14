# ⚔ Dark Fantasy — Development Plan & Progress

Living roadmap for taking the game to the next level. Each phase is executed
incrementally; everything is verified with `npm run lint`, `npm test`, and a
live browser smoke test before landing.

## Repository state

- **Stack**: vanilla JS + Canvas 2D, ES modules, Vite (dev/build), Vitest (unit tests), ESLint
- **Commits**:
  - `49ef0c1` — Phase 0: foundation (modules, fixed timestep, pure logic, tests)
  - `8ddd427` — Phase 1: dash, hit-stop, death animations, gamepad, mobile buttons
- **Status**: pushed to `origin/master`

---

## Phase 0 — Foundation ✅ DONE

Converted the architecture so everything after is easier, safer, and testable.

### Done
- **ES modules** (`src/`): acyclic import graph via a dedicated `state.js`
  (all mutable runtime state) and `events.js` (flow-event indirection that
  breaks input/entities → game-flow cycles)
- **Fixed timestep**: logic ticks at exactly 60Hz with an accumulator; player
  and enemy rendering interpolate between ticks, so knockback, particle
  gravity, and AI timers are refresh-rate independent
- **Pure logic extraction** (`src/logic/`, DOM-free, fully unit-tested):
  - `collision.js` — AABB + tile/object collision
  - `waves.js` — wave composition
  - `ai.js` — enemy state machine (chase/windup/strike/recover/retreat)
  - `spawn.js` — spawn point selection with graceful fallbacks
  - `loot.js` — drop rolls
- **Tests**: 43 Vitest unit tests (`tests/`)
- **Tooling**: Vite dev/build/preview, ESLint (flat config), `npm test`
- **Bug fixes**:
  - Spawn crash: wave spawns now degrade from strict constraints → relaxed
    pass → tile scan, and can never produce undefined points
  - Corner softlock: the player can shove enemies out of the way; enemies only
    body-block when backed by terrain

### Notes
- Removing the `file://` fallback was intentional — modules require a server.
- The `state.js` setters keep every state mutation centralized and lint-clean
  (`no-import-assign` compliant).

---

## Phase 1 — Game feel & control depth ✅ DONE

### Done
- **Dash** (replaces the planned dodge roll, per player request):
  - Quick committed burst in any direction (8-way normalized from held keys,
    falls back to facing when idle), 660px/s for 0.2s, 0.9s cooldown
  - Triggers: **Shift**, double-tap a movement key (220ms window), mobile `»`
    button, gamepad X
  - Full invulnerability frames (0.32s) that suppress the hurt-blink flicker
  - **Pixel-air animation**: the sprite is downsampled to a 16×16 grid and
    scaled back up with smoothing off — the player reads as chunky scattered
    pixels mid-dash — with a trail of pixel-debris particles
  - Shoves enemies aside; HUD shows a dash-cooldown bar
  - Pure direction logic in `src/logic/dash.js` (3 unit tests)
- **Hit-stop**: ~90ms full freeze on kills, ~50ms on boss hits
- **Death animations**: enemies fade out and sink over 0.5s instead of
  vanishing; fully faded corpses are removed (also fixes a leak where dead
  enemies accumulated across waves)
- **Gamepad support**: left stick to move, A to attack, X to dash, Start to
  start/pause — polled per frame, edge-triggered, safe disconnect
- **Mobile**: dedicated dash (`»`) and pause (`❚❚`) buttons — mobile finally
  has pause

### Deferred from the original Phase 1 list (still open)
- Music layer (procedural WebAudio loop, per-level drones, mute toggle)
- Aimable / ranged attack (mouse or touch aiming, thrown-knife skill)

---

## Phase 2 — Content & systems depth ⏳ NEXT

The biggest replayability win; nothing here needs rework of the foundation.

1. **Level-up choices** (pick-3 on level up, Vampire-Survivors style) ✅ DONE
   - 9 stackable upgrades: Brawler (+damage), Long Reach (+range), Swift
     Blade (attack speed), Vitality (+max HP), Striders (+move speed),
     Quick Reflexes (dash recharge), Keen Edge (crit), Bloodthirst
     (lifesteal), Cleave (wider sweeps)
   - Leveling pauses the action; pick via click or 1/2/3; multiple levels
     from one kill queue up sequentially
2. **New enemy archetypes** ⏳ NEXT
   - Ranged caster (telegraphed projectile)
   - Exploder (telegraphed suicide rush)
   - Shieldbearer (only takes hits from the front / unshielded side)
   - Swarm minion (boss-spawned)
3. **Real boss phases** — Pale King gets 3 phases: summon adds → radial
   projectile burst → enrage charge
4. **Elemental loot/weapons** — fire (DoT), frost (slow), chain lightning;
   enemy resistances
5. **Environment hazards** — spike traps, lava pools, pressure-plate doors
6. **New levels** — 3–5 more (swamp, ice cavern, …)
7. **Meta progression** — run currency + unlockable classes (duelist,
   berserker, ranger), persisted to localStorage

---

## Phase 3 — Meta & audience polish

Make it feel like a product, not a prototype.

1. **PWA** — service worker + manifest: installable, offline, home-screen
2. **Daily runs** — seeded levels, shareable run codes, per-seed scoreboard
3. **Achievements + run history** — best wave, kills, playtime
4. **Accessibility** — colorblind-safe enemy outlines, reduced-motion toggle,
   volume sliders, remappable keys
5. **Difficulty modes** — Normal / Nightmare; endless mode past wave 10
6. **Music layer** (moved here if not done in Phase 1/2)

---

## Phase 4 — Stretch goals

Only after Phases 0–3.

1. **Procedural map generation** — tile-based rooms + connectors so runs vary
2. **Local 2-player co-op** — second gamepad/keyboard set
3. **Online leaderboards** — optional server-backed, no hard dependency

---

## Known issues / backlog

- Missing `favicon.ico` (404 in console — harmless, easy win)
- `barHealth` easing on enemy health bars is legacy-kept; consider removing
- No audio mute/settings persistence beyond high score
- No touch layout tuning beyond the default phone viewport

## Workflow notes

- Run `npm run dev` for iteration, `npm test` before landing, `npm run build`
  to verify production output
- Every phase ends with a browser smoke test (Playwright): no console errors,
  pause overlay verified via canvas brightness, mobile viewport checked
- Commit per phase with conventional commits; push after each landing
