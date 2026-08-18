// ======================
// COMBAT — shared authoritative combat rules (pure)
// Entity definitions + update math used IDENTICALLY by the game
// server (authority) and the browser (client prediction + rendering).
// ======================

import type { Direction, EnemyState, Rect } from "./types.js";
import { decideEnemyState, kiteDirection } from "./ai.js";
import { dashDirection } from "./dash.js";
import { aabb } from "./collision.js";
import { waveEnemyList } from "./waves.js";

// ======================
// CONSTANTS (single-player game tuning, shared)
// ======================

export const PLAYER_SPEED = 250;
export const PLAYER_BASE_HEALTH = 100;
export const PLAYER_IFRAMES = 0.6;

export const ATTACK_DURATION = 0.28;
export const ATTACK_COOLDOWN = 0.35;
export const ATTACK_BASE_DAMAGE = 20;
// Slightly longer than the single-player arc: enemies stop at their
// attack range (55) which sits just outside a 30px arc, making co-op
// melee feel whiffy. 42 keeps the grunt's stop distance inside it.
export const ATTACK_BASE_RANGE = 42;

export const DASH_SPEED = 660;
export const DASH_DURATION = 0.2;
export const DASH_IFRAMES = 0.32;
export const DASH_COOLDOWN = 0.9;

export const DEATH_FADE = 0.5;
export const LEVEL_XP_BASE = 40;
export const LEVEL_XP_GROWTH = 25;
export const LEVEL_HEAL = 25;
export const WAVE_VICTORY = 10;

export const PLAYER_WIDTH = 40;
export const PLAYER_HEIGHT = 40;

// ======================
// ENEMY DEFINITIONS (stats + palette; colors feed the renderer)
// ======================

export interface EnemyTypeDef {
    name: string;
    hp: number;
    speed: number;
    damage: number;
    windup: number;
    strike: number;
    recover: number;
    attackCooldown: number;
    attackRange: number;
    width: number;
    height: number;
    score: number;
    xp: number;
    knockResist: number;
    colors: string[];
    preferredRange?: number;
    projectileSpeed?: number;
    blastRadius?: number;
}

export const ENEMY_DEFS: Record<string, EnemyTypeDef> = {
    grunt: {
        name: "Grunt", hp: 100, speed: 110, damage: 10,
        windup: 0.6, strike: 0.15, recover: 0.5,
        attackCooldown: 1.2, attackRange: 55,
        width: 40, height: 40, score: 100, xp: 20, knockResist: 1,
        colors: ["#c62828", "#8b1a1a", "#f2f2f2", "#eee"]
    },
    fast: {
        name: "Stalker", hp: 60, speed: 175, damage: 6,
        windup: 0.35, strike: 0.1, recover: 0.3,
        attackCooldown: 0.9, attackRange: 42,
        width: 30, height: 34, score: 150, xp: 25, knockResist: 1.2,
        colors: ["#5d1010", "#8b1a1a", "#2a2a33", "#ff6b6b"]
    },
    tank: {
        name: "Bulwark", hp: 260, speed: 70, damage: 18,
        windup: 1.0, strike: 0.2, recover: 0.8,
        attackCooldown: 1.6, attackRange: 70,
        width: 50, height: 52, score: 300, xp: 60, knockResist: 0.45,
        colors: ["#7a1f1f", "#4a1a1a", "#4a4a52", "#8a8a94"]
    },
    swarm: {
        name: "Imp", hp: 35, speed: 190, damage: 5,
        windup: 0.3, strike: 0.1, recover: 0.3,
        attackCooldown: 1.0, attackRange: 38,
        width: 24, height: 24, score: 60, xp: 10, knockResist: 1.3,
        colors: ["#7a1010", "#8b1a1a", "#1a1a1e", "#ff5a5a"]
    },
    caster: {
        name: "Hexer", hp: 70, speed: 80, damage: 12,
        windup: 0.8, strike: 0.15, recover: 0.5,
        attackCooldown: 2.2, attackRange: 260,
        preferredRange: 150, projectileSpeed: 260,
        width: 34, height: 36, score: 200, xp: 35, knockResist: 1,
        colors: ["#2a1a3a", "#3a2a4a", "#0d0d10", "#c07bff"]
    },
    exploder: {
        name: "Bomber", hp: 50, speed: 150, damage: 25,
        windup: 0.7, strike: 0.15, recover: 0.4,
        attackCooldown: 1.4, attackRange: 70,
        blastRadius: 80,
        width: 36, height: 36, score: 150, xp: 30, knockResist: 0.8,
        colors: ["#4a3a28", "#5c4a34", "#3a2a1a", "#ff9d22"]
    },
    warden: {
        name: "Warden", hp: 160, speed: 75, damage: 14,
        windup: 0.8, strike: 0.2, recover: 0.7,
        attackCooldown: 1.5, attackRange: 60,
        width: 46, height: 48, score: 250, xp: 50, knockResist: 0.6,
        colors: ["#45454e", "#5a5a64", "#1a1a20", "#8a8a94"]
    },
    boss: {
        name: "Pale King", hp: 900, speed: 90, damage: 22,
        windup: 1.1, strike: 0.2, recover: 0.7,
        attackCooldown: 1.4, attackRange: 95,
        width: 70, height: 74, score: 1000, xp: 150, knockResist: 0.25,
        colors: ["#8b1a1a", "#4a1a1a", "#1a1a1e", "#ffd75a"]
    }
};

