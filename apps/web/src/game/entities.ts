// ======================
// ENTITIES (player, enemies, loot)
// ======================

import { Assets } from "./assets";
import { getAnimationFrame } from "@dark-fantasy/sim";

import {
    ctx,
    PLAYER_SPEED,
    PLAYER_BASE_HEALTH,
    PLAYER_IFRAMES,
    ATTACK_DURATION,
    ATTACK_COOLDOWN,
    ATTACK_BASE_DAMAGE,
    ATTACK_BASE_RANGE,
    POTION_HEAL,
    LEVEL_XP_BASE,
    LEVEL_XP_GROWTH,
    LEVEL_HEAL,
    DASH_SPEED,
    DASH_DURATION,
    DASH_IFRAMES,
    DASH_COOLDOWN,
    DEATH_FADE
} from "./config";

import { gameState, stats, addScore } from "./state";
import { triggerPlayerDeath, triggerLevelUp } from "./events";
import { keys, attacking, consumeDashRequest } from "./input";
import { AudioFX } from "./audio";
import {
    spawnParticles,
    addNumber,
    addShake,
    setHitVignette,
    addHitStop
} from "./fx";
import { currentLevel, isColliding, aabb } from "./levels";
import { decideEnemyState, kiteDirection } from "@dark-fantasy/sim";
import { rollLoot } from "@dark-fantasy/sim";
import { dashDirection } from "@dark-fantasy/sim";
import type { Direction, EnemyState } from "@dark-fantasy/sim";

export interface PlayerState {
    x: number;
    y: number;
    prevX: number;
    prevY: number;
    width: number;
    height: number;
    health: number;
    maxHealth: number;
    direction: Direction;
    attackTimer: number;
    attackCooldown: number;
    damage: number;
    range: number;
    level: number;
    xp: number;
    xpNext: number;
    invuln: number;
    dashTimer: number;
    dashCooldown: number;
    dashCooldownTime: number;
    dashDX: number;
    dashDY: number;
    attackSpeedMult: number;
    speedMult: number;
    critChance: number;
    lifesteal: number;
    cleaveMult: number;
    pendingLevels: number;
    pickedUpgrades?: string[];
    animState?: string;
    animTime?: number;
}

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

export interface Enemy {
    type: string;
    x: number;
    y: number;
    prevX: number;
    prevY: number;
    width: number;
    height: number;
    health: number;
    maxHealth: number;
    barHealth: number;
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
    score: number;
    xp: number;
    knockResist: number;
    colors: string[];
    facing: Direction;
    state: EnemyState;
    stateTimer: number;
    cooldown: number;
    flash: number;
    hurtTimer: number;
    kx: number;
    ky: number;
    deadTimer: number;
    turnTimer: number;
    animState?: string;
    animTime?: number;
}

export interface LootItem {
    kind: string;
    x: number;
    y: number;
}

export interface Projectile {
    x: number;
    y: number;
    vx: number;
    vy: number;
    size: number;
    damage: number;
    life: number;
    color: string;
}

export const player: PlayerState = {
    x: 100,
    y: 100,
    prevX: 100,
    prevY: 100,
    width: 40,
    height: 40,
    health: PLAYER_BASE_HEALTH,
    maxHealth: PLAYER_BASE_HEALTH,
    direction: "right",
    attackTimer: 0,
    attackCooldown: 0,
    damage: ATTACK_BASE_DAMAGE,
    range: ATTACK_BASE_RANGE,
    level: 1,
    xp: 0,
    xpNext: LEVEL_XP_BASE,
    invuln: 0,
    dashTimer: 0,
    dashCooldown: 0,
    dashCooldownTime: DASH_COOLDOWN,
    dashDX: 1,
    dashDY: 0,
    attackSpeedMult: 1,
    speedMult: 1,
    critChance: 0,
    lifesteal: 0,
    cleaveMult: 1,
    pendingLevels: 0
};

export const ENEMY_TYPES: Record<string, EnemyTypeDef> = {
    grunt: {
        name: "Grunt",
        hp: 100, speed: 110, damage: 10,
        windup: 0.6, strike: 0.15, recover: 0.5,
        attackCooldown: 1.2, attackRange: 55,
        width: 40, height: 40,
        score: 100, xp: 20,
        knockResist: 1,
        colors: ["#c62828", "#8b1a1a", "#f2f2f2", "#eee"]
    },
    fast: {
        name: "Stalker",
        hp: 60, speed: 175, damage: 6,
        windup: 0.35, strike: 0.1, recover: 0.3,
        attackCooldown: 0.9, attackRange: 42,
        width: 30, height: 34,
        score: 150, xp: 25,
        knockResist: 1.2,
        colors: ["#5d1010", "#8b1a1a", "#2a2a33", "#ff6b6b"]
    },
    tank: {
        name: "Bulwark",
        hp: 260, speed: 70, damage: 18,
        windup: 1.0, strike: 0.2, recover: 0.8,
        attackCooldown: 1.6, attackRange: 70,
        width: 50, height: 52,
        score: 300, xp: 60,
        knockResist: 0.45,
        colors: ["#7a1f1f", "#4a1a1a", "#4a4a52", "#8a8a94"]
    },
    swarm: {
        name: "Imp",
        hp: 35, speed: 190, damage: 5,
        windup: 0.3, strike: 0.1, recover: 0.3,
        attackCooldown: 1.0, attackRange: 38,
        width: 24, height: 24,
        score: 60, xp: 10,
        knockResist: 1.3,
        colors: ["#7a1010", "#8b1a1a", "#1a1a1e", "#ff5a5a"]
    },
    caster: {
        name: "Hexer",
        hp: 70, speed: 80, damage: 12,
        windup: 0.8, strike: 0.15, recover: 0.5,
        attackCooldown: 2.2, attackRange: 260,
        preferredRange: 150, projectileSpeed: 260,
        width: 34, height: 36,
        score: 200, xp: 35,
        knockResist: 1,
        colors: ["#2a1a3a", "#3a2a4a", "#0d0d10", "#c07bff"]
    },
    exploder: {
        name: "Bomber",
        hp: 50, speed: 150, damage: 25,
        windup: 0.7, strike: 0.15, recover: 0.4,
        attackCooldown: 1.4, attackRange: 70,
        blastRadius: 80,
        width: 36, height: 36,
        score: 150, xp: 30,
        knockResist: 0.8,
        colors: ["#4a3a28", "#5c4a34", "#3a2a1a", "#ff9d22"]
    },
    warden: {
        name: "Warden",
        hp: 160, speed: 75, damage: 14,
        windup: 0.8, strike: 0.2, recover: 0.7,
        attackCooldown: 1.5, attackRange: 60,
        width: 46, height: 48,
        score: 250, xp: 50,
        knockResist: 0.6,
        colors: ["#45454e", "#5a5a64", "#1a1a20", "#8a8a94"]
    },
    boss: {
        name: "Pale King",
        hp: 900, speed: 90, damage: 22,
        windup: 1.1, strike: 0.2, recover: 0.7,
        attackCooldown: 1.4, attackRange: 95,
        width: 70, height: 74,
        score: 1000, xp: 150,
        knockResist: 0.25,
        colors: ["#8b1a1a", "#4a1a1a", "#1a1a1e", "#ffd75a"]
    }
};

