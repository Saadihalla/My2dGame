# Dark Fantasy → Eclipse Arena: Multiplayer Roadmap

A complete plan to turn the single-player "Dark Fantasy" into a multiplayer
game with rooms, friends, bots, ranks, persistent upgrades, multiple
characters, and maps.

---

## 1. What you already have (repo study)

### Strengths — keep these, they are your head start

| Asset | Why it matters |
|---|---|
| **Pure logic layer** (`src/logic/*`) | Collision, waves, AI, spawns, loot, upgrades are pure functions with no DOM/canvas imports. They can run **unchanged on a game server** — this is the #1 advantage for multiplayer. |
| **Fixed 60Hz timestep + render interpolation** | The simulation is already deterministic and frame-rate independent. Exactly what a server tick needs. |
| **Unit tests** (`tests/*.test.js`, vitest) | You can move the logic to a shared package and keep all tests green. Rare for a beginner project — genuinely impressive. |
| **Procedural sprite pipeline** (`tools/generate-sprites.js`, `spritesheet.json`, `preview-sprites.js`) | You generate pixel art in code. New characters/skins = new data + a script run, not hand-drawn assets. |
| **Auth + Neon Postgres + bcrypt** | Accounts already exist (`api/register.js`, `api/login.js`, `players` / `player_stats` tables). |
| **Juice systems** | Hit-stop, particles, shake, vignette, pixel-dash — these stay 100% client-side and keep feeling great in multiplayer. |
| **WebAudio synth SFX** | No audio assets to manage; works everywhere. |
| **Gamepad + mobile + keyboard** | Input already abstracts into a single `keys` object + edge-triggered flags. Easy to convert into "input intents" to send over the network. |

### What blocks multiplayer (honest list)

1. **Global singletons everywhere.** `player` is one object in `entities.js`;
   `enemies`, `loot`, `projectiles` are module-level arrays; `gameState`,
   `wave`, `stats` are mutable exports of `state.js`. Multiplayer needs
   *collections of players* and a *per-room world state*.
2. **Simulation and presentation are fused.** `entities.js` both updates and
   draws; `updatePlayer()` reads `keys` directly from the DOM. A server can't
   run that.
3. **No network layer at all.** No rooms, no sync, no server concept.
4. **Security flaw:** the auth fallback stores **plaintext passwords in
   localStorage** (`src/auth.js`). This must die in Phase 0.
5. **Camera/HUD/overlays assume exactly one local player** (they're actually
   easy to generalize — the hard part is 1 & 2).

---

## 2. The vision

One game, three modes, all sharing one engine:

| Mode | Players | Bots | What it is |
|---|---|---|---|
| **Co-op Survival** | 2–4 | Optional | The game you have today, together. Shared waves, scaled enemy HP, per-player XP/upgrades, everyone dies or nobody wins. |
| **Arena (PvP)** | 2–8 | Optional | Deathmatch on symmetric arenas. Ranked + casual. Character kits only — no account perks (fair play). |
| **Solo** | 1 | Optional | Your current game, now part of the same system (progress, unlocks). |

Social layer: friends list, presence ("in a lobby with 3 others"), private
room codes, invites, room chat, ranked tiers, leaderboards.

---

## 3. Recommended tech stack

```
┌───────────────────────────────  CLIENT  ───────────────────────────────┐
│  Vite + vanilla Canvas 2D (your engine, kept as-is) + Colyseus SDK     │
│  TypeScript (progressive migration)                                    │
├──────────────────────────────  SHARED  ────────────────────────────────┤
│  packages/shared — pure game logic (moved from src/logic), balance     │
│  data, Colyseus schema classes, protocol messages — runs in both       │
│  browser and Node                                                      │
├──────────────────────────────  SERVER  ────────────────────────────────┤
│  Node.js 20+ · Colyseus 0.17 (rooms, matchmaking, state sync)          │
│  Express 5 REST (auth, friends, profiles, match history)               │
│  JWT auth (httpOnly cookies) · zod validation                          │
│  Neon Postgres (you already use it) · Redis/Upstash later (scale)      │
│  Deployed on Railway or Fly.io (long-lived WebSockets)                 │
└─────────────────────────────────────────────────────────────────────────┘
```

