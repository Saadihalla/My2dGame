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

## Phase 1.5 — UI, Assets, Animations, Particles & Dynamic Scale

Goal: stop being a small static 800×500 window. Bigger camera-driven maps, a
responsive viewport, real sprite assets, frame animations, a proper particle
system, and a full UI overhaul. Order matters — each phase builds on the last.

### Phase A — Dynamic viewport + camera (FOUNDATION, do first)

Everything else hangs off this. Maps become bigger than one screen, the
camera follows the player, and the canvas adapts to the window.

**Specs / decisions**
- Keep `TILE = 50`; levels become multi-screen: target 32×20 tiles
  (1600×1000 world) with per-level dimensions in the level data
  (`width`/`height` in tiles instead of fixed 16×10 strings)
- Logical view stays ~800×500 for gameplay/HUD layout; camera shows a window
  into the world
- Desktop: canvas letterboxed with a themed backdrop; Mobile: full-screen,
  safe-area aware
- Camera: player-follow with smoothing (lerp), clamped to map bounds,
  integrated with existing screen shake
- HUD stays in *screen* space — never scrolls with the camera

**Tasks**
1. `logic/camera.js` — pure camera math: `cameraUpdate(cam, target, bounds,
   dt)`, `worldToScreen`, clamp; unit tests
2. Level data: per-level `width`/`height`, build maps from rows of that size
3. Rewrite `drawMap` to render through a camera transform; pre-render the
   static tile layer to an offscreen canvas once per level build
4. Tile/entity culling: only draw what intersects the viewport
5. Resize handling: `resize` listener → recompute canvas size + DPR +
   buffers; HUD anchored to screen corners (already true — verify)
6. Re-anchor world-space effects: darkness gradient, torch lights, portal,
   dash pixelation (its 96px offscreen canvas must stay screen-anchored)
7. Spawn bounds / portal placement use world size; update level tests

**Verification**: resize browser window mid-game (no artifacts), camera
smooths without jitter, all existing tests still pass, level-data tests
extended for the new dimensions.

### Phase B — Asset pipeline

Move from 100% procedural `fillRect` art to real sprite assets while keeping
procedural sprites as placeholders/fallbacks.

**Tasks**
1. `assets/` folder + `src/assets.js` loader module: preload PNGs with
   progress, `image-rendering: pixelated`
2. Sprite sheet format: PNG sheet + JSON frame defs (name, x, y, w, h,
   anchor, per-state frame lists)
3. `logic/frames.js` — pure frame lookup (sheet + state + time → frame
   index), unit tested
4. Swap procedural player/enemy/torch/projectile draws to sheet draws;
   keep the procedural versions as a fallback flag
5. Pixel font: bundle a bitmap pixel font (or webfont like Press Start 2P)
   replacing Arial/Georgia everywhere — instant mood upgrade

**Verification**: dev server serves sheets, no broken images, `npm run build`
bundles assets, pixel font renders in HUD/screens.

### Phase C — Animation system

Frame-based animation controllers replacing static sprites.

**Tasks**
1. `src/animation.js` — controller per entity: `setState`, `update(dt)`,
   `currentFrame(time)`; states: idle, walk, attack, hurt, dash, death
2. Player: idle bob/breathing, 4-dir walk cycle, attack lunge (body shifts
   into the swing), dash frames layered with the pixel-air effect
3. Enemies (each type): idle/walk cycles, attack lunge, stagger lean on hit,
   windup shake, dissolve-on-death with particles
4. `logic/tween.js` — pure easing/tween helpers (lerp, bounce, elastic) for
   UI + entity motion; unit tests
5. Screen transitions: title fade-in, portal warp flash, banner slide/fade
6. Replace the rect-based swing with a sheet swing arc + motion trail

**Verification**: walk cycles flip/loop correctly in all 4 directions,
attacks don't desync from hitboxes, no test regressions.

### Phase D — Particle overhaul

Turn the single square-particle system into a real emitter system.

**Tasks**
1. `logic/particles.js` — emitter configs: shape (rect/circle/line),
   gravity, drag, spin, size + alpha curves, additive blending flag,
   per-emitter palette; pure update math, unit tested
2. Pooling: preallocated particle pool, no per-frame array splice churn
3. `src/fx.js` rewrite: typed emitters (spark, smoke, shard, ember, blood)
   replacing `spawnParticles`
4. Effect inventory:
   - hits (per-enemy palettes), crit explosion, kill burst
   - dash trail, explosion shockwave ring + smoke + debris
   - shield clink, level-up confetti, portal swirl
   - ambient per level: forest leaves, crypt ash, highlands embers
   - torch embers, death dissolve
5. Damage numbers: crit pop scale, easing float

**Verification**: 60fps with large crowds (pool stats exposed in debug),
ambient effects present per level, additive effects don't blow out the canvas
state.

### Phase E — UI overhaul

Visual language + richer screens + mobile + settings.

**Tasks**
1. Theme system: dark-fantasy panels (9-slice frames), gold accents,
   consistent spacing; single `src/theme.js`
2. HUD: gradient bars with icons (sword/potion/dash), picked-upgrade icon
   row, boss health bar top-center, wave progress
3. Screens: animated title (embers + moving backdrop), level-up cards with
   icons + stat preview, game-over with run stats breakdown (kills by type,
   damage dealt, time per wave), victory recap
4. Mobile: dynamic joystick (spawns under the thumb), safe-area insets,
   press-state glow on buttons, bigger touch targets
5. Settings screen: sound volume, screen shake toggle, reduced-motion,
   control hints; persisted in localStorage
6. Banners: slide/fade animations with the tween module

**Verification**: mobile viewport 390px + landscape, click targets ≥44px,
settings persist across reloads, no console errors.

### Risks & notes

- **Phase A touches everything** (draw order, lighting gradients, HUD
  anchoring, dash pixelation, spawn logic) — do it in one sitting with the
  browser smoke test after every sub-step
- World-space vs screen-space split: entities/particles/lighting render in
  world space (camera transform); HUD/overlays/banners in screen space
- The dash pixelation offscreen canvas must move with the camera
- Keep `logic/*` modules DOM-free — camera, frames, tween, particles all
  unit-testable

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
2. **New enemy archetypes** ✅ DONE
   - **Imp** (swarm) — fast, fragile chaff from wave 2
   - **Hexer** (ranged caster) — kites at range, telegraphs, then fires
     a glowing projectile (dash through it with i-frames) — wave 3+
   - **Bomber** (exploder) — rushes in, telegraphs, then detonates in an
     AoE blast, taking itself out — wave 4+
   - **Warden** (shieldbearer) — blocks attacks from the player-facing
     side; turns slowly, so dash behind it and strike its back — wave 5+
3. **Real boss phases** ⏳ NEXT
   - Pale King gets 3 phases: summon adds → radial projectile burst → enrage charge
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
- Vite HMR full-reloads during edits make long browser-test sessions flaky —
  restart the dev server or use cache-busted URLs (`/?v=<timestamp>`) when
  testing for a while

## Workflow notes

- Run `npm run dev` for iteration, `npm test` before landing, `npm run build`
  to verify production output
- Every phase ends with a browser smoke test (Playwright): no console errors,
  pause overlay verified via canvas brightness, mobile viewport checked
- Commit per phase with conventional commits; push after each landing
