// ======================
// MUTABLE GAME STATE (shared across modules)
// ======================

import { createCamera } from "./logic/camera.js";

export let gameState = "title"; // "title" | "playing" | "paused" | "gameover" | "victory"
export let camera = createCamera();

export function resetCamera() {
    camera.x = 0;
    camera.y = 0;
    camera.prevX = 0;
    camera.prevY = 0;
}

export let gameTime = 0;

export let wave = 1;
export let waveState = "break"; // "break" | "active" | "clear" | "portal"
export let waveTimer = 0;
export let portalActive = false;
export let portalTimer = 0;

export const stats = {
    score: 0,
    kills: 0,
    hitsTaken: 0,
    survived: 0
};

export let highScore = 0;
export let newHighScore = false;

try {
    highScore = parseInt(localStorage.getItem("darkFantasyHighScore") || "0", 10) || 0;
} catch {
    // localStorage unavailable — start at zero
}

export function addScore(amount) {
    stats.score += amount;
}

// Setter functions keep every state mutation in one place and
// stay lint-clean (no reassigning imported bindings).

export function setGameState(next) {
    gameState = next;
}

export function addGameTime(dt) {
    gameTime += dt;
}

export function setWave(next) {
    wave = next;
}

export function setWaveState(next) {
    waveState = next;
}

export function setWaveTimer(next) {
    waveTimer = next;
}

export function tickWaveTimer(dt) {
    waveTimer -= dt;
}

export function setPortalActive(next) {
    portalActive = next;
}

export function setPortalTimer(next) {
    portalTimer = next;
}

export function tickPortalTimer(dt) {
    portalTimer -= dt;
}

export function setNewHighScore(next) {
    newHighScore = next;
}

export function saveHighScore() {
    if (stats.score <= highScore) {
        return;
    }

    highScore = stats.score;
    newHighScore = true;

    try {
        localStorage.setItem("darkFantasyHighScore", String(highScore));
    } catch {
        // storage unavailable — ignore
    }
}