export const enemies: Enemy[] = [];
export const loot: LootItem[] = [];
export const projectiles: Projectile[] = [];

export function spawnEnemy(type: string, x: number, y: number, hpScale: number) {
    const t = ENEMY_TYPES[type];

    enemies.push({
        type: type,
        x: x,
        y: y,
        prevX: x,
        prevY: y,
        width: t.width,
        height: t.height,
        health: Math.round(t.hp * hpScale),
        maxHealth: Math.round(t.hp * hpScale),
        barHealth: Math.round(t.hp * hpScale),
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
        score: t.score,
        xp: t.xp,
        knockResist: t.knockResist,
        colors: t.colors,
        facing: "left",
        state: "chase",
        stateTimer: 0,
        cooldown: 0,
        flash: 0,
        hurtTimer: 0,
        kx: 0,
        ky: 0,
        deadTimer: 0,
        turnTimer: 0
    });
}

function enemyBlocked(x: number, y: number, w: number, h: number) {
    if (isColliding(x, y, w, h)) {
        return true;
    }

    const playerBox = { x: player.x, y: player.y, w: player.width, h: player.height };
    const rect = { x: x, y: y, w: w, h: h };

    return aabb(rect, playerBox);
}

function tryMove(ent: Enemy, vx: number, vy: number) {
    if (!enemyBlocked(ent.x + vx, ent.y, ent.width, ent.height)) {
        ent.x += vx;
    }
    if (!enemyBlocked(ent.x, ent.y + vy, ent.width, ent.height)) {
        ent.y += vy;
    }
}

// ======================
// PLAYER
// ======================

export function resetPlayer() {
    player.x = currentLevel.spawn.x;
    player.y = currentLevel.spawn.y;
    player.prevX = player.x;
    player.prevY = player.y;
    player.health = player.maxHealth;
    player.direction = "right";
    player.attackTimer = 0;
    player.attackCooldown = 0;
    player.invuln = 0;
    player.dashTimer = 0;
    player.dashCooldown = 0;
}

function tryStartDash() {
    if (player.dashCooldown > 0 || player.dashTimer > 0) {
        return;
    }

    let dx = 0;
    let dy = 0;

    if (keys["w"] || keys["arrowup"]) {
        dy -= 1;
    }
    if (keys["s"] || keys["arrowdown"]) {
        dy += 1;
    }
    if (keys["a"] || keys["arrowleft"]) {
        dx -= 1;
    }
    if (keys["d"] || keys["arrowright"]) {
        dx += 1;
    }

    const dir = dashDirection(dx, dy, player.direction);

    player.dashDX = dir.dx;
    player.dashDY = dir.dy;
    player.dashTimer = DASH_DURATION;
    player.dashCooldown = player.dashCooldownTime;
    player.invuln = Math.max(player.invuln, DASH_IFRAMES);

    addShake(2);
    AudioFX.dash();
}

export function updatePlayer(dt: number) {
    player.prevX = player.x;
    player.prevY = player.y;

    if (player.dashCooldown > 0) {
        player.dashCooldown -= dt;
    }

    if (consumeDashRequest()) {
        tryStartDash();
    }

    // Dash: commit to the direction, ignore movement input.

    if (player.dashTimer > 0) {
        player.dashTimer -= dt;

        const moveX = player.dashDX * DASH_SPEED * dt;
        const moveY = player.dashDY * DASH_SPEED * dt;

        if (!isColliding(player.x + moveX, player.y, player.width, player.height)) {
            player.x += moveX;
        }
        if (!isColliding(player.x, player.y + moveY, player.width, player.height)) {
            player.y += moveY;
        }

        spawnParticles(
            player.x + player.width / 2,
            player.y + player.height / 2,
            3,
            ["#292929", "#444444", "#c58b65", "#080808"],
            70
        );

        resolveEnemyOverlaps();
        return;
    }

    let dx = 0;
    let dy = 0;

    if (keys["w"] || keys["arrowup"]) {
        dy -= 1;
    }
    if (keys["s"] || keys["arrowdown"]) {
        dy += 1;
    }
    if (keys["a"] || keys["arrowleft"]) {
        dx -= 1;
    }
    if (keys["d"] || keys["arrowright"]) {
        dx += 1;
    }

    if (dx !== 0 || dy !== 0) {
        const length = Math.hypot(dx, dy);
        const moveX = (dx / length) * PLAYER_SPEED * player.speedMult * dt;
        const moveY = (dy / length) * PLAYER_SPEED * player.speedMult * dt;

        if (!isColliding(player.x + moveX, player.y, player.width, player.height)) {
            player.x += moveX;
        }
        if (!isColliding(player.x, player.y + moveY, player.width, player.height)) {
            player.y += moveY;
        }

        if (Math.abs(dx) >= Math.abs(dy)) {
            player.direction = dx > 0 ? "right" : "left";
        } else {
            player.direction = dy > 0 ? "down" : "up";
        }
    }

    resolveEnemyOverlaps();

    // Update animation state
    let nextState = "idle";
    if (player.x !== player.prevX || player.y !== player.prevY) {
        nextState = "walk";
    }
    if (player.attackTimer > 0) {
        nextState = "attack";
    }
    if (player.health <= 0) {
        nextState = "death";
    } else if (player.invuln > 0 && player.dashTimer <= 0) {
        nextState = "hurt";
    }

    if (player.animState !== nextState) {
        player.animState = nextState;
        player.animTime = 0;
    } else {
        player.animTime = (player.animTime || 0) + dt;
    }
}

// The player can shove enemies out of the way instead of being
// hard-blocked by them (prevents getting permanently pinned in a
// corner). An enemy backed against terrain still body-blocks.

function resolveEnemyOverlaps() {
    for (const e of enemies) {
        if (e.health <= 0) {
            continue;
        }

        const overlap = getOverlap(e, player);
        if (!overlap) {
            continue;
        }

        let pushX = 0;
        let pushY = 0;

        if (overlap.dx < overlap.dy) {
            pushX = overlap.signX * overlap.dx;
        } else {
            pushY = overlap.signY * overlap.dy;
        }

        if (!isColliding(e.x + pushX, e.y, e.width, e.height)) {
            e.x += pushX;
        } else if (!isColliding(e.x, e.y + pushY, e.width, e.height)) {
            e.y += pushY;
        } else {
            // Enemy is pinned — push the player back out instead.
            const backX = -pushX;
            const backY = -pushY;

            if (!isColliding(player.x + backX, player.y, player.width, player.height)) {
                player.x += backX;
            } else if (!isColliding(player.x, player.y + backY, player.width, player.height)) {
                player.y += backY;
            }
        }
    }
}

