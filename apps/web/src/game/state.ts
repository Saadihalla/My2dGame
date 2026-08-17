// ======================
// MUTABLE GAME STATE (shared across modules)
// ======================

import { createCamera, type CameraState } from "@dark-fantasy/sim";

// "title" | "playing" | "paused" | "gameover" | "victory" | "levelup" | "settings"
export type GameState = "title" | "playing" | "paused" | "gameover" | "victory" | "levelup" | "settings";

export let gameState: GameState = "title";
export const camera: CameraState = createCamera();

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

export const stats: {
    score: number;
    kills: number;
    hitsTaken: number;
    survived: number;
    damageDealt: number;
    byType: Record<string, number>;
} = {
    score: 0,
    kills: 0,
    hitsTaken: 0,
    survived: 0,
    damageDealt: 0,
    byType: {}
};

export let highScore = 0;
export let newHighScore = false;

try {
    highScore = parseInt(localStorage.getItem("darkFantasyHighScore") || "0", 10) || 0;
} catch {
    // localStorage unavailable — start at zero
}

export function addScore(amount: number) {
    stats.score += amount;
}

// Setter functions keep every state mutation in one place and
// stay lint-clean (no reassigning imported bindings).

export function setGameState(next: GameState) {
    gameState = next;
}

export function addGameTime(dt: number) {
    gameTime += dt;
}

export function setWave(next: number) {
    wave = next;
}

export function setWaveState(next: string) {
    waveState = next;
}

export function setWaveTimer(next: number) {
    waveTimer = next;
}

export function tickWaveTimer(dt: number) {
    waveTimer -= dt;
}

export function setPortalActive(next: boolean) {
    portalActive = next;
}

export function setPortalTimer(next: number) {
    portalTimer = next;
}

export function tickPortalTimer(dt: number) {
    portalTimer -= dt;
}

export function setNewHighScore(next: boolean) {
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