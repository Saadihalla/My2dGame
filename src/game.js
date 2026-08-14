// ======================
// GAME (state machine, waves, loop)
// ======================

import {
    ctx,
    VIEW_WIDTH,
    VIEW_HEIGHT,
    WAVE_CLEAR_TIME,
    PORTAL_TIME,
    WAVE_VICTORY,
    FIXED_DT,
    MAX_FRAME_TIME
} from "./config.js";

import {
    gameTime,
    gameState,
    wave,
    waveState,
    waveTimer,
    portalActive,
    portalTimer,
    stats,
    addScore,
    addGameTime,
    setWaveState,
    setWaveTimer,
    setPortalActive,
    setPortalTimer,
    tickWaveTimer,
    tickPortalTimer
} from "./state.js";

import { registerFlow } from "./events.js";
import { AudioFX } from "./audio.js";
import {
    getShake,
    updateFX,
    drawParticles,
    drawNumbers,
    drawVignette,
    tickHitStop
} from "./fx.js";
import { pollGamepad } from "./input.js";
import { updateBanners, drawBanners, showBanner } from "./banners.js";
import {
    buildLevel,
    currentLevel,
    currentMap,
    solidObjects,
    drawMap,
    drawTorchLights,
    aabb
} from "./levels.js";
import {
    player,
    enemies,
    spawnEnemy,
    updatePlayer,
    updateEnemies,
    updateLoot,
    playerAttack,
    drawPlayer,
    drawEnemies,
    drawLoot,
    allEnemiesDead
} from "./entities.js";
import { drawHUD, drawOverlays } from "./ui.js";
import {
    startGame,
    restartGame,
    togglePause,
    onPlayerDeath,
    goTitle,
    advanceLevel,
    victory
} from "./flow.js";
import { waveEnemyList } from "./logic/waves.js";
import { findSpawnPoints } from "./logic/spawn.js";

registerFlow({
    startGame: startGame,
    restartGame: restartGame,
    togglePause: togglePause,
    playerDeath: onPlayerDeath
});

// ======================
// WAVES
// ======================

function spawnWave(waveNumber) {
    enemies.length = 0;

    const list = waveEnemyList(waveNumber);
    const points = findSpawnPoints(currentMap, solidObjects, player, list.length, {
        bounds: { x: 60, y: 60, w: VIEW_WIDTH - 200, h: VIEW_HEIGHT - 120 }
    });
    const hpScale = 1 + (waveNumber - 1) * 0.12;

    for (let i = 0; i < list.length; i++) {
        if (points.length === 0) {
            break;
        }
        const point = points[i % points.length];
        spawnEnemy(list[i], point.x, point.y, hpScale);
    }

    if (waveNumber % 5 === 0) {
        showBanner("BOSS APPROACHES", "Wave " + waveNumber, 3);
        AudioFX.boss();
    } else {
        showBanner("WAVE " + waveNumber, "", 2);
        AudioFX.wave();
    }

    setWaveState("active");
}

function updateWaves(dt) {
    if (waveState === "break") {

        tickWaveTimer(dt);
        if (waveTimer <= 0) {
            spawnWave(wave);
        }

    } else if (waveState === "active") {

        if (allEnemiesDead()) {
            const bonus = 150 * wave;
            addScore(bonus);

            AudioFX.clear();
            showBanner("WAVE " + wave + " CLEARED", "+" + bonus + " points", 2);

            setWaveState("clear");
            setWaveTimer(WAVE_CLEAR_TIME);
            setPortalActive(true);
            setPortalTimer(PORTAL_TIME);
        }

    } else if (waveState === "clear") {

        tickWaveTimer(dt);
        if (waveTimer <= 0) {
            if (wave >= WAVE_VICTORY) {
                victory();
            } else {
                setWaveState("portal");
            }
        }

    } else if (waveState === "portal") {

        tickPortalTimer(dt);

        const portalRect = {
            x: currentLevel.portal.x - 25,
            y: currentLevel.portal.y - 25,
            w: 50,
            h: 50
        };
        const playerRect = {
            x: player.x,
            y: player.y,
            w: player.width,
            h: player.height
        };

        if (aabb(portalRect, playerRect) || portalTimer <= 0) {
            advanceLevel();
        }
    }
}

