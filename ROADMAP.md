# 🗺 Dark Fantasy — Roadmap

**This file is the living source of truth for the project's direction.** Every feature
landed updates it: check off completed work, add new tasks as they surface, and keep the
phase status accurate. Do not let it drift.

Status legend: `[x]` = done · `[ ]` = pending · 🔴 = blocked

---

## Current position

- ✅ **Phase 0 — Foundation** (monorepo, TS port, sim package, FastAPI + JWT)
- ✅ **Phase 1 — Profiles & persistence** (match history, XP/coins/levels)
- ⏳ **Phase 2 — Real-time core** (Colyseus rooms, co-op, client prediction) ← **NEXT**
- ⏳ Phase 3 — Bots, matchmaking, resilience
- ⏳ Phase 4 — PvP & ranked
- ⏳ Phase 5 — Friends & social
- ⏳ Phase 6 — Meta progression & economy
- ⏳ Phase 7 — Content expansion
- ⏳ Phase 8 — Scale & production

---

## Architecture (how everything fits)

```
apps/web          React 19 + Vite + TS — the game on canvas inside a React shell.
                  React owns: profile, lobby, friends, character select (growing)
packages/sim      Pure, framework-free game simulation (collision, AI, waves, spawns,
                  loot, upgrades, levels, tween). Runs in the browser AND on the game
                  server — client prediction and server authority use identical code.
services/api      FastAPI + SQLAlchemy + Neon (Postgres) + JWT (access + rotating
                  refresh tokens). Accounts, match history, XP/coins/levels, and
                  later: friends, ranks, matchmaking metadata.
services/game     Colyseus (Node + TS) — the real-time WebSocket game server. NOT
                  BUILT YET — this is Phase 2. Same host as the API (Railway).
```

**Infra (deployed):**

- **Vercel** → `apps/web` (production: https://my2d-game.vercel.app, auto-deploys on
  push to master; preview deploys on every PR)
- **Railway** → `services/api` (FastAPI via Dockerfile + railway.json; `$PORT`,
  `DATABASE_URL`, `JWT_SECRET`, `CORS_ORIGINS` env vars; healthcheck `/api/health`)
- **Neon (Postgres)** → shared by API and (later) game server; schema in
  `services/api/init.sql` — **re-run it on Neon after every API schema change**
- **CI** (GitHub Actions) → sim tests + typecheck + build on every push/PR

---

## ✅ Phase 0 — Foundation

*Goal: monorepo skeleton, game runs on React+TS, FastAPI on the API host, real auth.*

- [x] pnpm monorepo (workspaces: `apps/*`, `packages/*`, `services/*`) + root scripts
- [x] `packages/sim`: extract pure logic (ai, camera, collision, dash, frames,
      levelData, loot, spawn, tween, upgrades, waves) to strict TypeScript
- [x] Port all 11 original vitest suites to the sim package (91 tests, all passing)
- [x] `apps/web`: React 19 + Vite + TS shell; game engine ported from vanilla JS to TS
- [x] Game imports point at `@dark-fantasy/sim` (no duplicated logic)
- [x] Canvas/buttons/mobile controls rendered by React (`GameCanvas`), game boots via
      dynamic import with a boot-once guard
- [x] `services/api`: FastAPI + SQLAlchemy (async) + asyncpg + Neon
- [x] JWT auth: access token (15 min) + rotating refresh token (30 d, stored hashed)
- [x] Endpoints: `POST /api/auth/register`, `POST /api/auth/login`,
      `POST /api/auth/refresh` (rotation), `GET /api/me`, `POST /api/me/stats`,
      `GET /api/health`
- [x] `init.sql` schema (players, player_stats, refresh_tokens) — matches old
      Vercel-functions schema so existing accounts survive
- [x] Auth UI migrated to tokens with localStorage fallback for offline dev
- [x] Deployment config: `vercel.json` (root build via pnpm filter, output
      `apps/web/dist`), `services/api/Dockerfile` + `railway.json`, CI workflow
- [x] Docker E2E of the API (register → login → me → refresh → rotation → 401s)
- [x] Browser boot check of the React game (assets, audio pools, wave 1)
- [x] Vercel production deploy green (fix: remove `rootDirectory` from vercel.json —
      cloud schema rejects it; CI Node 20 → 24 for pnpm 11)

