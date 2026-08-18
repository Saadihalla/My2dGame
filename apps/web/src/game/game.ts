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
    MAX_FRAME_TIME,
    resizeCanvas
} from "./config";

import { Assets } from "./assets";

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
    setGameState,
    setWaveState,
    setWaveTimer,
    setPortalActive,
    setPortalTimer,
    tickWaveTimer,
    tickPortalTimer,
    camera
} from "./state";

import { cameraUpdate } from "@dark-fantasy/sim";

import { registerFlow } from "./events";
import { AudioFX, loadSfx } from "./audio";
import {
    getShake,
    updateFX,
    drawParticles,
    drawNumbers,
    drawVignette,
    tickHitStop
} from "./fx";
import { pollGamepad } from "./input";
import { updateBanners, drawBanners, showBanner } from "./banners";
import {
    buildLevel,
    currentLevel,
    currentMap,
    solidObjects,
    drawMap,
    drawTorchLights,
    aabb
} from "./levels";
import {
    player,
    enemies,
    spawnEnemy,
    updatePlayer,
    updateElf,
    drawElf,
    updateEnemies,
    updateLoot,
    updateProjectiles,
    playerAttack,
    drawPlayer,
    drawEnemies,
    drawLoot,
    drawProjectiles,
    allEnemiesDead
} from "./entities";
import { drawHUD, drawOverlays } from "./ui";
import { drawText } from "./theme";
import { netWorld, predictPlayer, renderTick } from "../net/world";
import { drawNetWorld } from "../net/render";
import { lastInput } from "../net/inputQueue";
import {
    startGame,
    restartGame,
    togglePause,
    onPlayerDeath,
    goTitle,
    advanceLevel,
    victory,
    openLevelUpChoice,
    chooseUpgrade
} from "./flow";
import { initAuthUI, restoreSession } from "./auth";
import { waveEnemyList } from "@dark-fantasy/sim";
import { findSpawnPoints } from "@dark-fantasy/sim";

registerFlow({
    startGame: startGame,
    restartGame: restartGame,
    togglePause: togglePause,
    playerDeath: onPlayerDeath,
    levelUp: openLevelUpChoice,
    levelUpChoice: chooseUpgrade
});

// ======================
// WAVES
// ======================