function getOverlap(e: Enemy, p: PlayerState) {
    const dx = Math.min(e.x + e.width, p.x + p.width) - Math.max(e.x, p.x);
    const dy = Math.min(e.y + e.height, p.y + p.height) - Math.max(e.y, p.y);

    if (dx <= 0 || dy <= 0) {
        return null;
    }

    return {
        dx: dx,
        dy: dy,
        signX: e.x < p.x ? -1 : 1,
        signY: e.y < p.y ? -1 : 1
    };
}

// ======================
// COMBAT
// ======================

function damageEnemy(e: Enemy) {
    // Wardens block attacks aimed at their shielded (player-facing) side.

    if (e.type === "warden") {
        const playerCenterX = player.x + player.width / 2;
        const enemyCenterX = e.x + e.width / 2;
        const playerOnFront = (e.facing === "right" && playerCenterX >= enemyCenterX) ||
            (e.facing === "left" && playerCenterX <= enemyCenterX);

        if (playerOnFront) {
            AudioFX.block();
            addShake(2);
            addNumber(e.x + e.width / 2, e.y - 14, "BLOCKED", "#9e9e9e");
            spawnParticles(
                e.facing === "right" ? e.x + e.width : e.x,
                e.y + e.height / 2,
                6,
                ["#8a8a94", "#4a4a55", "#ffd75a"],
                100
            );
            return;
        }
    }

    const crit = Math.random() < player.critChance;
    const damage = Math.round(player.damage * (crit ? 2 : 1));

    e.health -= damage;
    e.flash = 0.12;
    e.hurtTimer = 0.22;
    stats.damageDealt += damage;

    const knockX = player.x + player.width / 2 < e.x + e.width / 2 ? 1 : -1;
    const knockY = player.y + player.height / 2 < e.y + e.height / 2 ? 1 : -1;
    e.kx = knockX * 300 * e.knockResist;
    e.ky = knockY * 120 * e.knockResist;

    addShake(crit ? 7 : 4);
    AudioFX.hit();

    if (e.type === "boss") {
        addHitStop(0.05);
    }

    if (player.lifesteal > 0) {
        player.health = Math.min(player.maxHealth, player.health + damage * player.lifesteal);
    }

    spawnParticles(
        e.x + e.width / 2,
        e.y + e.height / 2,
        crit ? 16 : 8,
        crit ? ["#ffd75a", "#ff9d22", "#fff3c4"] : e.colors,
        crit ? 220 : 160
    );
    addNumber(e.x + e.width / 2, e.y - 14, String(damage), crit ? "#ffd75a" : "#ffe08a");

    if (e.health <= 0) {
        killEnemy(e);
    }
}

function killEnemy(e: Enemy) {
    e.health = 0;
    e.flash = 0;
    e.hurtTimer = 0;
    e.deadTimer = DEATH_FADE;
    e.animState = "death";
    e.animTime = 0;

    addHitStop(0.09);
    addShake(8);
    AudioFX.kill();

    spawnParticles(
        e.x + e.width / 2,
        e.y + e.height / 2,
        30,
        e.colors,
        240
    );

    addScore(e.score);
    stats.kills++;
    stats.byType[e.type] = (stats.byType[e.type] || 0) + 1;
    gainXP(e.xp);

    if (e.type === "boss") {
        addNumber(e.x + e.width / 2, e.y - 24, "BOSS SLAIN", "#ffd75a");
    }

    dropLoot(e);
}

export function playerAttack(dt: number) {
    if (player.attackCooldown > 0) {
        player.attackCooldown -= dt;
    }
    if (player.attackTimer > 0) {
        player.attackTimer -= dt;
    }

    if (!attacking || player.attackCooldown > 0) {
        return;
    }

    player.attackTimer = ATTACK_DURATION;
    player.attackCooldown = ATTACK_COOLDOWN * player.attackSpeedMult;

    addShake(1.5);
    AudioFX.swing();

    const box = {
        x: player.x,
        y: player.y,
        w: player.width,
        h: player.height
    };

    if (player.direction === "right") {
        box.x = player.x + player.width;
        box.y = player.y + 5;
        box.w = player.range * player.cleaveMult;
        box.h = player.height - 10;
    }

    if (player.direction === "left") {
        box.x = player.x - player.range * player.cleaveMult;
        box.y = player.y + 5;
        box.w = player.range * player.cleaveMult;
        box.h = player.height - 10;
    }

    if (player.direction === "down") {
        box.x = player.x + 5;
        box.y = player.y + player.height;
        box.w = player.width - 10;
        box.h = player.range * player.cleaveMult;
    }

    if (player.direction === "up") {
        box.x = player.x + 5;
        box.y = player.y - player.range * player.cleaveMult;
        box.w = player.width - 10;
        box.h = player.range * player.cleaveMult;
    }

    for (const e of enemies) {
        if (e.health <= 0) {
            continue;
        }
        if (aabb(box, { x: e.x, y: e.y, w: e.width, h: e.height })) {
            damageEnemy(e);
        }
    }
}

function hurtPlayer(amount: number) {
    if (player.invuln > 0 || gameState !== "playing") {
        return;
    }

    player.health -= amount;
    player.invuln = PLAYER_IFRAMES;
    stats.hitsTaken++;

    addShake(6);
    setHitVignette();
    AudioFX.hurt();

    spawnParticles(
        player.x + player.width / 2,
        player.y + player.height / 2,
        10,
        ["#c62828", "#8b1a1a", "#eee"],
        140
    );
    addNumber(player.x + player.width / 2, player.y - 10, String(amount), "#ff6b6b");

    if (player.health <= 0) {
        player.health = 0;
        triggerPlayerDeath();
    }
}

function strikePlayer(e: Enemy) {
    const box = {
        x: e.facing === "right" ? e.x + e.width : e.x - e.attackRange,
        y: e.y + 4,
        w: e.attackRange,
        h: e.height - 8
    };

    const playerBox = { x: player.x, y: player.y, w: player.width, h: player.height };

    if (!aabb(box, playerBox)) {
        return;
    }

    hurtPlayer(e.damage);
}

// ======================
// CASTER PROJECTILES
// ======================

function fireProjectile(e: Enemy) {
    const sx = e.x + e.width / 2;
    const sy = e.y + e.height / 2;
    const px = player.x + player.width / 2;
    const py = player.y + player.height / 2;
    const dist = Math.hypot(px - sx, py - sy) || 1;
    const dx = (px - sx) / dist;
    const dy = (py - sy) / dist;

    projectiles.push({
        x: sx + dx * 20,
        y: sy + dy * 20,
        vx: dx * e.projectileSpeed,
        vy: dy * e.projectileSpeed,
        size: 7,
        damage: e.damage,
        life: 4,
        color: e.colors[3] || "#c07bff"
    });

    addShake(2);
    AudioFX.cast();
}

export function updateProjectiles(dt: number) {
    for (let i = projectiles.length - 1; i >= 0; i--) {
        const p = projectiles[i];

        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.life -= dt;

        if (p.life <= 0 || isColliding(p.x, p.y, p.size, p.size)) {
            projectiles.splice(i, 1);
            continue;
        }

        if (aabb(
            { x: p.x - p.size / 2, y: p.y - p.size / 2, w: p.size, h: p.size },
            { x: player.x, y: player.y, w: player.width, h: player.height }
        )) {
            projectiles.splice(i, 1);
            hurtPlayer(p.damage);
        }
    }
}