**Exit criteria met:** game plays identically on React+TS · register/login uses real
tokens · `/docs` Swagger live · all tests/typecheck/lint green.

---

## ✅ Phase 1 — Profiles & Persistence

*Goal: every run counts. Profile page, match history, server-awarded progression.*

- [x] `match_history` table (mode, score, wave, kills, survived, damage_dealt, result,
      coins_earned, xp_earned, created_at) + index in `init.sql`
- [x] `POST /api/matches` — records a run; XP/coins computed **server-side**
      (never trusted from client); high_score merged with max()
- [x] `GET /api/matches?limit=` — recent history, newest first
- [x] Reward engine (`app/rewards.py`) mirroring the game's XP curve
      (`xpNeeded(level) = 40 + level * 25`); level derived from total XP
- [x] Docker E2E: defeat match (+155 XP / +55 coins → level 3), victory match
      (+410 XP / +144 coins → level 5), history order, `/api/me` reflects all
- [x] Web match client (`src/api/matches.ts`) using the shared `apiFetch`
- [x] Runs auto-submit on death/victory (`flow.ts` → `submitMatch`, fire-and-forget,
      only when a token session exists)
- [x] React bridge events: `df:auth` (session) and `df:state` (game state) on window
- [x] Hooks: `useAuth()`, `useGameState()`
- [x] `ProfilePanel` (React): level + XP bar, coins, best score, match count,
      W/L match history with rewards + relative time, logout
- [x] PROFILE button on the title screen (only when logged in)
- [x] Browser E2E: login → play → die → match auto-recorded (+5 XP/+5 coins) →
      profile shows it (also caught a `VITE_API_URL` trailing-space dev-env bug)
- [x] README + roadmap updated; PR #2 merged; production deploy green

**Exit criteria met:** profile page shows real history · progression is server-side ·
local fallback remains only as an offline dev convenience.

---

## ⏳ Phase 2 — Real-time core: co-op multiplayer ⭐

*Goal: you and a friend play together in a private room on the same map.*

**Game server (`services/game`, new)**
- [ ] Scaffold Colyseus service (Node + TS) in the monorepo; deploy to Railway
      (Dockerfile + railway.json, `$PORT` passthrough)
- [ ] `LobbyRoom`: list/create/join rooms; private room codes
- [ ] `GameRoom`: one per match; players, wave state, enemies, loot, projectiles
- [ ] Headless sim loop: run `packages/sim` + entity logic at 60Hz on the server
- [ ] Move entity definitions (player/enemy combat rules) into `packages/sim` so the
      server runs the *same* rules as the client
- [ ] State sync with `@colyseus/schema` (delta-encoded snapshots ~20–30Hz)

**Client networking (apps/web)**
- [ ] Input pipeline: `input.ts` writes to an input queue sent to the server instead
      of mutating local state directly
- [ ] Client prediction + reconciliation for movement/dash/attack
- [ ] Snapshot interpolation on top of the existing fixed-timestep renderer
- [ ] Latency display (ping HUD) for debugging
- [ ] Reconnect/resume in room after a brief disconnect

**Lobby UX (React)**
- [ ] Main-menu "PLAY ONLINE" replacing/augmenting START
- [ ] Create room (code + copy link), join room (enter code / link deep-link)
- [ ] Lobby screen: player list, ready-up, host start, map preview
- [ ] 2–4 player co-op vs waves (scaling: enemy HP/spawn counts with player count)

**Exit criteria:** two browsers on different machines, one private room, co-op vs
waves 1–10, no visible rubber-banding at 50–100ms latency.

---

## ⏳ Phase 3 — Bots, Matchmaking, Resilience

- [ ] Server-side bot players using `packages/sim` AI (kiting, retreats, states)
- [ ] Bot difficulty tiers (easy/normal/hard) + bot-fill for empty slots
- [ ] Public matchmaking queue (pool rooms on the server; MMR-aware once Phase 4
      exists)
- [ ] Input rate limiting / validation (anti-cheat baseline)
- [ ] All-disconnect handling: pause, migrate host, graceful shutdown
- [ ] Reconnect token flow for mid-match re-entry

**Exit criteria:** queue into a public co-op room with 2 bots; kill your Wi-Fi
mid-match and reconnect without losing progress.