// ======================
// UPDATE
// ======================

function update(dt) {
    addGameTime(dt);

    updateFX(dt);
    updateBanners(dt);

    if (gameState !== "playing") {
        return;
    }

    if (tickHitStop(dt)) {
        return;
    }

    stats.survived += dt;

    if (player.invuln > 0) {
        player.invuln -= dt;
    }

    updatePlayer(dt);
    updateEnemies(dt);
    updateLoot();
    playerAttack(dt);
    updateWaves(dt);
}

// ======================
// DRAW
// ======================

function drawPortal(gameTime) {
    if (!portalActive) {
        return;
    }

    const px = currentLevel.portal.x;
    const py = currentLevel.portal.y;
    const pulse = 0.5 + 0.5 * Math.sin(gameTime * 5);

    ctx.save();
    ctx.globalCompositeOperation = "lighter";

    const gradient = ctx.createRadialGradient(px, py, 4, px, py, 34 + pulse * 6);

    gradient.addColorStop(0, "rgba(255, 220, 90, 0.9)");
    gradient.addColorStop(0.6, "rgba(255, 160, 40, 0.35)");
    gradient.addColorStop(1, "rgba(255, 160, 40, 0)");

    ctx.fillStyle = gradient;
    ctx.fillRect(px - 44, py - 44, 88, 88);

    ctx.restore();

    ctx.fillStyle = "#fff3c4";
    ctx.font = "13px Arial";
    ctx.textAlign = "center";
    ctx.fillText("ENTER PORTAL", px, py + 44);
}

function draw(alpha) {
    ctx.clearRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);

    ctx.save();

    if (getShake() > 0.1) {
        const s = getShake();
        ctx.translate(
            (Math.random() - 0.5) * s,
            (Math.random() - 0.5) * s
        );
    }

    drawMap(gameTime);
    drawTorchLights(gameTime);
    drawPortal(gameTime);
    drawLoot(gameTime);
    drawParticles();
    drawPlayer(gameTime, alpha);
    drawEnemies(gameTime, alpha);
    drawNumbers();

    ctx.restore();

    // Lighting (darkness around the player)

    const centerX = player.x + player.width / 2;
    const centerY = player.y + player.height / 2;

    const gradient = ctx.createRadialGradient(centerX, centerY, 70, centerX, centerY, 380);

    gradient.addColorStop(0, "rgba(0, 0, 0, 0)");
    gradient.addColorStop(1, "rgba(0, 0, 0, 0.55)");

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);

    // Hurt vignette

    drawVignette(Math.max(0, 1 - player.health / player.maxHealth));

    drawHUD();
    drawBanners();
    drawOverlays();
}

// ======================
// RESTART BUTTON
// ======================

document.getElementById("refreshButton").addEventListener("click", function (event) {
    event.currentTarget.blur();
    restartGame();
});

// ======================
// GAME LOOP (fixed timestep + render interpolation)
// ======================

let lastTime = performance.now();
let accumulator = 0;

function gameLoop(timestamp) {
    const frameTime = Math.min((timestamp - lastTime) / 1000, MAX_FRAME_TIME);
    lastTime = timestamp;

    pollGamepad();

    accumulator += frameTime;

    while (accumulator >= FIXED_DT) {
        update(FIXED_DT);
        accumulator -= FIXED_DT;
    }

    draw(Math.min(accumulator / FIXED_DT, 1));

    requestAnimationFrame(gameLoop);
}

buildLevel(0);
goTitle();

requestAnimationFrame(gameLoop);