// ======================
// NETWORK ENTITY SHAPES (serializable, server-authoritative)
// ======================

export interface NetInput {
    vx: number;
    vy: number;
    dash: boolean;
    attack: boolean;
}

export interface NetPlayer {
    id: string;
    name: string;
    x: number;
    y: number;
    hp: number;
    maxHp: number;
    direction: Direction;
    level: number;
    xp: number;
    xpNext: number;
    invuln: number;
    dashTimer: number;
    dashCooldown: number;
    dashDX: number;
    dashDY: number;
    attackTimer: number;
    attackCooldown: number;
    damage: number;
    range: number;
    score: number;
    kills: number;
    alive: boolean;
}

export interface NetEnemy {
    id: string;
    type: string;
    x: number;
    y: number;
    hp: number;
    maxHp: number;
    width: number;
    height: number;
    speed: number;
    damage: number;
    windup: number;
    strikeTime: number;
    recover: number;
    attackCooldown: number;
    attackRange: number;
    preferredRange: number;
    projectileSpeed: number;
    blastRadius: number;
    knockResist: number;
    state: EnemyState;
    stateTimer: number;
    cooldown: number;
    facing: Direction;
    kx: number;
    ky: number;
    flash: number;
}

export interface NetProjectile {
    x: number;
    y: number;
    vx: number;
    vy: number;
    size: number;
    damage: number;
    life: number;
    color: string;
}

// Events produced by the enemy AI that the SERVER applies to players.
export type EnemyEvent =
    | { kind: "strike"; enemyId: string; targetId: string; damage: number }
    | { kind: "projectile"; enemyId: string; targetId: string; damage: number }
    | { kind: "explode"; enemyId: string; targetId: string; damage: number };

// ======================
// FACTORIES
// ======================

export function createNetPlayer(id: string, name: string, x: number, y: number, maxHp?: number): NetPlayer {
    const hp = maxHp || PLAYER_BASE_HEALTH;

    return {
        id, name, x, y,
        hp,
        maxHp: hp,
        direction: "right",
        level: 1,
        xp: 0,
        xpNext: LEVEL_XP_BASE,
        invuln: 0,
        dashTimer: 0,
        dashCooldown: 0,
        dashDX: 1,
        dashDY: 0,
        attackTimer: 0,
        attackCooldown: 0,
        damage: ATTACK_BASE_DAMAGE,
        range: ATTACK_BASE_RANGE,
        score: 0,
        kills: 0,
        alive: true
    };
}

export function spawnNetEnemy(type: string, x: number, y: number, hpScale: number): NetEnemy {
    const t = ENEMY_DEFS[type] || ENEMY_DEFS.grunt;

    return {
        id: "",
        type: type,
        x: x,
        y: y,
        hp: Math.round(t.hp * hpScale),
        maxHp: Math.round(t.hp * hpScale),
        width: t.width,
        height: t.height,
        speed: t.speed,
        damage: t.damage,
        windup: t.windup,
        strikeTime: t.strike,
        recover: t.recover,
        attackCooldown: t.attackCooldown,
        attackRange: t.attackRange,
        preferredRange: t.preferredRange || 0,
        projectileSpeed: t.projectileSpeed || 0,
        blastRadius: t.blastRadius || 0,
        knockResist: t.knockResist,
        state: "chase",
        stateTimer: 0,
        cooldown: 0,
        facing: "left",
        kx: 0,
        ky: 0,
        flash: 0
    };
}

