# DEVTOOLS — Agent & developer guide for driving the game

This document is the manual for the Dark Fantasy debug surfaces. It lets AI agents
(and humans) observe, drive, and assert **everything** in the game — canvas included.

## The three surfaces

| Surface | Where | Gate | What it does |
| --- | --- | --- | --- |
| `window.__game` (browser) | web app | dev build or `?debug=1` | state snapshots, game mutations, input synthesis, canvas-button clicks, waiters |
| `__net.netWorld` (browser) | web app | dev build or `?debug=1` | live mirror of the authoritative co-op world (prediction + interpolation) |
| `/debug/*` + `__debug` (server) | game server | `GAME_DEBUG=1` env | room listing, wave/hp/bots/end/latency/freeze ops on the authoritative sim |

Security: both surfaces are **client-side dev tools / env-gated**. They are disabled in
production (Vercel ships `?debug=1`-free builds unless requested; Railway never sets
`GAME_DEBUG`, verified `/debug/*` returns 404 on the deployed server). Online authority
always stays server-side.

---

## 1. Browser debug API — `window.__game`

Open the dev server (`pnpm --filter @dark-fantasy/web dev`) or any page with `?debug=1`,
then use the browser console (or Playwright `page.evaluate`):

### Observe

```js
__game.state()            // full snapshot: gameState, wave, stats, player, enemies, ...
__game.state().player     // hp, maxHealth, xp, level, damage, range, position, ...
__game.state().enemies    // count, byType, first 25 entries (type/x/y/hp/state)
__game.state().net        // online world: active, wave, players, ping, ended
```

### Mutate — `__game.control.*`

```js
__game.control.setHp(50); __game.control.setMaxHp(200); __game.control.heal();
__game.control.setXp(100); __game.control.setLevel(5); __game.control.addXp(30);
__game.control.teleport(400, 300);
__game.control.spawnEnemy("boss", 300, 200); __game.control.killAllEnemies();
__game.control.setWave(5); __game.control.setWaveState("active");
__game.control.godMode(true); __game.control.freezeEnemies(true);
__game.control.victory(); __game.control.gameOver();
__game.control.start();    // local run (bypasses the placeholder.html gate)
__game.control.restart(); __game.control.title();
__game.control.pause(); __game.control.resume();
__game.control.advanceLevel(); __game.control.openUpgrades(); __game.control.chooseUpgrade(0);
__game.control.addLoot("potion"); __game.control.setVolume(0.5);
```

### Synthesize input — `__game.input.*`

These write into the **same** pipeline real keyboard/mobile input uses, so local
prediction and the online input sender treat them as genuine input.

```js
__game.input.move(1, 0);      // hold right (vx, vy in -1..1)
__game.input.attack(true);    // hold attack
__game.input.dash();
__game.input.keyDown("w"); __game.input.keyUp("w");
__game.input.press("d", 500); // hold 500ms
__game.input.clear();
```

### Click canvas buttons — `__game.ui.*`

The canvas button set (title screen, pause, level-up cards, settings) is exposed with
labels + rects and is clickable by label or by canvas coordinates.

```js
__game.ui.buttons();                       // [{label, kind, key, x, y, w, h}, ...]
__game.ui.clickButton("START");            // true if found + invoked
__game.ui.clickAt(400, 280);               // canvas-space click
```

### Waiters & events

```js
await __game.when(s => s.player.health < 20, 5000);  // true/false
await __game.wait(1000);
window.addEventListener("df:game", e => console.log(e.detail)); // snapshot per mutation/state change
```

---

## 2. Server debug channel — `GAME_DEBUG=1`

Run the game server with the debug gate:

```
GAME_DEBUG=1 pnpm --filter @dark-fantasy/game start        # or via cross-env on Windows
pnpm --filter @dark-fantasy/game debug-e2e                 # the 6-assertion verification test
```

### HTTP

```
GET  /debug/rooms                                  # active game + lobby rooms
POST /debug/rooms/:roomId/wave     { "n": 5 }
POST /debug/rooms/:roomId/hp       { "sessionId": "...", "hp": 42 }
POST /debug/rooms/:roomId/bots     { "count": 2 }         # server-side chase bots
POST /debug/rooms/:roomId/end      { "status": "victory" | "gameover" }
POST /debug/rooms/:roomId/latency  { "ms": 150 }          # delay input application
POST /debug/rooms/:roomId/freeze   { "on": true }         # halt waves/enemies
```

### Room messages (from any connected client)

```
room.send("__debug", { op: "wave", n: 5 });
room.send("__debug", { op: "bots", count: 2 });
room.send("__debug", { op: "latency", ms: 150 });
room.send("__debug", { op: "freeze", on: true });
```

---

## 3. Online world mirror — `__net.netWorld` (browser, dev / `?debug=1`)

When in a co-op match the authoritative world is mirrored for prediction +
interpolation. Agents can read it to assert net behavior:

```js
__net.netWorld.active;          // in a game room?
__net.netWorld.players;         // Map: sessionId -> {x, y, hp, name, ...}
__net.netWorld.enemies;         // Map: id -> {x, y, type, hp, state, ...}
__net.netWorld.wave; __net.netWorld.status; __net.netWorld.pingMs;
__net.netWorld.predicted;       // local player's predicted state
```

---

## 4. E2E harness (in-repo)

```
pnpm e2e                                # server e2e + debug e2e + browser e2e
pnpm --filter @dark-fantasy/game e2e    # server integration (self-retrying)
pnpm --filter @dark-fantasy/game debug-e2e
pnpm --filter @dark-fantasy/web e2e     # browser specs (auto-spawns both servers)
```

Browser specs: `apps/web/e2e/` (`debug-api.spec.ts`, `online-gameplay.spec.ts`) plus
`helpers.ts` (login, net-state reader, chase bot). Requires the Playwright browser
cache (`npx playwright install chromium` once).

---

## Example agent prompts

- "Open the dev server, use `__game.control.start()`, play 30 seconds, then report
  the HUD values from `__game.state()`."
- "Spawn a boss at wave 5 with god mode on, screenshot the fight, verify the boss
  health bar is rendered."
- "Run `pnpm --filter @dark-fantasy/web e2e` and summarize which spec failed and why."
- "Start a co-op match with two browser tabs, inject 150ms latency via
  `POST /debug/rooms/:id/latency`, and check the guest's view for rubber-banding."

---

## Verification loop (always, before shipping)

```
pnpm --filter @dark-fantasy/sim test
pnpm --filter @dark-fantasy/game e2e
pnpm --filter @dark-fantasy/game debug-e2e
pnpm --filter @dark-fantasy/web e2e
pnpm -r typecheck && pnpm -r lint && pnpm -r build
```

## Gotchas

- `packages/sim` exports from `dist/` — rebuild after sim source edits
  (`pnpm --filter @dark-fantasy/sim build`; `prepare` runs it on install).
- The net layer must not import `game/config` at module scope (canvas at load time).
- Local START button redirects to `placeholder.html` — use
  `__game.control.start()` for local runs.
- Debug surfaces are dev tools: don't rely on them in production; the game server
  debug channel is off unless `GAME_DEBUG=1`.