export function drawProjectiles(gameTime: number) {
    for (const p of projectiles) {
        drawProjectileEntity(p, gameTime);
    }
}

export function drawProjectileEntity(p: Projectile, gameTime: number) {
    const pulse = 0.5 + 0.5 * Math.sin(gameTime * 14);

    if (Assets.loaded && !Assets.fallbackMode && Assets.spritesheet) {
        const frameData = getAnimationFrame(Assets.spritesheetDef, "projectile", "idle", gameTime);

        if (frameData) {
            const frame = frameData.frame;
            const anchor = frameData.anchor;

            ctx.save();
            ctx.imageSmoothingEnabled = false;
            ctx.globalAlpha = 0.65 + pulse * 0.35;
            ctx.drawImage(
                Assets.spritesheet,
                frame.x, frame.y, frame.w, frame.h,
                p.x - anchor.x, p.y - anchor.y, frame.w, frame.h
            );
            ctx.restore();
            return;
        }
    }

    ctx.globalAlpha = 0.35 + pulse * 0.3;
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - p.size, p.y - p.size, p.size * 2, p.size * 2);

    ctx.globalAlpha = 1;
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - 3, p.y - 3, 6, 6);

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(p.x - 1, p.y - 1, 2, 2);
}

// ======================
// EXPLODER
// ======================

function explodeEnemy(e: Enemy) {
    const px = player.x + player.width / 2;
    const py = player.y + player.height / 2;
    const ex = e.x + e.width / 2;
    const ey = e.y + e.height / 2;

    if (Math.hypot(px - ex, py - ey) < e.blastRadius + 20) {
        hurtPlayer(e.damage);
    }

    addShake(14);
    addHitStop(0.1);
    AudioFX.explode();

    spawnParticles(
        ex,
        ey,
        40,
        ["#ff9d22", "#ffd75a", "#4a3a28", "#c62828"],
        260
    );

    killEnemy(e);
}

// ======================
// ENEMY AI
// ======================

export function updateEnemies(dt: number) {
    for (const e of enemies) {
        if (e.health <= 0) {
            if (e.deadTimer > 0) {
                e.deadTimer -= dt;
            }
            continue;
        }

        e.prevX = e.x;
        e.prevY = e.y;

        if (e.flash > 0) {
            e.flash -= dt;
        }
        if (e.hurtTimer > 0) {
            e.hurtTimer -= dt;
        }
        if (e.cooldown > 0) {
            e.cooldown -= dt;
        }

        e.barHealth += (e.health - e.barHealth) * Math.min(1, dt * 8);

        // Knockback

        if (e.kx !== 0 || e.ky !== 0) {
            if (!enemyBlocked(e.x + e.kx * dt, e.y, e.width, e.height)) {
                e.x += e.kx * dt;
            }
            if (!enemyBlocked(e.x, e.y + e.ky * dt, e.width, e.height)) {
                e.y += e.ky * dt;
            }

            e.kx *= Math.exp(-6 * dt);
            e.ky *= Math.exp(-6 * dt);

            if (Math.abs(e.kx) < 1 && Math.abs(e.ky) < 1) {
                e.kx = 0;
                e.ky = 0;
            }
        }

        const dx = player.x + player.width / 2 - (e.x + e.width / 2);
        const dy = player.y + player.height / 2 - (e.y + e.height / 2);
        const dist = Math.hypot(dx, dy);

        // Wardens turn with a delay so players can dash behind their
        // shield; everything else tracks the player instantly.

        const desiredFacing = dx >= 0 ? "right" : "left";

        if (e.type === "warden") {
            if (e.facing !== desiredFacing) {
                if (e.turnTimer > 0) {
                    e.turnTimer -= dt;
                } else {
                    e.facing = desiredFacing;
                    e.turnTimer = 0.6;
                }
            }
        } else {
            e.facing = desiredFacing;
        }

        updateEnemyState(e, dx, dy, dist, dt);

        // Update animation state: hurt flashes beat everything, then
        // windup/strike play the attack animation, then walk/idle.
        const isMoving = Math.hypot(e.x - e.prevX, e.y - e.prevY) > 0.01;
        const striking = e.state === "windup" || e.state === "strike";
        let nextState = isMoving ? "walk" : "idle";

        if (striking) {
            nextState = "attack";
        }
        if (e.hurtTimer > 0) {
            nextState = "hurt";
        }

        if (e.animState !== nextState) {
            e.animState = nextState;
            e.animTime = 0;
        } else {
            e.animTime = (e.animTime || 0) + dt;
        }
    }

    // Remove fully faded corpses (prevents dead enemies from
    // accumulating across waves).

    for (let i = enemies.length - 1; i >= 0; i--) {
        if (enemies[i].health <= 0 && enemies[i].deadTimer <= 0) {
            enemies.splice(i, 1);
        }
    }
}

function updateEnemyState(e: Enemy, dx: number, dy: number, dist: number, dt: number) {
    if (e.state !== "chase") {
        e.stateTimer -= dt;
    }

    const decision = decideEnemyState(e.state, {
        stateTimerDone: e.stateTimer <= 0,
        inRange: dist <= e.attackRange,
        cooldownReady: e.cooldown <= 0,
        type: e.type,
        hpRatio: e.health / e.maxHealth,
        retreatRoll: Math.random(),
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
            fireProjectile(e);
        } else if (e.type === "exploder") {
            explodeEnemy(e);
        } else {
            strikePlayer(e);
        }
        e.cooldown = decision.cooldown;
    }

    if (decision.state !== e.state || decision.timer !== undefined) {
        e.state = decision.state;
        if (decision.timer !== undefined) {
            e.stateTimer = decision.timer;
        }
    }

    if (e.state === "chase") {
        if (e.type === "caster") {
            const kite = kiteDirection(dist, e.preferredRange, e.attackRange);

            if (kite !== 0 && dist > 1) {
                const vx = (dx / dist) * e.speed * kite * dt;
                const vy = (dy / dist) * e.speed * kite * dt;
                tryMove(e, vx, vy);
            }
        } else if (dist > e.attackRange) {
            const vx = (dx / dist) * e.speed * dt;
            const vy = (dy / dist) * e.speed * dt;
            tryMove(e, vx, vy);
        }
    }

    if (e.state === "retreat" && dist > 1) {
        const vx = (-dx / dist) * e.speed * dt;
        const vy = (-dy / dist) * e.speed * dt;
        tryMove(e, vx, vy);
    }
}

export function allEnemiesDead() {
    return enemies.every(function (e: Enemy) {
        return e.health <= 0;
    });
}

// ======================
// XP / LEVELS
// ======================

