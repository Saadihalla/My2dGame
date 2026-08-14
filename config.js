// ======================
// SETUP
// ======================

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const DPR = Math.min(window.devicePixelRatio || 1, 2);

const VIEW_WIDTH = 800;
const VIEW_HEIGHT = 500;

canvas.width = VIEW_WIDTH * DPR;
canvas.height = VIEW_HEIGHT * DPR;
ctx.scale(DPR, DPR);

// ======================
// CONFIG
// ======================

const TILE = 50;

const PLAYER_SPEED = 250;
const PLAYER_BASE_HEALTH = 100;
const PLAYER_IFRAMES = 0.6;

const ATTACK_DURATION = 0.28;
const ATTACK_COOLDOWN = 0.35;
const ATTACK_BASE_DAMAGE = 20;
const ATTACK_BASE_RANGE = 30;

const POTION_HEAL = 30;

const LEVEL_XP_BASE = 40;
const LEVEL_XP_GROWTH = 25;
const LEVEL_HP_BONUS = 10;
const LEVEL_HEAL = 25;

const WAVE_BREAK_TIME = 3;
const WAVE_CLEAR_TIME = 2.5;
const PORTAL_TIME = 8;

const WAVE_VICTORY = 10;

const ENEMY_AGGRO_RANGE = 260;