export function netProjectileFrom(enemy: NetEnemy, tx: number, ty: number): NetProjectile {
    const sx = enemy.x + enemy.width / 2;
    const sy = enemy.y + enemy.height / 2;
    const dist = Math.hypot(tx - sx, ty - sy) || 1;
    const dx = (tx - sx) / dist;
    const dy = (ty - sy) / dist;
    const colors = ENEMY_DEFS[enemy.type]?.colors || ["#c07bff"];

    return {
        x: sx + dx * 20,
        y: sy + dy * 20,
        vx: dx * enemy.projectileSpeed,
        vy: dy * enemy.projectileSpeed,
        size: 7,
        damage: enemy.damage,
        life: 4,
        color: colors[3] || "#c07bff"
    };
}

// ======================
// PLAYER MOVEMENT + COMBAT (prediction === server math)
// ======================

export interface MoveContext {
    canMove: (x: number, y: number, w: number, h: number) => boolean;
    onDash?: () => void;
}

export function movePlayer(p: NetPlayer, input: NetInput, dt: number, ctx: MoveContext) {
    const canMove = ctx.canMove;

    if (p.dashCooldown > 0) {
        p.dashCooldown -= dt;
    }
    if (p.invuln > 0) {
        p.invuln -= dt;
    }
    if (p.attackCooldown > 0) {
        p.attackCooldown -= dt;
    }
    if (p.attackTimer > 0) {
        p.attackTimer -= dt;
    }

    if (input.dash && p.dashCooldown <= 0 && p.dashTimer <= 0) {
        const dir = dashDirection(input.vx, input.vy, p.direction);

        if (dir) {
            p.dashDX = dir.dx;
            p.dashDY = dir.dy;
            p.dashTimer = DASH_DURATION;
            p.dashCooldown = DASH_COOLDOWN;
            p.invuln = Math.max(p.invuln, DASH_IFRAMES);
            if (ctx.onDash) {
                ctx.onDash();
            }
        }
    }

    if (p.dashTimer > 0) {
        p.dashTimer -= dt;
        const moveX = p.dashDX * DASH_SPEED * dt;
        const moveY = p.dashDY * DASH_SPEED * dt;

        if (canMove(p.x + moveX, p.y, PLAYER_WIDTH, PLAYER_HEIGHT)) {
            p.x += moveX;
        }
        if (canMove(p.x, p.y + moveY, PLAYER_WIDTH, PLAYER_HEIGHT)) {
            p.y += moveY;
        }
        return;
    }

    const dx = input.vx;
    const dy = input.vy;

    if (dx !== 0 || dy !== 0) {
        const length = Math.hypot(dx, dy);
        const moveX = (dx / length) * PLAYER_SPEED * dt;
        const moveY = (dy / length) * PLAYER_SPEED * dt;

        if (canMove(p.x + moveX, p.y, PLAYER_WIDTH, PLAYER_HEIGHT)) {
            p.x += moveX;
        }
        if (canMove(p.x, p.y + moveY, PLAYER_WIDTH, PLAYER_HEIGHT)) {
            p.y += moveY;
        }

        if (Math.abs(dx) >= Math.abs(dy)) {
            p.direction = dx > 0 ? "right" : "left";
        } else {
            p.direction = dy > 0 ? "down" : "up";
        }
    }
}

export function playerAttackBox(p: NetPlayer): Rect {
    const box: Rect = {
        x: p.x,
        y: p.y,
        w: PLAYER_WIDTH,
        h: PLAYER_HEIGHT
    };

    if (p.direction === "right") {
        box.x = p.x + PLAYER_WIDTH;
        box.y = p.y + 5;
        box.w = p.range;
        box.h = PLAYER_HEIGHT - 10;
    } else if (p.direction === "left") {
        box.x = p.x - p.range;
        box.y = p.y + 5;
        box.w = p.range;
        box.h = PLAYER_HEIGHT - 10;
    } else if (p.direction === "down") {
        box.x = p.x + 5;
        box.y = p.y + PLAYER_HEIGHT;
        box.w = PLAYER_WIDTH - 10;
        box.h = p.range;
    } else {
        box.x = p.x + 5;
        box.y = p.y - p.range;
        box.w = PLAYER_WIDTH - 10;
        box.h = p.range;
    }

    return box;
}