function gainXP(amount: number) {
    player.xp += amount;
    addNumber(player.x + player.width / 2, player.y - 20, "+" + amount + " XP", "#7ec8ff");

    while (player.xp >= player.xpNext) {
        player.xp -= player.xpNext;
        player.level++;
        player.xpNext = LEVEL_XP_BASE + player.level * LEVEL_XP_GROWTH;
        player.pendingLevels++;
        player.health = Math.min(player.maxHealth, player.health + LEVEL_HEAL);
    }

    if (player.pendingLevels > 0 && gameState === "playing") {
        triggerLevelUp();
    }
}

// ======================
// LOOT
// ======================

function dropLoot(e: Enemy) {
    const drops = rollLoot(e.type, Math.random());

    for (const kind of drops) {
        if (kind === "upgrade" && e.type === "boss") {
            loot.push({
                kind: "upgrade",
                x: e.x + e.width / 2 - 30,
                y: e.y + e.height / 2 + 10
            });
        } else {
            loot.push({ kind: kind, x: e.x + e.width / 2, y: e.y + e.height / 2 });
        }
    }
}

export function updateLoot() {
    for (let i = loot.length - 1; i >= 0; i--) {
        const item = loot[i];
        const rect = { x: item.x - 10, y: item.y - 10, w: 20, h: 20 };
        const playerBox = { x: player.x, y: player.y, w: player.width, h: player.height };

        if (!aabb(rect, playerBox)) {
            continue;
        }

        loot.splice(i, 1);
        AudioFX.pickup();

        if (item.kind === "potion") {
            const healed = Math.min(POTION_HEAL, player.maxHealth - player.health);
            player.health += healed;
            addNumber(player.x + player.width / 2, player.y - 20, "+" + healed + " HP", "#7dff8a");
        } else {
            player.damage += 4;
            player.range += 5;
            addNumber(player.x + player.width / 2, player.y - 20, "SWORD UP!", "#ffd75a");
        }
    }
}

// ======================
// DRAW PLAYER
// ======================

function easeOutCubic(t: number) {
    return 1 - Math.pow(1 - t, 3);
}

function drawSwordSwing(gctx: CanvasRenderingContext2D, x: number, y: number) {
    const progress = 1 - player.attackTimer / ATTACK_DURATION;
    const sweep = -1.4 + easeOutCubic(progress) * 2.8;

    let baseAngle = 0;

    if (player.direction === "left") {
        baseAngle = Math.PI;
    }
    if (player.direction === "up") {
        baseAngle = -Math.PI / 2;
    }
    if (player.direction === "down") {
        baseAngle = Math.PI / 2;
    }

    gctx.save();
    gctx.translate(x + 20, y + 22);
    gctx.rotate(baseAngle + sweep);

    // The Dragonslayer (Massive Berserk Greatsword Swing)
    gctx.fillStyle = "#222";
    gctx.fillRect(-2, -6, 42, 12);

    gctx.fillStyle = "#444";
    gctx.fillRect(2, -4, 38, 8);

    gctx.fillStyle = "#888";
    gctx.fillRect(6, -2, 32, 4);

    // Heavy crossguard & hilt
    gctx.fillStyle = "#111";
    gctx.fillRect(-6, -9, 8, 18);
    gctx.fillStyle = "#a11";
    gctx.fillRect(-8, -3, 6, 6);

    gctx.restore();
}

// Draws the full player sprite (Guts / Black Swordsman + Dragonslayer) with a given context,
// so it can be re-rendered through the pixelation pass while dashing.

function drawPlayerSprite(gctx: CanvasRenderingContext2D, x: number, y: number) {
    const swinging = player.attackTimer > 0;

    // Guts - Black Swordsman / Berserker Armor style
    // Cape / Cloak (Dark/Crimson interior)
    gctx.fillStyle = "#7a1111";
    gctx.fillRect(x + 2, y + 16, 10, 18);

    // Body / Black Armor
    gctx.fillStyle = "#1a1a1a";
    gctx.fillRect(x + 8, y + 15, 24, 20);

    // Armor Plates / Pauldrons
    gctx.fillStyle = "#333";
    gctx.fillRect(x + 10, y + 16, 6, 12);
    gctx.fillRect(x + 24, y + 16, 6, 12);

    // Belt & Leather Straps
    gctx.fillStyle = "#5c3a21";
    gctx.fillRect(x + 9, y + 27, 22, 4);

    // Pants & Boots
    gctx.fillStyle = "#151515";
    gctx.fillRect(x + 10, y + 33, 8, 8);
    gctx.fillRect(x + 22, y + 33, 8, 8);

    // Head / Face (Guts: stern face, scar, spiky black hair)
    gctx.fillStyle = "#c58b65";
    gctx.fillRect(x + 10, y + 5, 20, 12);

    // Spiky Black Hair
    gctx.fillStyle = "#0d0d0d";
    gctx.fillRect(x + 8, y + 1, 24, 6);
    gctx.fillRect(x + 6, y + 4, 6, 8);
    gctx.fillRect(x + 28, y + 4, 6, 8);
    gctx.fillRect(x + 12, y - 2, 8, 5);

    // Scar across nose / eye
    gctx.fillStyle = "#9c6b4e";
    gctx.fillRect(x + 17, y + 9, 5, 2);

    // Arms
    gctx.fillStyle = "#222";
    gctx.fillRect(x + 3, y + 17, 7, 16);
    gctx.fillRect(x + 30, y + 17, 7, 16);

    if (swinging) {

        drawSwordSwing(gctx, x, y);

    } else {

        // The Dragonslayer (Massive Greatsword resting/ready)
        if (player.direction === "right") {

            gctx.fillStyle = "#222";
            gctx.fillRect(x + 36, y + 6, 32, 8);

            gctx.fillStyle = "#444";
            gctx.fillRect(x + 38, y + 8, 28, 4);

            gctx.fillStyle = "#888";
            gctx.fillRect(x + 42, y + 9, 22, 2);

            gctx.fillStyle = "#111";
            gctx.fillRect(x + 34, y + 4, 6, 12);
        }

        if (player.direction === "left") {

            gctx.fillStyle = "#222";
            gctx.fillRect(x - 32, y + 6, 32, 8);

            gctx.fillStyle = "#444";
            gctx.fillRect(x - 30, y + 8, 28, 4);

            gctx.fillStyle = "#888";
            gctx.fillRect(x - 26, y + 9, 22, 2);

            gctx.fillStyle = "#111";
            gctx.fillRect(x - 4, y + 4, 6, 12);
        }

        if (player.direction === "up") {

            gctx.fillStyle = "#222";
            gctx.fillRect(x + 16, y - 32, 8, 32);

            gctx.fillStyle = "#444";
            gctx.fillRect(x + 18, y - 30, 4, 28);

            gctx.fillStyle = "#888";
            gctx.fillRect(x + 19, y - 26, 2, 22);

            gctx.fillStyle = "#111";
            gctx.fillRect(x + 14, y - 4, 12, 6);
        }

        if (player.direction === "down") {

            gctx.fillStyle = "#222";
            gctx.fillRect(x + 16, y + 36, 8, 32);

            gctx.fillStyle = "#444";
            gctx.fillRect(x + 18, y + 38, 4, 28);

            gctx.fillStyle = "#888";
            gctx.fillRect(x + 19, y + 42, 2, 22);

            gctx.fillStyle = "#111";
            gctx.fillRect(x + 14, y + 34, 12, 6);
        }
    }
}

