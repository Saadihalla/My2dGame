# ⚔ Dark Fantasy

A dark fantasy arena survival game — evolved from a vanilla JS canvas project into a
**React + TypeScript + FastAPI** monorepo, built toward real-time multiplayer.

## Monorepo layout

| Path | What it is |
|------|------------|
| `apps/web` | React 19 + Vite + TypeScript. The game engine (ported from vanilla JS) runs on a canvas inside a React shell; menus, lobby, friends and profile UI grow here |
| `packages/sim` | **The shared simulation** — pure, framework-free game logic (collision, AI, waves, spawns, loot, upgrades, levels, tween). Runs in the browser *and* on the future game server, so client prediction and server authority use identical code. Fully unit-tested |
| `services/api` | FastAPI + SQLAlchemy + Neon (Postgres) + JWT auth (access + rotating refresh tokens). Accounts, stats, friends and ranks live here |

## Setup

```bash
pnpm install
pnpm --filter @dark-fantasy/sim test        # 91 unit tests on the pure game logic
pnpm --filter @dark-fantasy/web dev         # play the game at http://localhost:5173
pnpm -r typecheck                            # strict TS across the workspace
pnpm -r build
```

## How to play

- **W A S D / arrows** — move
- **SPACE / ⚔ button** — attack (hold to keep swinging)
- **SHIFT / double-tap a direction / » button / gamepad X** — dash (i-frames, pixel trail)
- **P / Esc / ❚❚ button / gamepad Start** — pause
- **R / ↻** — restart
- Survive 10 waves across 3 levels (Forest Ruins → Crypt → Highlands), clear wave 10 to win
- Enemies: grunts, stalkers, bulwarks, imps, hexers, bombers, wardens, and the **Pale King** boss every 5th wave
- XP → pick-3 upgrade choices; potions and sword upgrades drop from kills
- **Account** (title screen → ACCOUNT): register/login via the FastAPI API with real JWT tokens. Falls back to localStorage when the API is unreachable (local dev)

## API (services/api)

Deploys to Railway (Docker). Set `DATABASE_URL`, `JWT_SECRET`, `CORS_ORIGINS` in Railway.

| Endpoint | Purpose |
|----------|---------|
| `POST /api/auth/register` | Create account → tokens |
| `POST /api/auth/login` | Login → tokens |
| `POST /api/auth/refresh` | Rotate refresh token |
| `GET /api/me` | Current profile + stats |
| `POST /api/me/stats` | Update stats (level/xp/coins/high_score) |
| `GET /api/health` | Liveness probe |

First deploy: run `services/api/init.sql` against your Neon database (matches the
schema the old Vercel functions created, so existing accounts keep working).

In `apps/web`, set `VITE_API_URL` to the deployed API URL (empty = same origin).

## Deployment

- **Vercel** — `apps/web` (see `vercel.json`, installs with pnpm, builds the web app)
- **Railway** — `services/api` via `Dockerfile` + `railway.json`; **Neon** — Postgres
- The real-time game server (Colyseus) is the next phase; it will be another Railway service consuming `packages/sim`

## Roadmap status

- ✅ Phase 0 — monorepo, TS port, sim extraction, React shell, FastAPI + JWT auth
- ✅ Phase 1 — profile page, match history, server-side XP/coins/level progression
- ⏳ Phase 2 — Colyseus rooms, co-op multiplayer, client prediction
- ⏳ Phase 3+ — bots, matchmaking, PvP, ranks, friends, meta progression

## Legacy

The pre-0.3.0 vanilla JS single-page version is in git history (`git checkout 1c954cc^`).