// Returns hit enemy ids + damage dealt. Mutates enemies (hp, flash, knockback).
export function applyPlayerAttack(
    p: NetPlayer,
    enemies: NetEnemy[],
    rng: () => number = Math.random
): { hits: string[]; damage: number } {
    const box = playerAttackBox(p);
    const hits: string[] = [];
    let totalDamage = 0;

    for (const e of enemies) {
        if (e.hp <= 0) {
            continue;
        }

        const eBox = { x: e.x, y: e.y, w: e.width, h: e.height };

        if (!aabb(box, eBox)) {
            continue;
        }

        const crit = rng() < 0.05;
        const damage = Math.round(p.damage * (crit ? 2 : 1));
        e.hp -= damage;
        e.flash = 0.12;
        totalDamage += damage;

        const knockX = p.x + PLAYER_WIDTH / 2 < e.x + e.width / 2 ? 1 : -1;
        const knockY = p.y + PLAYER_HEIGHT / 2 < e.y + e.height / 2 ? 1 : -1;
        e.kx = knockX * 300 * e.knockResist;
        e.ky = knockY * 120 * e.knockResist;

        // Wardens only take damage from behind their shield.
        if (e.type === "warden") {
            const playerCenterX = p.x + PLAYER_WIDTH / 2;
            const enemyCenterX = e.x + e.width / 2;
            const playerOnFront = (e.facing === "right" && playerCenterX >= enemyCenterX) ||
                (e.facing === "left" && playerCenterX <= enemyCenterX);

            if (playerOnFront) {
                e.hp += damage;
                e.flash = 0;
            }
        }

        hits.push(e.id);
    }

    return { hits, damage: totalDamage };
}

// ======================
// ENEMY AI UPDATE (server authority; pure math)
// ======================

export interface EnemyUpdateContext {
    canMove: (x: number, y: number, w: number, h: number) => boolean;
    targets: NetPlayer[]; // living players the enemies can chase
    rng?: () => number;
}

export function updateNetEnemy(e: NetEnemy, ctx: EnemyUpdateContext, dt: number): EnemyEvent[] {
    const rng = ctx.rng || Math.random;
    const events: EnemyEvent[] = [];

    if (e.flash > 0) {
        e.flash -= dt;
    }
    if (e.cooldown > 0) {
        e.cooldown -= dt;
    }

    // Knockback decay
    if (e.kx !== 0 || e.ky !== 0) {
        if (ctx.canMove(e.x + e.kx * dt, e.y, e.width, e.height)) {
            e.x += e.kx * dt;
        }
        if (ctx.canMove(e.x, e.y + e.ky * dt, e.width, e.height)) {
            e.y += e.ky * dt;
        }
        e.kx *= Math.exp(-6 * dt);
        e.ky *= Math.exp(-6 * dt);

        if (Math.abs(e.kx) < 1 && Math.abs(e.ky) < 1) {
            e.kx = 0;
            e.ky = 0;
        }
    }

    let target: NetPlayer | null = null;
    let dx = 0;
    let dy = 0;
    let dist = Infinity;

    for (const p of ctx.targets) {
        if (!p.alive) {
            continue;
        }
        const tdx = p.x + PLAYER_WIDTH / 2 - (e.x + e.width / 2);
        const tdy = p.y + PLAYER_HEIGHT / 2 - (e.y + e.height / 2);
        const tdist = Math.hypot(tdx, tdy);

        if (tdist < dist) {
            dist = tdist;
            dx = tdx;
            dy = tdy;
            target = p;
        }
    }

    if (!target || dist === 0) {
        return events;
    }

    if (e.type === "warden") {
        const desiredFacing: Direction = dx >= 0 ? "right" : "left";
        if (e.facing !== desiredFacing) {
            e.facing = desiredFacing;
        }
    } else {
        e.facing = dx >= 0 ? "right" : "left";
    }

    if (e.state !== "chase") {
        e.stateTimer -= dt;
    }

    const decision = decideEnemyState(e.state, {
        stateTimerDone: e.stateTimer <= 0,
        inRange: dist <= e.attackRange,
        cooldownReady: e.cooldown <= 0,
        type: e.type,
        hpRatio: e.hp / e.maxHp,
        retreatRoll: rng(),
        dist: dist,
        timers: {
            windup: e.windup,
            strike: e.strikeTime,
            recover: e.recover,
            cooldown: e.attackCooldown
        }
    });

    if (decision.cooldown !== undefined) {
        if (e.type === "caster") {
            events.push({ kind: "projectile", enemyId: e.id, targetId: target.id, damage: e.damage });
        } else if (e.type === "exploder") {
            events.push({ kind: "explode", enemyId: e.id, targetId: target.id, damage: e.damage });
        } else {
            events.push({ kind: "strike", enemyId: e.id, targetId: target.id, damage: e.damage });
        }
        e.cooldown = decision.cooldown;
    }

    if (decision.state) {
        e.state = decision.state;
    }
    if (decision.timer !== undefined) {
        e.stateTimer = decision.timer;
    }

    if (e.state === "chase") {
        if (e.type === "caster") {
            const kite = kiteDirection(dist, e.preferredRange, e.attackRange);

            if (kite !== 0 && dist > 1) {
                tryMoveEnemy(e, (dx / dist) * e.speed * kite * dt, (dy / dist) * e.speed * kite * dt, ctx);
            }
        } else if (dist > e.attackRange) {
            tryMoveEnemy(e, (dx / dist) * e.speed * dt, (dy / dist) * e.speed * dt, ctx);
        }
    } else if (e.state === "retreat" && dist > 1) {
        tryMoveEnemy(e, (-dx / dist) * e.speed * dt, (-dy / dist) * e.speed * dt, ctx);
    }

    return events;
}