### Decisions and why

| Choice | Why (and the alternatives you'd be turning down) |
|---|---|
| **Colyseus 0.17** (over raw `ws`, Socket.IO, or Photon) | Purpose-built for exactly this: authoritative server, rooms, built-in matchmaking, delta-compressed state sync, automatic reconnection, rate limiting, full-stack TypeScript types. Socket.IO is chat-shaped, not game-shaped; raw `ws` means writing a sync protocol from scratch. |
| **Keep your custom engine** (over Phaser/Godot/Unity) | Your engine already does fixed timestep, interpolation, and tested logic — all the hard parts. Phaser would be a full rewrite for zero multiplayer benefit. Your engine + Colyseus is a proven, common combo. |
| **Server-authoritative simulation** | The server runs the game (30Hz tick) reusing your pure logic; clients send inputs and render states. This is the only way ranks/leaderboards mean anything and it's *cheaper* to build than client-authoritative here because your logic is already headless-friendly. |
| **TypeScript** | The single biggest safety upgrade: the shared protocol and room state get compile-time checked on both ends. Migrate gradually — new files in TS, old files when you touch them. |
| **One Node server for WS + REST** (moving `api/` off Vercel) | Vercel serverless **cannot** hold long-lived WebSocket rooms. Consolidating REST + rooms in one Node app means one deployment, one DB connection pool, one auth scheme. Frontend stays on Vercel (it's already configured). |
| **Railway / Fly.io** | Simple deploys with real WebSockets. Railway is the easiest for a solo dev; Fly.io if you want regional latency control later. |
| **Neon Postgres** | Already working. Friends, profiles, matches, unlocks, rankings are all relational — perfect fit. |
| **JWT + httpOnly cookie** | Standard, works across the REST API and Colyseus `onAuth`. |
| **Vitest stays** | Add server integration tests next to your existing logic tests. |

### Proposed repo layout (npm workspaces monorepo)

```
My2dGame/
├── apps/
│   ├── client/            # Vite + your engine (src/ from today, refactored)
│   └── server/            # Colyseus rooms + Express REST
├── packages/
│   └── shared/            # pure logic, balance data, schemas, protocol
├── tools/                 # sprite generators (kept, extended)
└── tests/                 # moves into packages/shared
```

---

## 4. Architecture

### Data flow (the mental model)

```
 [Client A]  input intents ──┐                    ┌── state patches ──► [Client A]
 [Client B]  input intents ──┼──► Colyseus Room ──┼── state patches ──► [Client B]
 [Bot C]     server-internal ┘    (30Hz tick)     └── state patches ──► [Client C]
                                  │
                                  ▼
                     Colyseus Schema state (players, enemies,
                     loot, projectiles, wave, scores)
                                  │
                                  ▼ (match end)
                     Postgres: matches, match_players, rankings
```

- **Client sends:** movement vector, attack pressed, dash requested,
  upgrade choice, chat. Never positions, never damage.
- **Server sends:** Colyseus schema patches (positions, health, states,
  drops, wave info). Delta-compressed automatically.
- **Client renders:** remote entities *interpolated* between past snapshots;
  local player gets prediction in Phase 8.
- **Bots** are just simulated players inside the room — no extra
  infrastructure.

### Sync plan

| Topic | Decision |
|---|---|
| Server tick | 30Hz (matches your 60Hz logic by running 2 steps/tick initially; can drop to 20Hz for PvE later) |
| State | Colyseus `Schema` mirroring your entity shapes: `players: MapSchema`, `enemies: ArraySchema`, plus wave/room meta |
| Input | Coalesced intents sent at ~30Hz; server clamps movement speed so no "speed hacks" |
| Remote players | 100ms interpolation buffer |
| Local player | Direct authority echo at first; add prediction + reconciliation in Phase 8 |
| Latency UX | Show ping in HUD; Colyseus has `room.ping()` |
| Disconnects | Colyseus 0.17 automatic reconnection + `onDrop`/`onReconnect`; DC'd player's character becomes idle/safe, or a bot takes over (toggle) |
| Interest management | Later: only sync enemies within ~2 screens of each player (Phase 10 perf) |

### Anti-cheat (cheap and effective because you're authoritative)

- Never trust client positions/damage/currency.
- Rate-limit messages (`maxMessagesPerSecond` in Colyseus).
- Server-side movement clamping (already implied by `PLAYER_SPEED`).
- All XP/coins/ranks awarded by the server from the simulation it ran.

---

## 5. Data model (Postgres)

```sql
users            (id, username UNIQUE, password_hash, created_at)
player_stats     (player_id FK, level, xp, coins, total_kills, total_wins,
                  total_matches, playtime_seconds, best_score)
friendships      (player_low FK, player_high FK, status, created_at)
                  -- status: pending_from_low / friends / blocked
matches          (id, mode, map_id, seed, started_at, ended_at, winner_id)
match_players    (match_id FK, player_id FK, character_id, kills, deaths,
                  score, rating_before, rating_after, rating_delta, is_bot)
rankings         (player_id FK, mode, rating, peak_rating, tier, updated_at)
player_characters(player_id FK, character_id, unlocked_at)
player_skins     (player_id FK, skin_id, unlocked_at, equipped)
player_perks     (player_id FK, perk_id, level)      -- persistent upgrades, PvE-only
```

Design notes:

- **Friendship invariant:** always store the pair as `(low_id, high_id)` with
  a `UNIQUE` constraint so duplicate requests are impossible.
- **Perks vs PvP:** persistent upgrades apply to Co-op and Solo only. Ranked
  PvP uses characters only. This is the rule that keeps ranks meaningful.
- **Match seed** stored per match → replays and "same lobby, rematch"
  become possible later.

---

## 6. Characters & design

### Launch roster (4 characters, all built from your sprite tooling)

| Character | Playstyle | Stats twist vs. today's hero |
|---|---|---|
| **Black Swordsman** (existing hero) | Balanced melee | Reference kit — exactly today's stats/upgrades |
| **Shadow Stalker** | Fast hit-and-run | 40% more speed, 30% less HP, faster/stronger dash, shorter range |
| **Hexer** | Ranged caster | Ranged bolt attack (reuse projectile rendering), mana bar replaces stamina-ish cooldown, fragile |
| **Warden** | Tank/cleave | +50% HP, slower, bigger cleave arc, shield block facing (reuse warden enemy logic) |

### Character design system

- Each character = a **data file** (`character_id, name, description, stats
  block, animations, palette`). New character = new data, not new code.
- Your `tools/generate-sprites.js` already writes frames into
  `spritesheet.json` + PNG. Extend it so each character gets its own sheet
  section (idle/walk/attack/hurt/death — you already have these states).
- **Skins** = palette swaps + tiny accessories (helm, cape, glow). Trivial in
  your system since sprites are colored rects. Unlockable with coins.
- Character select happens in the lobby (Phase 3 UI) and is shown to everyone
  (big name tag + colored outline above each player).

---

## 7. Maps

### Format evolution (current `LEVELS` in `src/logic/levelData.js`)

```js
{
  id: "forest_ruins",          // stable id for DB
  name: "Forest Ruins",
  modes: ["pve", "solo"],      // which modes allow this map
  cols: 32, rows: 20,
  spawns: [{ x: 100, y: 100 }, ...],   // one per player slot (was: single spawn)
  portal: { x: 1450, y: 850 },
  palette: { ... },            // unchanged
  tiles: [...],                // unchanged (still hand-authored strings)
  obstacles: [...],            // trees/rocks/water — unchanged format
  torches: [...]
}
```

### Plan

1. **Extend the format** (spawns array, `modes` tag) — PvE maps get 4 spawn
   points so 4 players can start apart.
2. **3 existing PvE maps** stay (Forest Ruins, Crypt, Highlands) — they
   become your co-op content.
3. **3 new PvP arenas:** symmetric layouts, no portal, no water-death
   cheese, torches instead of darkness so fights read clearly (or "Eclipse"
   arena where the light zone shrinks — fun twist for later).
4. **Bots-aware spawns:** server picks spawns with minimum distance between
   players.
5. **Map editor (Phase 9):** optional — Tiled `.tmx` export or an in-browser
   painter. Not needed to launch; hand-authored strings scale to ~15 maps.

---

## 8. The roadmap — 11 phases

Estimates assume you're working solo, evenings/weekends. **Rule: every phase
ends shippable and playable.** Never start a phase with broken work.

---

### Phase 0 — Foundations (≈ 1–2 weeks)

*"Nothing visible changes, but everything gets easier."*

- [ ] Create npm-workspaces monorepo: `apps/client`, `apps/server`,
      `packages/shared`. Move `src/` into `apps/client/src`.
- [ ] Move `src/logic/*` + `tests/*` into `packages/shared`. **All 11 vitest
      suites must pass with zero logic changes.**
- [ ] Introduce TypeScript: `tsconfig` for shared + server; new files in TS;
      migrate existing files file-by-file as you touch them (no big-bang
      rewrite).
- [ ] **Delete the plaintext-password localStorage fallback** in `src/auth.js`
      and the `darkFantasyUsers` path. Auth goes through the API only.
- [ ] Add `npm run dev:all` (concurrently run client + server), keep `lint`,
      `test`, `build` scripts working in CI (GitHub Actions).
- [ ] Pick the server host now: **Railway** (easiest) or **Fly.io**. Empty
      Node app deployed with a health check.

**Definition of done:** `npm test` green, client still runs solo as before,
server answers `/health` in production.

**Why first:** moving logic is trivial today (it's pure!) and gets 10x
harder once the sim becomes multiplayer. Security fix can't wait.

---

### Phase 1 — First multiplayer slice (≈ 2 weeks)

*"Hello, multiplayer." — two browsers, one room, visible movement.*

- [ ] Colyseus 0.17 server (`defineServer`, per the official quickstart).
- [ ] `LobbyRoom`: players connect, see a room list (name, player count,
      public/private), create/join rooms by name.
- [ ] Minimal `GameRoom` state: `players: MapSchema` with `x, y, name,
      color`. Server runs a 30Hz tick that just applies movement intents
      (no collision yet).
- [ ] Client: connect via Colyseus SDK, send `{moveX, moveY}` intents, render
      *remote* players as simple colored boxes at interpolated positions.
- [ ] Spawn bots: add a `bots: 2` option that fills the room with server-side
      wanderers.
- [ ] Move your existing camera code to a shared "follow the set of
      players" view (center of mass) — first generalization of the single-player
      camera.

**Definition of done:** open two browser windows, both join the same room,
see each other move; add a bot with a button; disconnect one player — the
other keeps playing.

**Why this shape:** the entire multiplayer stack (host, rooms, sync,
interpolation, bots) exists in its final form. Everything after this phase
is *content* on top.

---

### Phase 2 — Co-op survival, the real game (≈ 3–4 weeks)

*Your game, together. This is the emotional milestone.*

- [ ] Refactor `entities.js` into **two layers**:
      - `shared/simulation`: world state (players[], enemies[], loot[],
        projectiles[], wave, portal) + `step(world, inputs, dt)` — pure,
        headless, runs on server. Reuses `collision.js`, `waves.js`,
        `ai.js`, `spawn.js`, `loot.js`, `upgrades.js` as-is.
      - `client/render`: drawing only (existing draw functions, particles,
        shake, vignette, dash pixel-effect).
- [ ] Server `GameRoom` runs the simulation at 30Hz with Colyseus `Schema`
      state: positions/health/states per player, enemies array, wave info.
- [ ] Co-op wave scaling: `waveEnemyList(wave, playerCount)` — +40% enemies
      and +25% HP per extra player (keep it in `shared` with tests).
- [ ] Shared progression: kills/score are per-player; **wave clears, portals,
      and victory are shared**. Level-up choice is per-player and pauses
      only that player (server sends a `levelup` prompt to that client only).
- [ ] Player-to-player collision (soft shove, like the existing
      `resolveEnemyOverlaps`).
- [ ] **Bots in co-op:** fill empty slots with server-side allies that hunt
      the nearest enemy and pick upgrades automatically (simple greedy rule).
- [ ] Death handling: dead players spectate (watch teammates) until the room
      ends; "last alive" +1 life revive if enabled.
- [ ] Match end → results screen (scoreboard: kills, damage, deaths,
      survived, XP earned) → write to Postgres (`matches`,
      `match_players`).

**Definition of done:** invite a friend (or add 3 bots), play through wave 5
together, watch each other's dash trails and damage numbers, get a scoreboard.

**Risks:** player-upgrade choice flow ("pause one player") is the fiddliest
part; build it as a simple modal on top of the existing upgrade-card code.

---

### Phase 3 — Rooms & lobby UX (≈ 2 weeks)

*Where "play with/against your friends" becomes a real product.*

- [ ] Full lobby screen (replaces the title screen's START):
      - **Create room** — name, mode (co-op/arena-later), map, player
        slots, bots on/off + count, public or private.
      - **Room browser** — public rooms with player counts + join button.
      - **Join by code** — 6-char code for private rooms (share with
        friends).
      - **In-room lobby** — player slots, ready-up, host controls
        (start, kick, add bots, change map), **room chat**.
      - **Character select** — placeholder grid now, real data in Phase 5.
- [ ] Host-migration: if the host leaves, promote another player.
- [ ] Lobby state is itself a Colyseus room (`LobbyRoom` + metadata) — free
      live room list, auto-refreshing.

**Definition of done:** you can create a private room, text a friend the
code, they join, chat, ready up, and the host launches co-op from Phase 2.

---

### Phase 4 — Real accounts & friends (≈ 2–3 weeks)

*Identity + the social graph.*

- [ ] Replace Vercel `api/` with Express routes on the game server:
      `POST /auth/register`, `POST /auth/login`, `POST /auth/logout`,
      `GET /auth/me`, `POST /auth/refresh`. JWT in httpOnly cookie.
- [ ] Move `players` / `player_stats` access from the old functions to the
      new server (same Neon DB — no migration of data).
- [ ] Colyseus `onAuth` validates the JWT; guests play with a temp name
      (visible as "Guest·xxxx") until they log in.
- [ ] Friends API: `POST /friends/request`, `POST /friends/accept`,
      `DELETE /friends/:id`, `GET /friends` — backed by the `friendships`
      table.
- [ ] **Presence:** online status + current room via a tiny pub/sub (Colyseus
      presence or a `presence` column touched on connect/disconnect).
- [ ] **Invite to room:** from the friends list → sends a Colyseus
      `invite` message → friend sees a toast → joins the room.
- [ ] Friends list UI in the lobby with a friend's current room shown.

**Definition of done:** register → log in → add a friend → invite them → you
two are in a private co-op room together. Log out/in keeps everything.

---

### Phase 5 — Characters & cosmetics (≈ 2–3 weeks)

*Choice and identity.*

- [ ] Define the 4 characters as data (`packages/shared/characters.ts`) with
      stats blocks that feed the simulation (server validates stats, not
      client).
- [ ] Extend `tools/generate-sprites.js` to emit per-character sheet
      sections + `spritesheet.json` entries; add `preview-sprites` filtering
      by character.
- [ ] Character select screen (lobby + solo): preview sprite, stats bars,
      description.
- [ ] **Skins:** 2 palette skins per character at launch (e.g., "Ashen",
      "Blood Moon"). Unlock flow stubbed with coins from Phase 6.
- [ ] In-game player identity: name tag, colored outline, character
      silhouette so everyone reads at a glance who is who.
- [ ] Server-owned loadout: room stores `{characterId, skinId}` per player;
      simulation reads stats from server data only.

**Definition of done:** 4 playable characters in co-op with distinct
feeling, 8 skins rendered by your generator, teammates clearly
distinguishable in a 4-player match.

---

### Phase 6 — Progression & meta (≈ 2–3 weeks)

*The "upgrades and ranks" the title promises.*

- [ ] **Account progression:** XP + coins from every match (server-awarded
      from `match_players`), account levels with cosmetic rewards at levels
      5/10/25/50.
- [ ] **Coin shop:** unlock characters, skins. Prices set so ~10 co-op
      matches unlock a new character.
- [ ] **Persistent perk tree** (PvE/Solo only — *not* ranked PvP):
      e.g., +5% XP, +10 coins/match, +1 potion drop chance, starting +25 HP,
      dash recharge -5% (stackable, capped). Buy with coins, applies as
      server-side modifiers to the sim.
- [ ] Loadout screen: perks + character + skin.
- [ ] Daily quests (optional but sticky): "Slay 100 enemies", "Win a co-op
      match", "Play 3 matches".
- [ ] Backfill `player_stats` with new columns; keep old scores migrating.

**Definition of done:** play 5 matches, level up twice, unlock a skin, equip
a perk, see it change a co-op run (more potions, more XP), and verify it has
*zero* effect in a ranked arena (Phase 7).

---

### Phase 7 — PvP arena + ranked (≈ 4 weeks)

*"Against" your friends, with a ladder to prove it.*

- [ ] **Arena mode:** 2–8 players, symmetric maps, respawn-on-death with
      score + first-to-N-kills (or last-one-standing variant). Reuse the
      player-vs-player shove from Phase 2 + new player-vs-player damage.
- [ ] **Matchmaking queue:** Colyseus `QueueRoom` (built-in, 0.17) or your
      own simple queue — casual (anyone) and ranked (nearby rating).
- [ ] **Ranking:** Elo with K=32 per mode (simplest correct choice; upgrade
      to Glicko-2 later if desired). Store `rating_before/after` per match.
- [ ] **Tiers** (thematic): Iron → Bronze → Silver → Gold → Platinum →
      Diamond → **Eclipse Lord**. Tier = rating bands; season resets with
      3 placement matches.
- [ ] Leaderboard: top 100 by rating (page + endpoint), your own name
      highlighted.
- [ ] **Ranked = normalized:** all characters available, no perks, no skins
      advantage, no account-level bonuses. Skill only.
- [ ] Results screen with rating delta (+15 ▼ -12 style) and tier progress.
- [ ] Friend matches: private arena rooms with code (no rating change when
      private).

**Definition of done:** queue up, get matched near your rating, play a fair
4v4-style deathmatch, see rating change, check your tier on a leaderboard.
Private arena with friends doesn't touch your rating.

---

### Phase 8 — Network feel (≈ 2–3 weeks)

*From "works" to "feels right".*

- [ ] **Client-side prediction + reconciliation** for the local player in
      PvP (store inputs, re-simulate locally, correct on server state).
      This is the single biggest feel upgrade for fighting friends.
- [ ] Interpolation buffer tuning per mode (PvE can be lazier than PvP).
- [ ] Ping display in HUD + server-side `room.ping()`; warning icon above
      200ms.
- [ ] Reconnection polish: Colyseus `onDrop`/`onReconnect` — hold the seat,
      restore state without re-downloading everything; after 30s a bot
      takes over your character.
- [ ] Hit-stop/shake/vignette stay client-local (already the case — just
      verify they never touch simulation state).
- [ ] Snapshot smoothing: damped health bars, enemy velocity smoothing.

**Definition of done:** play a PvP match at ~80ms ping and your local
movement feels identical to solo play; a teammate who lags doesn't teleport
so hard.

**Note:** this phase deliberately comes *after* the game is feature-complete
— prediction is the hardest part of networking and you want a finished game
to justify it.

---

### Phase 9 — Content & bots (≈ 3–4 weeks)

*"Even better than I imagined" territory.*

- [ ] **Bots with difficulty levels:** Bronze/Silver/Gold bots — parameterize
      reaction time, attack frequency, decision noise, damage dealt (server
      only). Co-op allies get smarter (help the weakest player, bait
      exploders, guard the portal).
- [ ] 3 new PvE maps (use your hand-authored tile strings — e.g., "Sunken
      Chapel", "Blood Mire", "Highlands Citadel") + 2 new PvP arenas.
- [ ] 2 new enemy types with new AI states (e.g., "Charger" — telegraphed
      dash attack; "Vexer" — buffs nearby enemies; reuses your state-machine
      pattern in `logic/ai.js`).
- [ ] **New mode: Endless** (shared leaderboard for wave reached) — cheap to
      add since waves already compose from data.
- [ ] Map editor (optional): Tiled import or in-browser painter emitting the
      same tile-string JSON.
- [ ] Match history page (your own past matches + stats), replays via stored
      `seed` + input logs if ambitious.

**Definition of done:** a friend you invite to a Gold-bot co-op run asks
"wait, that was a bot?"

---

### Phase 10 — Scale, polish & launch (ongoing)

- [ ] Redis presence (Upstash) so rooms survive restarts and multiple server
      instances can share the room list; Colyseus Redis driver.
- [ ] Load test (e.g., 50 bots in rooms on one instance) to find the CCU
      ceiling; horizontal scale only when needed.
- [ ] Observability: logs (structured), error tracking (Sentry), simple
      metrics (rooms, players, tick time).
- [ ] Anti-cheat pass: rate limits, input validation, anomaly detection on
      score/damage deltas, report button.
- [ ] Mobile: touch controls already exist — verify 4-player matches on
      phones; bigger buttons in lobby.
- [ ] Performance: interest management (sync only nearby enemies), draw
      culling, sprite batching if needed.
- [ ] Community: Discord link, "copy room code" share button, seasonal
      ranked badges, first tournament (friendly).

---

## 9. Cross-cutting decisions (read these before you start)

1. **Server owns everything that matters.** Positions, damage, drops, XP,
   coins, ratings. Clients are terminals. This makes cheats nearly
   impossible and lets bots exist for free.
2. **Progression never touches ranked PvP.** The moment coins buy damage in
   ranked, the game dies. Perks = PvE. Ranks = skill.
3. **Solo play stays first-class.** Every multiplayer feature (bots, codes,
   characters) should also improve solo play, so you always have a
   playable game.
4. **Small network surface.** Inputs in, states out. No client-side
   simulation of enemies in multiplayer — one source of truth.
5. **Determinism where it matters.** Same seed → same waves/loot → fair
   matches and future replays. Your pure functions already make this free.
6. **Never trust the client's clock or wallet.** All timers and economy
   server-side.

---

## 10. Common pitfalls to avoid

| Pitfall | Countermeasure |
|---|---|
| Porting everything to a new engine | Keep the engine. It's good and it's yours. |
| P2P / WebRTC instead of a server | NAT punching, desync, and free cheating — avoid for years. |
| Adding prediction on day one | Phase 8, after the game exists. |
| Multiplayer everywhere at once | Co-op first (forgiving), PvP second. |
| Letting lag compensate by teleporting | Interpolation buffer + prediction; never "snap to latest". |
| Monetization before fun | Not in this roadmap at all. |
| Skipping tests "just this once" | The logic tests are your safety net through the refactor — keep them green every phase. |

---

## 11. First steps (this week)

1. Phase 0 tasks 1–2 only: monorepo + move `src/logic` to
   `packages/shared`. One evening, zero risk, everything still runs.
2. Phase 0 task 4: delete the localStorage plaintext password path.
3. Follow the Colyseus quickstart (`npm create colyseus-app@latest`) on
   your own machine and get the "moving boxes" demo up in one afternoon —
   it will make Phase 1 feel easy.

You're not starting from zero. You have a working, tested game whose
architecture was *accidentally* built for exactly this upgrade. The pure
logic layer is the whole reason this roadmap is 11 phases and not a rewrite.