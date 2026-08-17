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
} from "./config";

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
} from "./state";

import { AudioFX } from "./audio";
import { Settings } from "./theme";
import { clearFX } from "./fx";
import { clearBanners, showBanner } from "./banners";
import { clearDashRequest } from "./input";
import { buildLevel, LEVELS, currentLevel, levelIndex } from "./levels";
import { player, enemies, loot, projectiles, resetPlayer } from "./entities";
import { setButtons, makeButton, makeCard, type UIButton } from "./ui";
import { rollUpgradeOptions, type Upgrade } from "@dark-fantasy/sim";
import { openAuthModal } from "./auth";

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
    player.pickedUpgrades = [];
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
    stats.damageDealt = 0;
    stats.byType = {};

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
        makeButton("START", startGame, 220),
        makeButton("ACCOUNT", openAuthModal, 280),
        makeButton("SETTINGS", openSettings, 340)
    ]);
}

export function togglePause() {
    if (gameState === "playing") {
        setGameState("paused");
        setButtons([
            makeButton("RESUME", togglePause, 190),
            makeButton("RESTART", restartGame, 250),
            makeButton("SETTINGS", openSettings, 310),
            makeButton("TITLE", goTitle, 370)
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
        makeButton("PLAY AGAIN", restartGame, 300),
        makeButton("TITLE", goTitle, 360)
    ]);
}

export function victory() {
    setGameState("victory");
    saveHighScore();
    AudioFX.fanfare();
    setButtons([
        makeButton("PLAY AGAIN", restartGame, 330),
        makeButton("TITLE", goTitle, 390)
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

let upgradeOptions: Upgrade[] = [];

function makeUpgradeCards(): UIButton[] {
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
            },
            option.id
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

export function chooseUpgrade(index: number) {
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

function applyUpgrade(id: string) {
    player.pickedUpgrades.push(id);

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

// ======================
// SETTINGS
// ======================

let settingsFrom = "title";

export function openSettings() {
    settingsFrom = gameState === "paused" ? "paused" : "title";
    setGameState("settings");
    rebuildSettingsButtons();
}

function rebuildSettingsButtons() {
    setButtons([
        makeButton("VOLUME " + Math.round(Settings.volume * 100) + "%", cycleVolume, 160, 320),
        makeButton("SCREEN SHAKE: " + (Settings.shake ? "ON" : "OFF"), toggleShake, 220, 320),
        makeButton("REDUCED MOTION: " + (Settings.reducedMotion ? "ON" : "OFF"), toggleReducedMotion, 280, 320),
        makeButton("BACK", closeSettings, 340, 320)
    ]);
}

export function closeSettings() {
    if (settingsFrom === "paused") {
        setGameState("paused");
        setButtons([
            makeButton("RESUME", togglePause, 190),
            makeButton("RESTART", restartGame, 250),
            makeButton("SETTINGS", openSettings, 310),
            makeButton("TITLE", goTitle, 370)
        ]);
    } else {
        goTitle();
    }
}

function cycleVolume() {
    Settings.volume = ((Math.round(Settings.volume * 4) + 1) % 5) / 4;
    Settings.save();
    AudioFX.setVolume(Settings.volume);
    rebuildSettingsButtons();
}

function toggleShake() {
    Settings.shake = !Settings.shake;
    Settings.save();
    rebuildSettingsButtons();
}

function toggleReducedMotion() {
    Settings.reducedMotion = !Settings.reducedMotion;
    Settings.save();
    rebuildSettingsButtons();
}

// Apply the persisted volume before the first audio context exists.
AudioFX.setVolume(Settings.volume);