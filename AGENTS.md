# Project Guide — Dark Fantasy

Multiplayer arena-survival game. Monorepo: React+TS game (`apps/web`), shared pure
simulation (`packages/sim`), FastAPI backend (`services/api`), future Colyseus server
(`services/game`, Phase 2).

## Commands (run from repo root)

- `pnpm --filter @dark-fantasy/sim test` — 91 unit tests on pure game logic
- `pnpm -r typecheck` / `pnpm -r lint` / `pnpm -r build`
- `pnpm --filter @dark-fantasy/web dev` — local dev server
- API: Docker build + run against local Postgres for E2E (no local Python needed)

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
- Neon Postgres → schema in `services/api/init.sql`
- Vercel project settings override local config where set — when deploying a new
  project, prefer `vercel.json` fields the cloud schema accepts (it rejects
  `rootDirectory`).