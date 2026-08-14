// ======================
// FLOW (start, restart, pause, death, victory)
// ======================

import {
    PLAYER_BASE_HEALTH,
    ATTACK_BASE_DAMAGE,
    ATTACK_BASE_RANGE,
    LEVEL_XP_BASE,
    LEVEL_HEAL,
    WAVE_BREAK_TIME,
    DASH_COOLDOWN,
    VIEW_WIDTH,
    VIEW_HEIGHT
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
    setNewHighScore,
    camera,
    resetCamera
} from "./state.js";

import { AudioFX } from "./audio.js";
import { clearFX } from "./fx.js";
import { clearBanners, showBanner } from "./banners.js";
import { clearDashRequest } from "./input.js";
import { buildLevel, LEVELS, currentLevel, levelIndex } from "./levels.js";
import { player, enemies, loot, projectiles, resetPlayer } from "./entities.js";
import { setButtons, makeButton, makeCard } from "./ui.js";
import { rollUpgradeOptions } from "./logic/upgrades.js";

export function resetRun() {
    buildLevel(0);

    player.maxHealth = PLAYER_BASE_HEALTH;
    player.health = PLAYER_BASE_HEALTH;
    player.damage = ATTACK_BASE_DAMAGE;
    player.range = ATTACK_BASE_RANGE;
    player.level = 1;
    player.xp = 0;
    player.xpNext = LEVEL_XP_BASE;
    player.attackSpeedMult = 1;
    player.speedMult = 1;
    player.dashCooldownTime = DASH_COOLDOWN;
    player.critChance = 0;
    player.lifesteal = 0;
    player.cleaveMult = 1;
    player.pendingLevels = 0;
    resetPlayer();

    resetCamera();
    camera.x = player.x + player.width / 2 - VIEW_WIDTH / 2;
    camera.y = player.y + player.height / 2 - VIEW_HEIGHT / 2;
    if (currentLevel) {
        const worldW = currentLevel.cols * 50;
        const worldH = currentLevel.rows * 50;
        camera.x = Math.max(0, Math.min(worldW - VIEW_WIDTH, camera.x));
        camera.y = Math.max(0, Math.min(worldH - VIEW_HEIGHT, camera.y));
    }
    camera.prevX = camera.x;
    camera.prevY = camera.y;

    enemies.length = 0;
    loot.length = 0;
    projectiles.length = 0;

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
    clearDashRequest();
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
    projectiles.length = 0;
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
        clearDashRequest();
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
    projectiles.length = 0;

    player.x = currentLevel.spawn.x;
    player.y = currentLevel.spawn.y;
    player.prevX = player.x;
    player.prevY = player.y;

    resetCamera();
    camera.x = player.x + player.width / 2 - VIEW_WIDTH / 2;
    camera.y = player.y + player.height / 2 - VIEW_HEIGHT / 2;
    const worldW = currentLevel.cols * 50;
    const worldH = currentLevel.rows * 50;
    camera.x = Math.max(0, Math.min(worldW - VIEW_WIDTH, camera.x));
    camera.y = Math.max(0, Math.min(worldH - VIEW_HEIGHT, camera.y));
    camera.prevX = camera.x;
    camera.prevY = camera.y;

    player.health = Math.min(player.maxHealth, player.health + LEVEL_HEAL);

    setWave(wave + 1);
    setWaveState("break");
    setWaveTimer(WAVE_BREAK_TIME);

    addScore(500);
    showBanner("LEVEL " + (levelIndex + 1), currentLevel.name + " · +500", 3);
}

// ======================
// LEVEL-UP CHOICES
// ======================

let upgradeOptions = [];

function makeUpgradeCards() {
    const y = 220;
    const w = 180;
    const h = 130;
    const gap = 25;
    const total = upgradeOptions.length * w + (upgradeOptions.length - 1) * gap;
    const startX = (VIEW_WIDTH - total) / 2;

    return upgradeOptions.map(function (option, index) {
        return makeCard(
            option.name,
            option.desc,
            index + 1,
            startX + index * (w + gap),
            y,
            w,
            h,
            function () {
                chooseUpgrade(index);
            }
        );
    });
}

export function openLevelUpChoice() {
    if (player.pendingLevels <= 0) {
        return;
    }

    player.pendingLevels--;
    upgradeOptions = rollUpgradeOptions(3, Math.random);

    setGameState("levelup");
    setButtons(makeUpgradeCards());
    AudioFX.levelUp();
}

export function chooseUpgrade(index) {
    if (gameState !== "levelup") {
        return;
    }

    const option = upgradeOptions[index];

    if (!option) {
        return;
    }

    applyUpgrade(option.id);
    AudioFX.pickup();

    if (player.pendingLevels > 0) {
        openLevelUpChoice();
    } else {
        setGameState("playing");
        setButtons([]);
    }
}

function applyUpgrade(id) {
    switch (id) {
        case "damage":
            player.damage += 6;
            break;

        case "range":
            player.range += 10;
            break;

        case "speed":
            player.attackSpeedMult *= 0.88;
            break;

        case "vitality":
            player.maxHealth += 20;
            player.health = Math.min(player.maxHealth, player.health + 20);
            break;

        case "boots":
            player.speedMult += 0.1;
            break;

        case "reflex":
            player.dashCooldownTime *= 0.85;
            break;

        case "crit":
            player.critChance += 0.1;
            break;

        case "lifesteal":
            player.lifesteal += 0.05;
            break;

        case "cleave":
            player.cleaveMult += 0.5;
            break;
    }
}