function tryMoveEnemy(e: NetEnemy, vx: number, vy: number, ctx: EnemyUpdateContext) {
    if (ctx.canMove(e.x + vx, e.y, e.width, e.height)) {
        e.x += vx;
    }
    if (ctx.canMove(e.x, e.y + vy, e.width, e.height)) {
        e.y += vy;
    }
}

// ======================
// PROJECTILES
// ======================

export function updateNetProjectiles(
    projectiles: NetProjectile[],
    players: NetPlayer[],
    dt: number,
    canMove: (x: number, y: number, w: number, h: number) => boolean
): Array<{ index: number; targetId: string; damage: number }> {
    const hits: Array<{ index: number; targetId: string; damage: number }> = [];

    for (let i = projectiles.length - 1; i >= 0; i--) {
        const p = projectiles[i];

        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.life -= dt;

        if (p.life <= 0 || !canMove(p.x, p.y, p.size, p.size)) {
            projectiles.splice(i, 1);
            continue;
        }

        const pBox = { x: p.x - p.size / 2, y: p.y - p.size / 2, w: p.size, h: p.size };

        for (const pl of players) {
            if (!pl.alive) {
                continue;
            }
            const plBox = { x: pl.x, y: pl.y, w: PLAYER_WIDTH, h: PLAYER_HEIGHT };
            if (aabb(pBox, plBox)) {
                hits.push({ index: i, targetId: pl.id, damage: p.damage });
                projectiles.splice(i, 1);
                break;
            }
        }
    }

    return hits;
}

// ======================
// LEVELING (shared)
// ======================

// Applies XP, handles level-ups (heal + scaling damage/range so co-op
// keeps pace with the wave scaling), returns the number of levels gained.
export function gainPlayerXp(p: NetPlayer, amount: number): number {
    p.xp += amount;
    let levels = 0;

    while (p.xp >= p.xpNext) {
        p.xp -= p.xpNext;
        p.level++;
        levels++;
        p.xpNext = LEVEL_XP_BASE + p.level * LEVEL_XP_GROWTH;
        p.hp = Math.min(p.maxHp, p.hp + LEVEL_HEAL);
        p.damage += 2;
        p.range += 3;
    }

    return levels;
}

// ======================
// WAVE SCALING (co-op: enemy counts + HP scale with player count)
// ======================

// Co-op bonus: each extra player adds flat max HP so a group can
// absorb the scaled swarm without upgrades.
export function coopMaxHp(playerCount: number): number {
    return PLAYER_BASE_HEALTH + 25 * Math.max(0, playerCount - 1);
}

export function netWaveList(waveNumber: number, playerCount: number): string[] {
    const base = waveEnemyList(waveNumber);

    if (playerCount <= 1) {
        return base;
    }

    // Extra players add a share of the base composition. The share is
    // sub-linear (0.4 per extra player) so co-op stays intense but the
    // group can actually win without upgrades.
    const extra = Math.min(playerCount - 1, 3);
    const list = base.slice();

    for (let i = 0; i < extra; i++) {
        const trimmed = Math.round(base.length * 0.4);
        for (let j = 0; j < trimmed && list.length < 120; j++) {
            const type = base[j % base.length];
            if (type !== "boss") {
                list.push(type);
            }
        }
    }

    return list;
}

export function netHpScale(waveNumber: number, playerCount: number): number {
    const waveGrowth = 1 + (waveNumber - 1) * 0.12;
    const playerFactor = 0.85 + 0.15 * Math.min(playerCount, 4);
    return waveGrowth * playerFactor;
}
