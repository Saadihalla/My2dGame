# Project Guide — Dark Fantasy

Multiplayer arena-survival game. Monorepo: React+TS game (`apps/web`), shared pure
simulation (`packages/sim`), FastAPI backend (`services/api`), future Colyseus server
(`services/game`, Phase 2).

## Game debug surface (for agents)

The canvas game is agent-drivable. In dev (`pnpm --filter @dark-fantasy/web dev`) or with
`?debug=1` on any page, `window.__game` is attached to the browser:

- `state()` — JSON snapshot: gameState, wave, stats, player (hp/level/xp/position),
  enemies, settings, net world (ping, wave, players)
- `control.*` — setHp/setMaxHp/heal/damage, setXp/setLevel/addXp, teleport, spawnEnemy,
  killAllEnemies, setWave, godMode, freezeEnemies, victory/gameOver, start/restart/title,
  pause/resume, advanceLevel, openUpgrades/chooseUpgrade, addLoot, volume/shake/motion
- `input.*` — keyDown/keyUp/press, attack(hold), dash(), move(vx,vy), clear — drives the
  SAME input pipeline as real input (prediction + net sender stay consistent)
- `ui.buttons()` / `ui.clickButton(label)` / `ui.clickAt(x,y)` — canvas UI buttons
  (START/ACCOUNT/SETTINGS/…), label + rect + click actions
- `when(predicate, timeoutMs)` — await a state condition (returns boolean)
- Events: `df:game` CustomEvent with a snapshot on every mutation/state change

Note: `control.start()` starts a local run — the real START button is gated to
`placeholder.html` by design. Online authority stays server-side; the debug API is
client-only.

## Commands (run from repo root)

- `pnpm --filter @dark-fantasy/sim test` — 109 unit tests on pure game logic
- `pnpm --filter @dark-fantasy/game e2e` — game-server integration test (lobby → match → input)
- `pnpm --filter @dark-fantasy/game debug-e2e` — server debug-channel test (GAME_DEBUG=1)
- `pnpm --filter @dark-fantasy/web e2e` — browser specs (auto-spawns game + dev servers)
- `pnpm e2e` — all of the above
- `pnpm --filter @dark-fantasy/game dev` / `start` — local Colyseus server on :2567
- Deployed game server: `wss://dark-fantasy-game-production.up.railway.app` (Railway,
  service `dark-fantasy-game`, `PORT=2567`; rebuild/redeploy via `railway up` from repo
  root — Docker build context is the repo root)
- `pnpm -r typecheck` / `pnpm -r lint` / `pnpm -r build`
- `pnpm --filter @dark-fantasy/web dev` — local dev server (set `VITE_GAME_URL` to the
  game server; `packages/sim` builds via `prepare`, rebuild it after sim source edits)
- API: Docker build + run against local Postgres for E2E (no local Python needed)

For the full agent/dev driving manual (__game API, server debug channel, E2E), read
`DEVTOOLS.md`.

## Rules (non-negotiable)

1. **UPDATE `ROADMAP.md` WITH EVERY CHANGE.** It is the living source of truth:
   check off completed boxes, add new tasks, adjust phase status. A merged PR without
   a matching roadmap update is an incomplete PR. Do this *before* finishing the task.
2. Client never trusts the client: rewards, progression, and (in Phase 2) combat
   authority live server-side.
3. `packages/sim` stays pure (no DOM, no I/O) — it is the shared contract between
   browser and game server.
4. After any API schema change: update `services/api/init.sql` and re-run it on Neon.
5. Ship order: tests → typecheck → lint → build → PR → CI → deploy. GitHub flow is
   automated (branch, PR, merge, Vercel/Railway deploy).

## Deployed infra

- Vercel → `apps/web` (production: my2d-game.vercel.app, auto-deploys on master)
- Railway → `services/api` (FastAPI; env: `DATABASE_URL`, `JWT_SECRET`, `CORS_ORIGINS`)
- Railway → `services/game` (Colyseus; `PORT=2567`; config file `services/game/railway.json`)
- Neon Postgres → schema in `services/api/init.sql`
- Vercel project settings override local config where set — when deploying a new
  project, prefer `vercel.json` fields the cloud schema accepts (it rejects
  `rootDirectory`).