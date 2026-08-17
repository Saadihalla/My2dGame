-- Dark Fantasy schema (Phase 0)
-- Run this against your Neon database (psql "$DATABASE_URL" -f init.sql).
-- The players/player_stats tables match the schema created by the old
-- Vercel serverless functions, so existing accounts keep working.

CREATE TABLE IF NOT EXISTS players (
    id            BIGSERIAL PRIMARY KEY,
    username      VARCHAR(30) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS player_stats (
    player_id  BIGINT PRIMARY KEY REFERENCES players(id) ON DELETE CASCADE,
    level      INTEGER NOT NULL DEFAULT 1,
    xp         INTEGER NOT NULL DEFAULT 0,
    coins      INTEGER NOT NULL DEFAULT 0,
    high_score INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
    id         BIGSERIAL PRIMARY KEY,
    player_id  BIGINT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    token_hash VARCHAR(64) UNIQUE NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_player ON refresh_tokens(player_id);

CREATE TABLE IF NOT EXISTS match_history (
    id            BIGSERIAL PRIMARY KEY,
    player_id     BIGINT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    mode          VARCHAR(20) NOT NULL DEFAULT 'solo',
    score         INTEGER NOT NULL DEFAULT 0,
    wave          INTEGER NOT NULL DEFAULT 1,
    kills         INTEGER NOT NULL DEFAULT 0,
    survived      INTEGER NOT NULL DEFAULT 0,
    damage_dealt  INTEGER NOT NULL DEFAULT 0,
    result        VARCHAR(10) NOT NULL DEFAULT 'victory',
    coins_earned  INTEGER NOT NULL DEFAULT 0,
    xp_earned     INTEGER NOT NULL DEFAULT 0,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_match_history_player ON match_history(player_id, created_at DESC);