// Offscreen canvases for the dash "pixel air" effect: the sprite is
// downsampled to 16x16 and scaled back up with smoothing off, so the
// player reads as a scatter of chunky pixels while dashing.

const PIXEL_CANVAS_SIZE = 96;
const PIXEL_GRID = 16;
const PIXEL_OFFSET_X = 29;
const PIXEL_OFFSET_Y = 28;

const pixelCanvas = document.createElement("canvas");
pixelCanvas.width = PIXEL_CANVAS_SIZE;
pixelCanvas.height = PIXEL_CANVAS_SIZE;
const pixelCtx = pixelCanvas.getContext("2d");

const pixelSmallCanvas = document.createElement("canvas");
pixelSmallCanvas.width = PIXEL_GRID;
pixelSmallCanvas.height = PIXEL_GRID;
const pixelSmallCtx = pixelSmallCanvas.getContext("2d");

function drawPixelatedPlayer(x, y) {
    pixelCtx.clearRect(0, 0, PIXEL_CANVAS_SIZE, PIXEL_CANVAS_SIZE);
    drawPlayerSprite(pixelCtx, x - PIXEL_OFFSET_X, y - PIXEL_OFFSET_Y);

    pixelSmallCtx.clearRect(0, 0, PIXEL_GRID, PIXEL_GRID);
    pixelSmallCtx.drawImage(pixelCanvas, 0, 0, PIXEL_GRID, PIXEL_GRID);

    ctx.save();
    ctx.globalAlpha = 0.9;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(
        pixelSmallCanvas,
        x - PIXEL_OFFSET_X,
        y - PIXEL_OFFSET_Y,
        PIXEL_CANVAS_SIZE,
        PIXEL_CANVAS_SIZE
    );
    ctx.restore();
}

export function drawPlayer(gameTime: number, alpha: number) {
    if (
        player.invuln > 0 &&
        player.dashTimer <= 0 &&
        gameState === "playing" &&
        Math.floor(gameTime * 12) % 2 === 0
    ) {
        return;
    }

    const x = player.x + (player.x - player.prevX) * alpha;
    const y = player.y + (player.y - player.prevY) * alpha;

    // Ground shadow so the player reads as standing on the floor
    ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
    ctx.fillRect(x + 5, y + 39, 30, 4);
    ctx.fillStyle = "rgba(0, 0, 0, 0.20)";
    ctx.fillRect(x + 8, y + 41, 24, 2);

    if (player.dashTimer > 0) {
        drawPixelatedPlayer(x, y);
    } else {
        drawPlayerSprite(ctx, x, y);
    }
}

// ======================
// DRAW ENEMIES
// ======================