function spawnWave(waveNumber: number) {
    enemies.length = 0;

    const list = waveEnemyList(waveNumber);
    const worldW = currentLevel.cols * 50;
    const worldH = currentLevel.rows * 50;
    const points = findSpawnPoints(currentMap, solidObjects, player, list.length, {
        bounds: { x: 60, y: 60, w: worldW - 120, h: worldH - 120 }
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

function updateWaves(dt: number) {
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

// Tracks a net match ending so the canvas returns to the title screen.
let wasNetActive = false;

function update(dt: number) {
    // Online mode: the server is authoritative. The client predicts the
    // local player and renders the mirrored world; the local sim idles.
    if (netWorld.active) {
        wasNetActive = true;
        addGameTime(dt);
        predictPlayer(dt, lastInput());
        if (gameState !== "playing") {
            setGameState("playing");
        }
        return;
    }

    if (wasNetActive) {
        wasNetActive = false;
        goTitle();
    }

    if (gameState !== "playing") {
        return;
    }

    addGameTime(dt);

    updateFX(dt);
    updateBanners(dt);

    if (tickHitStop(dt)) {
        return;
    }

    stats.survived += dt;

    if (player.invuln > 0) {
        player.invuln -= dt;
    }

    updatePlayer(dt);
    updateElf(dt);
    updateEnemies(dt);
    updateLoot();
    updateProjectiles(dt);
    playerAttack(dt);
    updateWaves(dt);

    // Update camera follow player
    const worldW = currentLevel.cols * 50;
    const worldH = currentLevel.rows * 50;
    cameraUpdate(camera, player, worldW, worldH, VIEW_WIDTH, VIEW_HEIGHT, dt, 0.08);
}

// ======================
// DRAW
// ======================

function drawPortal(gameTime: number) {
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

    // Orbiting embers around the rim
    for (let i = 0; i < 5; i++) {
        const angle = gameTime * 2.4 + (i / 5) * Math.PI * 2;
        const orbit = 30 + pulse * 6;
        const sx = px + Math.cos(angle) * orbit;
        const sy = py + Math.sin(angle) * orbit * 0.8;
        ctx.globalAlpha = 0.7 + pulse * 0.3;
        ctx.fillStyle = i % 2 === 0 ? "#ffe36b" : "#ff9d22";
        ctx.fillRect(sx - 2, sy - 2, 4, 4);
    }

    ctx.restore();

    ctx.fillStyle = "#fff3c4";
    drawText(ctx, "ENTER PORTAL", px, py + 44, 8, "#fff3c4", "center");
}

function draw(alpha: number) {
    ctx.clearRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);

    // Online mode: render the authoritative world (arena, players,
    // enemies, projectiles) with interpolation + net HUD.
    if (netWorld.active) {
        renderTick(lastFrameTime);
        drawNetWorld(gameTime, alpha);
        return;
    }

    const camX = camera.x + (camera.x - camera.prevX) * alpha;
    const camY = camera.y + (camera.y - camera.prevY) * alpha;

    ctx.save();

    let shakeX = 0;
    let shakeY = 0;
    if (getShake() > 0.1) {
        const s = getShake();
        shakeX = (Math.random() - 0.5) * s;
        shakeY = (Math.random() - 0.5) * s;
    }

    ctx.translate(-camX + shakeX, -camY + shakeY);

    drawMap(gameTime);
    drawTorchLights(gameTime);
    drawPortal(gameTime);
    drawLoot(gameTime);
    drawParticles();
    drawPlayer(gameTime, alpha);
    drawEnemies(gameTime, alpha);
    drawElf(gameTime, alpha);
    drawProjectiles(gameTime);
    drawNumbers();

    ctx.restore();

    // Lighting (darkness around the player, converted to screen space)
    const playerCenterX = player.x + (player.x - player.prevX) * alpha + player.width / 2;
    const playerCenterY = player.y + (player.y - player.prevY) * alpha + player.height / 2;
    const centerX = playerCenterX - camX;
    const centerY = playerCenterY - camY;

    // Warm candle glow around the player, under the darkness
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const warm = ctx.createRadialGradient(centerX, centerY, 8, centerX, centerY, 200);
    warm.addColorStop(0, "rgba(255, 180, 90, 0.10)");
    warm.addColorStop(1, "rgba(255, 150, 50, 0)");
    ctx.fillStyle = warm;
    ctx.fillRect(centerX - 200, centerY - 200, 400, 400);
    ctx.restore();

    const gradient = ctx.createRadialGradient(centerX, centerY, 70, centerX, centerY, 380);

    gradient.addColorStop(0, "rgba(0, 0, 0, 0)");
    gradient.addColorStop(0.7, "rgba(0, 0, 0, 0.30)");
    gradient.addColorStop(1, "rgba(0, 0, 0, 0.55)");

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);

    // Hurt vignette

    drawVignette(Math.max(0, 1 - player.health / player.maxHealth));

    drawHUD();
    drawBanners();
    drawOverlays();

    // Asset loading overlay (progress bar, screen space)

    if (!Assets.loaded) {
        const pct = Math.round(Assets.progress * 100);

        ctx.fillStyle = "rgba(0, 0, 0, 0.65)";
        ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);

        ctx.fillStyle = "#ffd75a";
        ctx.fillRect(VIEW_WIDTH / 2 - 120, VIEW_HEIGHT / 2 - 4, 240 * Assets.progress, 8);
        ctx.strokeStyle = "#ffd75a";
        ctx.strokeRect(VIEW_WIDTH / 2 - 120, VIEW_HEIGHT / 2 - 4, 240, 8);

        ctx.fillStyle = "#ffffff";
        ctx.font = "10px 'Press Start 2P', monospace";
        ctx.textAlign = "center";
        ctx.fillText("LOADING " + pct + "%", VIEW_WIDTH / 2, VIEW_HEIGHT / 2 - 20);
        ctx.textAlign = "left";
    }
}

// ======================
// RESTART BUTTON
// ======================

document.getElementById("refreshButton").addEventListener("click", function (event) {
    (event.currentTarget as HTMLButtonElement).blur();
    restartGame();
});

// ======================
// GAME LOOP (fixed timestep + render interpolation)
// ======================

let lastTime = performance.now();
let accumulator = 0;
let lastFrameTime = 0;

function gameLoop(timestamp: number) {
    const frameTime = Math.min((timestamp - lastTime) / 1000, MAX_FRAME_TIME);
    lastTime = timestamp;
    lastFrameTime = frameTime;

    pollGamepad();

    // Net mode keeps ticking regardless of the local state machine.
    if (gameState !== "playing" && !netWorld.active) {
        accumulator = 0;
        draw(1);
        requestAnimationFrame(gameLoop);
        return;
    }

    accumulator += frameTime;

    while (accumulator >= FIXED_DT) {
        update(FIXED_DT);
        accumulator -= FIXED_DT;
    }

    draw(Math.min(accumulator / FIXED_DT, 1));

    requestAnimationFrame(gameLoop);
}

buildLevel(0);
initAuthUI();
restoreSession();
goTitle();

// Kick off the asset pipeline; the game runs in procedural fallback until
// the sheet loads (and validates). Progress is shown by the loading overlay.

Assets.load();

// Load the Hit / Dash / Damage wav pools (Damage is optional — the
// player-hurt sound falls back to the synth until that folder exists).

loadSfx();

window.addEventListener("resize", function () {
    resizeCanvas();
});

// Re-letterbox once the page (fonts, styles) is fully laid out — the
// module-time resizeCanvas call can run before the browser has applied CSS.
window.addEventListener("load", function () {
    resizeCanvas();
});

requestAnimationFrame(gameLoop);