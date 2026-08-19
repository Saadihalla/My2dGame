# HANDOFF — Dark Fantasy dev surface (Layer 3 DONE, Layer 4 next)

**Written:** after the user implemented Layer 3 themselves. Their work is UNCOMMITTED
(modifications to `services/game/*` + new `tests/debug.ts`). Everything verified green:
typecheck / lint / build across the monorepo, `debug-e2e` ALL PASSED, sim 109 tests,
server `e2e` PASSED.

## Where the project stands

- **Phase 2 (real-time co-op core) — DONE & deployed.** Colyseus game server live at
  `wss://dark-fantasy-game-production.up.railway.app` (Railway, `PORT=2567`). Co-op
  match rooms run the shared sim combat; client does prediction + interpolation.
- **Agent tooling Layer 1 (browser `window.__game`) — DONE & merged (PR #5).**
- **Agent tooling Layer 2 — PENDING** (Playwright MCP wiring + docs).
- **Agent tooling Layer 3 (server debug channel) — DONE, UNCOMMITTED.** Implemented by
  the user, verified by me. See below for details + remaining polish notes.
- **Agent tooling Layer 4 — PENDING** (repo E2E harness + DEVTOOLS.md).
- **Phases 3–8 — PENDING** (roadmap).

## Layer 3 — what exists (uncommitted working tree)

`services/game/src/rooms/GameRoom.ts`:
- `GAME_DEBUG=1` gate (`DEBUG_ENABLED`); `__debug` room message handler (ops: wave /
  hp / bots / end / latency / freeze)
- Public debug methods: `debugSpawnWave`, `debugSetHp` (also revives), `debugSpawnBots`
  (server-side chase bots writing into the shared input map, 400ms think interval),
  `debugEndMatch`, `debugSetLatency` (delays input application via setTimeout),
  `debugFreeze` (skips wave/enemy/projectile/end sections, keeps player movement +
  syncAll)
- Bot timers cleared in `endMatch`

`services/game/src/index.ts`:
- `matchMaker` import; `GET /debug/rooms` + `POST /debug/rooms/:roomId/:op` registered
  only when `GAME_DEBUG=1`. Verified: production server returns 404 on `/debug/rooms`
  (gate works; Railway has no GAME_DEBUG).

`services/game/tests/debug.ts` + `pnpm --filter @dark-fantasy/game debug-e2e`
(cross-env GAME_DEBUG=1 tsx tests/debug.ts) — 6 assertions, all passing:
rooms listing, freeze, wave, hp, HTTP wave POST, forced victory end.

### Polish notes for the next agent (small, optional)
1. **Bot timer leak on dispose**: `debugSpawnBots` timers are cleared only in
   `endMatch` — add `onDispose()` cleanup (clear all bot timers) since rooms auto-
   dispose when empty mid-match.
2. **Route duplication in tests/debug.ts**: the test re-implements the `/debug/*`
   routes inline instead of booting `src/index.ts` — it won't catch drift in the real
   route code. Acceptable, or refactor the routes into a shared exported function.
3. **Fix applied by me**: removed `(room as any).roomName` cast in index.ts
   (`room.roomName` is typed on `Room`).

## Your session findings (from the URL you shared)
- `https://my2d-game.vercel.app/#room=cKgnTxtpA` — the deep-link lobby join works in
  production; the room came back **locked** (a match was started from it), confirming
  the full production online flow (login → deep-link join → host start → match).
- Production game server has **no** `/debug/*` endpoints (404 — GAME_DEBUG unset), as
  intended.

## Layer 4 — repo tooling (next)
- Move the browser E2E harness into the repo: `apps/web/e2e/` with `@playwright/test`
  devDep + `pnpm e2e`; `playwright.config.ts` with two `webServer` entries (game
  server :2567 with GAME_DEBUG=1, vite :5173); specs: `online-gameplay.spec.ts` +
  `debug-api.spec.ts` (ports of the verified temp scripts in
  `C:\Users\zinou\AppData\Local\Temp\opencode\pw\`)
- `DEVTOOLS.md` — agent-facing guide (__game API, server debug endpoints, example
  prompts, e2e commands)
- Update `ROADMAP.md` (agent-tooling checklist rows 2–4) + AGENTS.md commands
- Commit Layer 3 + Layer 4, PR, CI, merge (squash, delete branch)

## Verification loop (before shipping anything)

```
pnpm --filter @dark-fantasy/sim test        # 109 tests
pnpm --filter @dark-fantasy/game e2e        # self-retrying server integration
pnpm --filter @dark-fantasy/game debug-e2e  # Layer 3 debug channel
pnpm -r typecheck && pnpm -r lint && pnpm -r build
```

## Git/GitHub workflow

- Branch + PR per feature, squash merge, delete branch; wait for CI + Vercel before
  merging. Master auto-deploys to Vercel; Railway rebuilds `services/game` from
  master (Dockerfile = repo root context).
- Vercel buildCommand already builds `packages/sim` first.
- `services/game/railway.json` + `pnpm-workspace.yaml` `pnpm.allowBuilds` are required
  for Railway/pnpm 11 — don't remove.

## Gotchas

- `packages/sim` exports from `dist/` — rebuild after sim edits (`pnpm --filter
  @dark-fantasy/sim build`; `prepare` runs it on install).
- Net layer must NOT import `game/config` at module scope (canvas at load) —
  `net/world.ts` inlines VIEW dims; `inputSync` is lazy-imported in `net/client.ts`.
- Master's teammate gate: local START button redirects to `placeholder.html` —
  `window.__game.control.start()` (via `flow.startLocalGame`) bypasses it for dev.
- Debug API: browser layer enabled in dev or `?debug=1` (client-only); server layer is
  `GAME_DEBUG=1` env-gated (off in production).