function drawEnemyBody(e: Enemy, ox?: number, oy?: number) {
    const x = e.x + (ox || 0);
    const y = e.y + (oy || 0);

    if (Assets.loaded && !Assets.fallbackMode && Assets.spritesheet) {
        const animState = e.animState || "idle";
        const animTime = e.animTime || 0;
        const frameData = getAnimationFrame(Assets.spritesheetDef, e.type, animState, animTime);

        if (frameData) {
            const frame = frameData.frame;
            const anchor = frameData.anchor;

            ctx.save();
            ctx.imageSmoothingEnabled = false;

            const s = frameData.scale || 1;
            const dx = x + e.width / 2 - anchor.x * s;
            const dy = y + e.height / 2 - anchor.y * s;

            ctx.drawImage(
                Assets.spritesheet,
                frame.x, frame.y, frame.w, frame.h,
                dx, dy, frame.w * s, frame.h * s
            );

            ctx.restore();
            return;
        }
    }

    if (e.type === "grunt") {

        ctx.fillStyle = "#eee";
        ctx.fillRect(x + 5, y + 20, 30, 18);

        ctx.fillStyle = "#d8d8d8";
        ctx.fillRect(x + 10, y + 32, 8, 8);
        ctx.fillRect(x + 22, y + 32, 8, 8);

        ctx.fillStyle = "#f2f2f2";
        ctx.fillRect(x + 8, y + 14, 25, 20);

        ctx.fillStyle = "#aaa";
        ctx.fillRect(x + 8, y + 18, 5, 15);
        ctx.fillRect(x + 28, y + 18, 5, 15);

        ctx.fillStyle = "#f1c7aa";
        ctx.fillRect(x + 10, y + 3, 20, 17);

        ctx.fillStyle = "#f4f4f4";
        ctx.fillRect(x + 7, y + 1, 26, 8);
        ctx.fillRect(x + 5, y + 6, 7, 20);
        ctx.fillRect(x + 28, y + 6, 7, 20);

        ctx.fillStyle = "#ffffff";
        ctx.fillRect(x + 10, y, 5, 7);
        ctx.fillRect(x + 19, y - 1, 5, 8);
        ctx.fillRect(x + 27, y + 1, 4, 7);

        ctx.fillStyle = "#555";
        ctx.fillRect(x + 13, y + 10, 4, 2);
        ctx.fillRect(x + 23, y + 10, 4, 2);

        ctx.fillStyle = "#aaa";
        ctx.fillRect(x + 36, y + 5, 4, 30);

        ctx.fillStyle = "#eee";
        ctx.fillRect(x + 37, y + 5, 2, 27);

        ctx.fillStyle = "#555";
        ctx.fillRect(x + 34, y + 31, 9, 4);
    }

    if (e.type === "fast") {

        ctx.fillStyle = "#1f1f26";
        ctx.fillRect(x + 3, y + 20, 24, 12);

        ctx.fillStyle = "#16161c";
        ctx.fillRect(x + 8, y + 26, 7, 7);
        ctx.fillRect(x + 16, y + 26, 7, 7);

        ctx.fillStyle = "#26262f";
        ctx.fillRect(x + 6, y + 10, 18, 14);

        ctx.fillStyle = "#1c1c24";
        ctx.fillRect(x + 4, y + 2, 22, 12);
        ctx.fillRect(x + 3, y + 6, 5, 10);

        ctx.fillStyle = "#3a3a46";
        ctx.fillRect(x + 7, y + 4, 16, 5);

        ctx.fillStyle = "#ff5a5a";
        ctx.fillRect(x + 11, y + 9, 3, 2);
        ctx.fillRect(x + 18, y + 9, 3, 2);

        ctx.fillStyle = "#888";
        ctx.fillRect(x + 24, y + 4, 3, 22);

        ctx.fillStyle = "#ccc";
        ctx.fillRect(x + 24, y + 4, 1, 20);

        ctx.fillStyle = "#444";
        ctx.fillRect(x + 21, y + 23, 7, 3);
    }

    if (e.type === "tank") {

        ctx.fillStyle = "#2e2e36";
        ctx.fillRect(x + 6, y + 40, 14, 12);
        ctx.fillRect(x + 30, y + 40, 14, 12);

        ctx.fillStyle = "#1a1a20";
        ctx.fillRect(x + 3, y + 49, 18, 5);
        ctx.fillRect(x + 29, y + 49, 18, 5);

        ctx.fillStyle = "#45454e";
        ctx.fillRect(x + 4, y + 18, 42, 26);

        ctx.fillStyle = "#33333a";
        ctx.fillRect(x + 4, y + 18, 6, 20);
        ctx.fillRect(x + 40, y + 18, 6, 20);

        ctx.fillStyle = "#5a5a64";
        ctx.fillRect(x + 16, y + 4, 18, 16);

        ctx.fillStyle = "#2e2e36";
        ctx.fillRect(x + 13, y + 2, 24, 8);

        ctx.fillStyle = "#ff5a5a";
        ctx.fillRect(x + 19, y + 8, 12, 3);

        ctx.fillStyle = "#1c1c22";
        ctx.fillRect(x + 2, y + 24, 10, 16);
        ctx.fillRect(x + 38, y + 24, 10, 16);

        ctx.fillStyle = "#888";
        ctx.fillRect(x + 46, y + 8, 5, 32);

        ctx.fillStyle = "#bbb";
        ctx.fillRect(x + 47, y + 8, 2, 30);

        ctx.fillStyle = "#444";
        ctx.fillRect(x + 43, y + 36, 10, 4);
    }

    if (e.type === "swarm") {

        ctx.fillStyle = "#5d1010";
        ctx.fillRect(x + 18, y + 12, 6, 3);

        ctx.fillStyle = "#7a1010";
        ctx.fillRect(x + 5, y + 10, 14, 12);

        ctx.fillStyle = "#8b1a1a";
        ctx.fillRect(x + 8, y + 13, 8, 8);

        ctx.fillStyle = "#8b1a1a";
        ctx.fillRect(x + 7, y + 2, 10, 10);

        ctx.fillStyle = "#1a1a1e";
        ctx.fillRect(x + 5, y, 4, 4);
        ctx.fillRect(x + 15, y, 4, 4);

        ctx.fillStyle = "#ff5a5a";
        ctx.fillRect(x + 9, y + 5, 2, 2);
        ctx.fillRect(x + 14, y + 5, 2, 2);

        ctx.fillStyle = "#4a0d0d";
        ctx.fillRect(x + 7, y + 20, 4, 4);
        ctx.fillRect(x + 13, y + 20, 4, 4);
    }

    if (e.type === "caster") {

        ctx.fillStyle = "#1f122c";
        ctx.fillRect(x + 4, y + 26, 26, 10);

        ctx.fillStyle = "#2a1a3a";
        ctx.fillRect(x + 6, y + 14, 22, 20);

        ctx.fillStyle = "#3a2a4a";
        ctx.fillRect(x + 8, y + 2, 18, 16);

        ctx.fillStyle = "#0d0d10";
        ctx.fillRect(x + 12, y + 8, 10, 8);

        ctx.fillStyle = "#c07bff";
        ctx.fillRect(x + 13, y + 10, 3, 2);
        ctx.fillRect(x + 19, y + 10, 3, 2);

        ctx.fillStyle = "#4a3a2a";
        ctx.fillRect(x + 28, y + 2, 3, 26);

        ctx.fillStyle = "#c07bff";
        ctx.fillRect(x + 26, y - 2, 7, 7);

        ctx.fillStyle = "#e0c0ff";
        ctx.fillRect(x + 28, y, 3, 3);
    }

    if (e.type === "exploder") {

        ctx.fillStyle = "#3a2a1a";
        ctx.fillRect(x + 8, y + 28, 7, 8);
        ctx.fillRect(x + 21, y + 28, 7, 8);

        ctx.fillStyle = "#4a3a28";
        ctx.fillRect(x + 5, y + 8, 26, 24);

        ctx.fillStyle = "#5c4a34";
        ctx.fillRect(x + 9, y + 12, 18, 16);

        ctx.fillStyle = "#0d0d10";
        ctx.fillRect(x + 12, y + 16, 4, 4);
        ctx.fillRect(x + 20, y + 16, 4, 4);

        ctx.fillStyle = "#ffd75a";
        ctx.fillRect(x + 13, y + 23, 10, 2);

        ctx.fillStyle = "#8b6a3a";
        ctx.fillRect(x + 15, y + 4, 6, 5);

        ctx.fillStyle = "#ff9d22";
        ctx.fillRect(x + 16, y + 1, 4, 4);
    }

    if (e.type === "warden") {

        ctx.fillStyle = "#2e2e36";
        ctx.fillRect(x + 8, y + 36, 10, 12);
        ctx.fillRect(x + 28, y + 36, 10, 12);

        ctx.fillStyle = "#1a1a20";
        ctx.fillRect(x + 5, y + 45, 14, 4);
        ctx.fillRect(x + 27, y + 45, 14, 4);

        ctx.fillStyle = "#45454e";
        ctx.fillRect(x + 6, y + 16, 34, 26);

        ctx.fillStyle = "#33333a";
        ctx.fillRect(x + 6, y + 16, 5, 20);
        ctx.fillRect(x + 35, y + 16, 5, 20);

        ctx.fillStyle = "#5a5a64";
        ctx.fillRect(x + 14, y + 4, 18, 16);

        ctx.fillStyle = "#ff5a5a";
        ctx.fillRect(x + 18, y + 10, 10, 3);

        ctx.fillStyle = "#2e2e36";
        ctx.fillRect(x + 2, y + 20, 6, 14);
        ctx.fillRect(x + 38, y + 20, 6, 14);

        ctx.fillStyle = "#888";
        ctx.fillRect(x, y + 16, 4, 22);

        ctx.fillStyle = "#2a2a33";
        ctx.fillRect(x + 38, y + 14, 10, 24);

        ctx.fillStyle = "#4a4a55";
        ctx.fillRect(x + 39, y + 16, 8, 20);

        ctx.fillStyle = "#ffd75a";
        ctx.fillRect(x + 42, y + 20, 3, 8);
    }

    if (e.type === "boss") {

        ctx.fillStyle = "#7a1010";
        ctx.fillRect(x + 8, y + 44, 54, 26);

        ctx.fillStyle = "#101014";
        ctx.fillRect(x + 16, y + 60, 16, 14);
        ctx.fillRect(x + 38, y + 60, 16, 14);

        ctx.fillStyle = "#0d0d10";
        ctx.fillRect(x + 18, y + 72, 20, 5);
        ctx.fillRect(x + 34, y + 72, 20, 5);

        ctx.fillStyle = "#141418";
        ctx.fillRect(x + 6, y + 20, 58, 28);

        ctx.fillStyle = "#2a2a30";
        ctx.fillRect(x + 6, y + 20, 8, 24);
        ctx.fillRect(x + 56, y + 20, 8, 24);

        ctx.fillStyle = "#1c1c22";
        ctx.fillRect(x + 14, y + 2, 42, 22);

        ctx.fillStyle = "#0a0a0e";
        ctx.fillRect(x + 10, y - 2, 50, 10);

        ctx.fillStyle = "#ffd75a";
        ctx.fillRect(x + 12, y - 7, 8, 7);
        ctx.fillRect(x + 22, y - 9, 8, 9);
        ctx.fillRect(x + 32, y - 9, 8, 9);
        ctx.fillRect(x + 42, y - 7, 8, 7);

        ctx.fillStyle = "#ff5a5a";
        ctx.fillRect(x + 18, y + 8, 8, 3);
        ctx.fillRect(x + 34, y + 8, 8, 3);

        ctx.fillStyle = "#5a5a64";
        ctx.fillRect(x + 60, y + 4, 7, 44);

        ctx.fillStyle = "#aaa";
        ctx.fillRect(x + 62, y + 4, 4, 42);

        ctx.fillStyle = "#888";
        ctx.fillRect(x + 58, y + 44, 12, 5);
    }
}

