// ======================
// FLOW (start, restart, pause, death, victory)
// ======================

import {
    PLAYER_BASE_HEALTH,
    ATTACK_BASE_DAMAGE,
    ATTACK_BASE_RANGE,
    LEVEL_XP_BASE,
    LEVEL_HEAL,
    WAVE_BREAK_TIME
} from "./config.js";

import {
    gameState,
    wave,
    stats,
    addScore,
    saveHighScore,
    setGameState,
    setWave,
    setWaveState,
    setWaveTimer,
    setPortalActive,
    setPortalTimer,
    setNewHighScore
} from "./state.js";

import { AudioFX } from "./audio.js";
import { clearFX } from "./fx.js";
import { clearBanners, showBanner } from "./banners.js";
import { buildLevel, LEVELS, currentLevel, levelIndex } from "./levels.js";
import { player, enemies, loot, resetPlayer } from "./entities.js";
import { setButtons, makeButton } from "./ui.js";

export function resetRun() {
    buildLevel(0);

    player.maxHealth = PLAYER_BASE_HEALTH;
    player.health = PLAYER_BASE_HEALTH;
    player.damage = ATTACK_BASE_DAMAGE;
    player.range = ATTACK_BASE_RANGE;
    player.level = 1;
    player.xp = 0;
    player.xpNext = LEVEL_XP_BASE;
    resetPlayer();

    enemies.length = 0;
    loot.length = 0;

    setWave(1);
    setWaveState("break");
    setWaveTimer(1.5);
    setPortalActive(false);
    setPortalTimer(0);

    stats.score = 0;
    stats.kills = 0;
    stats.hitsTaken = 0;
    stats.survived = 0;

    setNewHighScore(false);

    clearFX();
    clearBanners();
}

export function startGame() {
    resetRun();
    setGameState("playing");
    setButtons([]);
}

export function restartGame() {
    startGame();
}

export function goTitle() {
    setGameState("title");
    enemies.length = 0;
    loot.length = 0;
    setButtons([
        makeButton("START", startGame, 250)
    ]);
}

export function togglePause() {
    if (gameState === "playing") {
        setGameState("paused");
        setButtons([
            makeButton("RESUME", togglePause, 220),
            makeButton("RESTART", restartGame, 280),
            makeButton("TITLE", goTitle, 340)
        ]);
    } else if (gameState === "paused") {
        setGameState("playing");
        setButtons([]);
    }
}

export function onPlayerDeath() {
    setGameState("gameover");
    saveHighScore();
    AudioFX.kill();
    setButtons([
        makeButton("PLAY AGAIN", restartGame, 250),
        makeButton("TITLE", goTitle, 310)
    ]);
}

export function victory() {
    setGameState("victory");
    saveHighScore();
    AudioFX.fanfare();
    setButtons([
        makeButton("PLAY AGAIN", restartGame, 290),
        makeButton("TITLE", goTitle, 350)
    ]);
}

export function advanceLevel() {
    AudioFX.portal();

    buildLevel((levelIndex + 1) % LEVELS.length);

    setPortalActive(false);

    player.x = currentLevel.spawn.x;
    player.y = currentLevel.spawn.y;
    player.prevX = player.x;
    player.prevY = player.y;
    player.health = Math.min(player.maxHealth, player.health + LEVEL_HEAL);

    setWave(wave + 1);
    setWaveState("break");
    setWaveTimer(WAVE_BREAK_TIME);

    addScore(500);
    showBanner("LEVEL " + (levelIndex + 1), currentLevel.name + " · +500", 3);
}