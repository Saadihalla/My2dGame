// ======================
// ENTITIES (player, enemies, loot)
// ======================

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
} from "./config.js";

import { gameState, stats, addScore } from "./state.js";
import { triggerPlayerDeath, triggerLevelUp } from "./events.js";
import { keys, attacking, consumeDashRequest } from "./input.js";
import { AudioFX } from "./audio.js";
import {
    spawnParticles,
    addNumber,
    addShake,
    setHitVignette,
    addHitStop
} from "./fx.js";
import { currentLevel, isColliding, aabb } from "./levels.js";
import { decideEnemyState } from "./logic/ai.js";
import { rollLoot } from "./logic/loot.js";
import { dashDirection } from "./logic/dash.js";

export const player = {
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

const ENEMY_TYPES = {
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

export const enemies = [];
export const loot = [];

export function spawnEnemy(type, x, y, hpScale) {
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
        score: t.score,
        xp: t.xp,
        knockResist: t.knockResist,
        colors: t.colors,
        facing: "left",
        state: "chase",
        stateTimer: 0,
        cooldown: 0,
        flash: 0,
        kx: 0,
        ky: 0,
        deadTimer: 0
    });
}

function enemyBlocked(x, y, w, h) {
    if (isColliding(x, y, w, h)) {
        return true;
    }

    const playerBox = { x: player.x, y: player.y, w: player.width, h: player.height };
    const rect = { x: x, y: y, w: w, h: h };

    return aabb(rect, playerBox);
}