export function drawEnemies(gameTime: number, alpha: number) {
    for (const e of enemies) {
        if (e.health <= 0) {
            if (e.deadTimer > 0) {
                const t = e.deadTimer / DEATH_FADE;
                ctx.globalAlpha = Math.max(0, t);
                drawEnemyBody(e, 0, (1 - t) * 10);
                ctx.globalAlpha = 1;
            }
            continue;
        }

        drawEnemyEntity(e, gameTime, alpha);
    }
}

// Renderable subset of an enemy used by both the local sim and the
// online world renderer (server state mirrored by net/world).
export interface EnemyRenderView {
    type: string;
    x: number;
    y: number;
    prevX: number;
    prevY: number;
    width: number;
    height: number;
    state: string;
    facing: Direction;
    flash: number;
    barHealth: number;
    maxHealth: number;
    animState?: string;
    animTime?: number;
}

export function drawEnemyEntity(e: EnemyRenderView, gameTime: number, alpha: number) {
    const x = e.x + (e.x - e.prevX) * alpha;
    const y = e.y + (e.y - e.prevY) * alpha;

    // Ground shadow under the enemy
    ctx.fillStyle = "rgba(0, 0, 0, 0.30)";
    ctx.fillRect(x + 3, y + e.height - 1, e.width - 6, 4);
    ctx.fillStyle = "rgba(0, 0, 0, 0.15)";
    ctx.fillRect(x + 6, y + e.height + 2, e.width - 12, 2);

    // Health bar

    if (e.barHealth < e.maxHealth || e.type === "boss") {
        const bw = e.width;
        const bh = 5;
        const ratio = Math.max(0, e.barHealth / e.maxHealth);
        const barColor = ratio > 0.5 ? "#7dff8a" : ratio > 0.25 ? "#ffd75a" : "#ff5a5a";

        ctx.fillStyle = "rgba(0, 0, 0, 0.65)";
        ctx.fillRect(x - 1, y - 13, bw + 2, bh + 2);

        ctx.fillStyle = barColor;
        ctx.fillRect(x, y - 12, bw * ratio, bh);

        ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
        ctx.fillRect(x, y - 12, bw * ratio, 1);

        ctx.strokeStyle = "rgba(0, 0, 0, 0.8)";
        ctx.lineWidth = 1;
        ctx.strokeRect(x - 0.5, y - 12.5, bw + 1, bh + 1);
    }

    ctx.save();

    if (e.facing === "left") {
        ctx.translate(x + e.width, 0);
        ctx.scale(-1, 1);
        ctx.translate(-x, 0);
    }

    // Windup telegraph

    if (e.state === "windup") {
        const pulse = 0.5 + 0.5 * Math.sin(gameTime * 20);

        ctx.fillStyle = "rgba(255, 60, 60, " + (0.15 + pulse * 0.25).toFixed(3) + ")";
        ctx.fillRect(x - 2, y - 2, e.width + 4, e.height + 4);

        ctx.fillStyle = "#ff5555";
        ctx.font = "bold 22px Arial";
        ctx.textAlign = "center";
        ctx.fillText("!", x + e.width / 2, y - 14);
    }

    drawEnemyBody(e as unknown as Enemy);

    // Hurt flash

    if (e.flash > 0) {
        ctx.fillStyle = "rgba(255, 255, 255, " + ((e.flash / 0.12) * 0.75).toFixed(3) + ")";
        ctx.fillRect(x - 2, y - 2, e.width + 4, e.height + 4);
    }

    ctx.restore();
}

// ======================
// DRAW LOOT
// ======================

export function drawLoot(gameTime: number) {
    for (const item of loot) {
        const bob = Math.sin(gameTime * 5 + item.x) * 2;

        if (Assets.loaded && !Assets.fallbackMode && Assets.spritesheet) {
            const frameData = getAnimationFrame(Assets.spritesheetDef, item.kind, "idle", gameTime);
            if (frameData) {
                const frame = frameData.frame;
                const anchor = frameData.anchor;

                ctx.save();
                ctx.imageSmoothingEnabled = false;

                const s = frameData.scale || 1;
                const dx = item.x - anchor.x * s;
                const dy = item.y + bob - anchor.y * s;

                ctx.drawImage(
                    Assets.spritesheet,
                    frame.x, frame.y, frame.w, frame.h,
                    dx, dy, frame.w * s, frame.h * s
                );

                ctx.restore();
                continue;
            }
        }

        if (item.kind === "potion") {
            const pulse = 0.5 + 0.5 * Math.sin(gameTime * 6 + item.x);

            ctx.globalAlpha = 0.25 + pulse * 0.25;
            ctx.fillStyle = "#ff6b6b";
            ctx.fillRect(item.x - 10, item.y - 9 + bob, 20, 20);
            ctx.globalAlpha = 1;

            ctx.fillStyle = "#c62828";
            ctx.fillRect(item.x - 5, item.y - 4 + bob, 10, 12);

            ctx.fillStyle = "#e57373";
            ctx.fillRect(item.x - 3, item.y - 2 + bob, 3, 7);

            ctx.fillStyle = "#fff0c0";
            ctx.fillRect(item.x - 2, item.y - 3 + bob, 1, 3);

            ctx.fillStyle = "#8d6e63";
            ctx.fillRect(item.x - 3, item.y - 7 + bob, 6, 3);
        } else {
            ctx.fillStyle = "#9e9e9e";
            ctx.fillRect(item.x - 8, item.y - 2 + bob, 14, 3);

            ctx.fillStyle = "#e0e0e0";
            ctx.fillRect(item.x - 7, item.y - 2 + bob, 12, 1);

            ctx.fillStyle = "#ffd75a";
            ctx.fillRect(item.x - 10, item.y + 2 + bob, 5, 3);

            const pulse = 0.5 + 0.5 * Math.sin(gameTime * 6);

            ctx.globalAlpha = 0.3 + pulse * 0.3;
            ctx.fillStyle = "#ffd75a";
            ctx.fillRect(item.x - 12, item.y - 5 + bob, 24, 10);
            ctx.globalAlpha = 1;
        }
    }
}