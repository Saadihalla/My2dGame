// ======================
// FX (particles, damage numbers, shake, vignette)
// ======================

import { ctx, VIEW_WIDTH, VIEW_HEIGHT } from "./config.js";
import { Settings, drawText } from "./theme.js";

let particles = [];
let numbers = [];
let shake = 0;
let hitVignette = 0;
let hitStop = 0;

export function spawnParticles(x, y, count, colors, speed) {
    for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const magnitude = speed * (0.4 + Math.random() * 0.8);

        particles.push({
            x: x,
            y: y,
            vx: Math.cos(angle) * magnitude,
            vy: Math.sin(angle) * magnitude - 40,
            life: 0.3 + Math.random() * 0.35,
            maxLife: 0.65,
            size: 2 + Math.random() * 3,
            color: colors[Math.floor(Math.random() * colors.length)]
        });
    }
}

export function addNumber(x, y, text, color) {
    numbers.push({
        x: x,
        y: y,
        life: 0.9,
        text: text,
        color: color
    });
}

export function addShake(amount) {
    if (!Settings.shake) {
        return;
    }
    shake = Math.min(shake + amount, 18);
}

export function setHitVignette() {
    hitVignette = 1;
}

// Brief full-freeze for combat impact (kills, boss hits). While the
// freeze is active the game update loop pauses everything.

export function addHitStop(amount) {
    hitStop = Math.max(hitStop, amount);
}

export function tickHitStop(dt) {
    if (hitStop > 0) {
        hitStop -= dt;
        return true;
    }
    return false;
}

export function updateFX(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.life -= dt;

        if (p.life <= 0) {
            particles.splice(i, 1);
            continue;
        }

        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 350 * dt;
    }

    for (let i = numbers.length - 1; i >= 0; i--) {
        const n = numbers[i];
        n.life -= dt;
        n.y -= 45 * dt;

        if (n.life <= 0) {
            numbers.splice(i, 1);
        }
    }

    if (shake > 0) {
        shake = Math.max(0, shake - 35 * dt);
    }

    if (hitVignette > 0) {
        hitVignette = Math.max(0, hitVignette - 1.6 * dt);
    }
}

export function clearFX() {
    particles.length = 0;
    numbers.length = 0;
    shake = 0;
    hitVignette = 0;
    hitStop = 0;
}

export function getShake() {
    return shake;
}

export function drawParticles() {
    for (const p of particles) {
        ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;
}

export function drawNumbers() {
    for (const n of numbers) {
        ctx.globalAlpha = Math.min(1, n.life / 0.45);
        drawText(ctx, n.text, n.x, n.y, 8, n.color, "center");
    }
    ctx.globalAlpha = 1;
}

export function drawVignette(lowHealth) {
    const alpha = Math.max(hitVignette * 0.6, lowHealth * 0.35);

    if (alpha <= 0.02) {
        return;
    }

    const gradient = ctx.createRadialGradient(
        VIEW_WIDTH / 2,
        VIEW_HEIGHT / 2,
        VIEW_HEIGHT * 0.35,
        VIEW_WIDTH / 2,
        VIEW_HEIGHT / 2,
        VIEW_HEIGHT * 0.75
    );

    gradient.addColorStop(0, "rgba(150, 0, 0, 0)");
    gradient.addColorStop(1, "rgba(150, 0, 0, " + alpha.toFixed(3) + ")");

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
}