function tryMove(ent, vx, vy) {
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

export function updatePlayer(dt) {
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

function getOverlap(e, p) {
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

function damageEnemy(e) {
    const crit = Math.random() < player.critChance;
    const damage = Math.round(player.damage * (crit ? 2 : 1));

    e.health -= damage;
    e.flash = 0.12;

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

function killEnemy(e) {
    e.health = 0;
    e.flash = 0;
    e.deadTimer = DEATH_FADE;

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
    gainXP(e.xp);

    if (e.type === "boss") {
        addNumber(e.x + e.width / 2, e.y - 24, "BOSS SLAIN", "#ffd75a");
    }

    dropLoot(e);
}

export function playerAttack(dt) {
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

function strikePlayer(e) {
    if (player.invuln > 0 || gameState !== "playing") {
        return;
    }

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

    player.health -= e.damage;
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
    addNumber(player.x + player.width / 2, player.y - 10, String(e.damage), "#ff6b6b");

    if (player.health <= 0) {
        player.health = 0;
        triggerPlayerDeath();
    }
}

// ======================
// ENEMY AI
// ======================

export function updateEnemies(dt) {
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

        e.facing = dx >= 0 ? "right" : "left";

        updateEnemyState(e, dx, dy, dist, dt);
    }

    // Remove fully faded corpses (prevents dead enemies from
    // accumulating across waves).

    for (let i = enemies.length - 1; i >= 0; i--) {
        if (enemies[i].health <= 0 && enemies[i].deadTimer <= 0) {
            enemies.splice(i, 1);
        }
    }
}

function updateEnemyState(e, dx, dy, dist, dt) {
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
        strikePlayer(e);
        e.cooldown = decision.cooldown;
    }

    if (decision.state !== e.state || decision.timer !== undefined) {
        e.state = decision.state;
        if (decision.timer !== undefined) {
            e.stateTimer = decision.timer;
        }
    }

    if (e.state === "chase" && dist > e.attackRange) {
        const vx = (dx / dist) * e.speed * dt;
        const vy = (dy / dist) * e.speed * dt;
        tryMove(e, vx, vy);
    }

    if (e.state === "retreat" && dist > 1) {
        const vx = (-dx / dist) * e.speed * dt;
        const vy = (-dy / dist) * e.speed * dt;
        tryMove(e, vx, vy);
    }
}

export function allEnemiesDead() {
    return enemies.every(function (e) {
        return e.health <= 0;
    });
}

// ======================
// XP / LEVELS
// ======================

function gainXP(amount) {
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

function dropLoot(e) {
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

function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
}

function drawSwordSwing(gctx, x, y) {
    const progress = 1 - player.attackTimer / ATTACK_DURATION;
    const sweep = -1.2 + easeOutCubic(progress) * 2.4;

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

    gctx.fillStyle = "#777";
    gctx.fillRect(0, -3, 34, 6);

    gctx.fillStyle = "#bbb";
    gctx.fillRect(2, -3, 30, 2);

    gctx.fillStyle = "#151515";
    gctx.fillRect(-2, 2, 7, 3);

    gctx.restore();
}

// Draws the full player sprite (body + sword) with a given context,
// so it can be re-rendered through the pixelation pass while dashing.

function drawPlayerSprite(gctx, x, y) {
    const swinging = player.attackTimer > 0;

    gctx.fillStyle = "#151515";
    gctx.fillRect(x + 4, y + 18, 8, 18);

    gctx.fillStyle = "#242424";
    gctx.fillRect(x + 9, y + 31, 9, 9);
    gctx.fillRect(x + 23, y + 31, 9, 9);

    gctx.fillStyle = "#111";
    gctx.fillRect(x + 7, y + 38, 11, 4);
    gctx.fillRect(x + 22, y + 38, 13, 4);

    gctx.fillStyle = "#292929";
    gctx.fillRect(x + 8, y + 15, 25, 19);

    gctx.fillStyle = "#444";
    gctx.fillRect(x + 10, y + 17, 5, 12);
    gctx.fillRect(x + 25, y + 17, 5, 12);

    gctx.fillStyle = "#c58b65";
    gctx.fillRect(x + 10, y + 4, 20, 16);

    gctx.fillStyle = "#080808";
    gctx.fillRect(x + 7, y + 1, 26, 8);
    gctx.fillRect(x + 5, y + 5, 7, 12);
    gctx.fillRect(x + 28, y + 5, 6, 10);

    gctx.fillRect(x + 8, y, 7, 5);
    gctx.fillRect(x + 17, y - 2, 7, 6);
    gctx.fillRect(x + 25, y, 7, 5);

    gctx.fillStyle = "#eee";
    gctx.fillRect(x + 13, y + 10, 4, 2);
    gctx.fillRect(x + 23, y + 10, 4, 2);

    gctx.fillStyle = "#242424";
    gctx.fillRect(x + 2, y + 17, 8, 17);
    gctx.fillRect(x + 31, y + 16, 8, 18);

    if (swinging) {

        drawSwordSwing(gctx, x, y);

    } else {

        if (player.direction === "right") {

            gctx.fillStyle = "#777";
            gctx.fillRect(x + 38, y + 10, 28, 6);

            gctx.fillStyle = "#bbb";
            gctx.fillRect(x + 40, y + 10, 24, 2);

            gctx.fillStyle = "#151515";
            gctx.fillRect(x + 37, y + 17, 8, 4);
        }

        if (player.direction === "left") {

            gctx.fillStyle = "#777";
            gctx.fillRect(x - 28, y + 10, 28, 6);

            gctx.fillStyle = "#bbb";
            gctx.fillRect(x - 26, y + 10, 24, 2);

            gctx.fillStyle = "#151515";
            gctx.fillRect(x - 5, y + 17, 8, 4);
        }

        if (player.direction === "up") {

            gctx.fillStyle = "#777";
            gctx.fillRect(x + 17, y - 27, 6, 27);

            gctx.fillStyle = "#bbb";
            gctx.fillRect(x + 17, y - 25, 2, 23);

            gctx.fillStyle = "#151515";
            gctx.fillRect(x + 14, y - 3, 12, 5);
        }

        if (player.direction === "down") {

            gctx.fillStyle = "#777";
            gctx.fillRect(x + 17, y + 40, 6, 27);

            gctx.fillStyle = "#bbb";
            gctx.fillRect(x + 19, y + 42, 2, 23);

            gctx.fillStyle = "#151515";
            gctx.fillRect(x + 14, y + 38, 12, 5);
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

export function drawPlayer(gameTime, alpha) {
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

    if (player.dashTimer > 0) {
        drawPixelatedPlayer(x, y);
    } else {
        drawPlayerSprite(ctx, x, y);
    }
}

// ======================
// DRAW ENEMIES
// ======================

function drawEnemyBody(e, ox, oy) {
    const x = e.x + (ox || 0);
    const y = e.y + (oy || 0);

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

export function drawEnemies(gameTime, alpha) {
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

        const x = e.x + (e.x - e.prevX) * alpha;
        const y = e.y + (e.y - e.prevY) * alpha;

        // Health bar

        if (e.health < e.maxHealth || e.type === "boss") {
            ctx.fillStyle = "darkred";
            ctx.fillRect(x, y - 10, e.width, 5);

            ctx.fillStyle = "lime";
            ctx.fillRect(x, y - 10, e.width * Math.max(0, e.barHealth / e.maxHealth), 5);
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

        drawEnemyBody(e);

        // Hurt flash

        if (e.flash > 0) {
            ctx.fillStyle = "rgba(255, 255, 255, " + ((e.flash / 0.12) * 0.75).toFixed(3) + ")";
            ctx.fillRect(x - 2, y - 2, e.width + 4, e.height + 4);
        }

        ctx.restore();
    }
}

// ======================
// DRAW LOOT
// ======================

export function drawLoot(gameTime) {
    for (const item of loot) {
        const bob = Math.sin(gameTime * 5 + item.x) * 2;

        if (item.kind === "potion") {
            ctx.fillStyle = "#c62828";
            ctx.fillRect(item.x - 5, item.y - 4 + bob, 10, 12);

            ctx.fillStyle = "#e57373";
            ctx.fillRect(item.x - 3, item.y - 2 + bob, 3, 7);

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