---

## ⏳ Phase 4 — PvP & Ranked

- [ ] PvP ruleset in the sim: players damage players (generic `damageEntity`),
      kill-based loot/upgrades
- [ ] Arena maps (symmetrical, small) in `levelData`
- [ ] Modes: 1v1, 2v2, FFA
- [ ] Glicko-2 rating per mode; placement matches; tier badges
- [ ] `ratings` + `match_results` tables; rank updates after every match
- [ ] Season rollover + top-100 leaderboard (profile shows rank)
- [ ] Ranked queue gates: only with bots if population is low

**Exit criteria:** ranked 1v1 with friends works end-to-end; ratings change after
every match; leaderboard refreshes from Neon.

---

## ⏳ Phase 5 — Friends & Social

- [ ] `friendships` + `friend_requests` tables + API endpoints
      (request/accept/decline/remove, presence)
- [ ] Friends list in React (online/in-match status via game-server presence)
- [ ] Invite-to-room deep links (friend → join room)
- [ ] In-lobby chat (room-scoped)
- [ ] "Recently played with" on the profile

**Exit criteria:** add a friend, see them online, invite them into your private room.

---

## ⏳ Phase 6 — Meta Progression & Economy

- [ ] Coins → unlockable characters + cosmetic skins (palette-based, matching the
      procedural sprite pipeline)
- [ ] `unlocks`/`inventory` tables + shop API
- [ ] Daily/weekly quests + achievements (first blood, wave 10, 1000 kills…)
- [ ] Account titles/badges tied to account level
- [ ] Character select screen in React (Phase 2 lobby integration)
- [ ] Strictly cosmetic — no pay-to-win

**Exit criteria:** play a match, earn coins, unlock a second character, equip a
skin, see it in the lobby and in-game.

---

## ⏳ Phase 7 — Content Expansion

- [x] **Puck companion** — tiny friendly familiar that hovers by the player's
      shoulder (bobbing, flapping wings, blue glow). Rescued from the friend's
      experimental branch and cleaned of the placeholder redirect mess
- [ ] 2 new characters (4 total: Berserker, Hexer, Stalker, Warden)
- [ ] 3–4 new co-op maps + 3–4 arena maps in `levelData`
- [ ] New enemy types + second boss + elite variants
- [ ] In-browser map editor exporting `LEVELS`-format data
- [ ] Seasonal events (palette swaps + reskins + limited quests)

**Exit criteria:** content ships monthly without touching core systems.

---

## ⏳ Phase 8 — Scale & Production

- [ ] Telemetry: match stats, latency histograms, crash reporting (Sentry)
- [ ] Anti-cheat hardening: input validation, rate limits, anomaly detection
- [ ] Regional game servers + sharded rooms
- [ ] Matchmaking tuning via MMR distributions
- [ ] Optional: WebRTC P2P fallback for small private rooms
- [ ] Mobile polish (existing joystick) + performance budgets

---

## 🧊 Evergreen / cosmetic extras

- [x] Puck-style elf companion that hovers beside Guts (tiny, flies along,
      ignores enemies/terrain — cosmetic only)
- [x] START now redirects to an empty `placeholder.html` page instead of
      launching the game (temporary gate while the game is taken down)

---

## Testing & verification habits

- [x] Sim logic: vitest suites (pure functions stay pure — this is what makes the
      shared sim trustworthy on the server)
- [x] API: Docker E2E script (register → login → matches → refresh → 401 paths)
- [x] Browser E2E via Playwright for critical flows (boot, auth, profile, match sync)
- [ ] API unit tests (pytest) for rewards/level math (once local Python is set up)
- [ ] Game-server integration test: N simulated clients + bots in a room, checks
      snapshot consistency

## Rules of the road

1. **`ROADMAP.md` is updated with every change** — check boxes, add tasks, move
   status lines. Never leave a merged PR without a matching roadmap update.
2. Every feature ships: tests → typecheck → lint → build → PR → CI → deploy.
3. Client never trusts the client: progression, rewards, and combat authority live
   server-side.
4. `packages/sim` stays pure (no DOM, no I/O) — it is the contract between browser
   and server.
5. After any API schema change: re-run `services/api/init.sql` on Neon and note it
   in the PR description.