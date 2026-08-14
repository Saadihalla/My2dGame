// ======================
// SETUP
// ======================

export const canvas = document.getElementById("gameCanvas");
export const ctx = canvas.getContext("2d");

const DPR = Math.min(window.devicePixelRatio || 1, 2);

export const VIEW_WIDTH = 800;
export const VIEW_HEIGHT = 500;

canvas.width = VIEW_WIDTH * DPR;
canvas.height = VIEW_HEIGHT * DPR;
ctx.scale(DPR, DPR);

// ======================
// CONFIG
// ======================

export const TILE = 50;

export const PLAYER_SPEED = 250;
export const PLAYER_BASE_HEALTH = 100;
export const PLAYER_IFRAMES = 0.6;

export const ATTACK_DURATION = 0.28;
export const ATTACK_COOLDOWN = 0.35;
export const ATTACK_BASE_DAMAGE = 20;
export const ATTACK_BASE_RANGE = 30;

export const DASH_SPEED = 660;
export const DASH_DURATION = 0.2;
export const DASH_IFRAMES = 0.32;
export const DASH_COOLDOWN = 0.9;
export const DASH_DOUBLE_TAP_WINDOW = 0.22;

export const DEATH_FADE = 0.5;

export const POTION_HEAL = 30;

export const LEVEL_XP_BASE = 40;
export const LEVEL_XP_GROWTH = 25;
export const LEVEL_HEAL = 25;

export const WAVE_BREAK_TIME = 3;
export const WAVE_CLEAR_TIME = 2.5;
export const PORTAL_TIME = 8;

export const WAVE_VICTORY = 10;

// ======================
// FIXED TIMESTEP
// ======================

export const FIXED_DT = 1 / 60;
export const MAX_FRAME_TIME = 0.25;