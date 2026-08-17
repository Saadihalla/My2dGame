// ======================
// FX (particles, damage numbers, shake, vignette)
// ======================

import { ctx, VIEW_WIDTH, VIEW_HEIGHT } from "./config";
import { Settings, drawText } from "./theme";

interface Particle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    life: number;
    maxLife: number;
    size: number;
    color: string;
}

interface DamageNumber {
    x: number;
    y: number;
    life: number;
    text: string;
    color: string;
}

const particles: Particle[] = [];
const numbers: DamageNumber[] = [];
let shake = 0;
let hitVignette = 0;
let hitStop = 0;

export function spawnParticles(x: number, y: number, count: number, colors: string[], speed: number) {
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

export function addNumber(x: number, y: number, text: string, color: string) {
    numbers.push({
        x: x,
        y: y,
        life: 0.9,
        text: text,
        color: color
    });
}

export function addShake(amount: number) {
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

export function addHitStop(amount: number) {
    hitStop = Math.max(hitStop, amount);
}

export function tickHitStop(dt: number): boolean {
    if (hitStop > 0) {
        hitStop -= dt;
        return true;
    }
    return false;
}

export function updateFX(dt: number) {
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

export function getShake(): number {
    return shake;
}

export function drawParticles() {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";

    for (const p of particles) {
        const fade = Math.max(0, p.life / p.maxLife);

        // Soft halo around each spark
        ctx.globalAlpha = fade * 0.3;
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x - p.size, p.y - p.size, p.size * 2, p.size * 2);

        // Bright core
        ctx.globalAlpha = fade;
        ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }

    ctx.restore();
    ctx.globalAlpha = 1;
}

export function drawNumbers() {
    for (const n of numbers) {
        const fade = Math.min(1, n.life / 0.45);
        const pop = 1 + Math.max(0, 1 - n.life / 0.9) * 0.5;

        ctx.save();
        ctx.globalAlpha = fade;
        ctx.translate(n.x, n.y);
        ctx.scale(pop, pop);
        drawText(ctx, n.text, 0, 0, 8, n.color, "center");
        ctx.restore();
    }
    ctx.globalAlpha = 1;
}

export function drawVignette(lowHealth: number) {
    const alpha = Math.max(hitVignette * 0.6, lowHealth * 0.35);

    // Faint ambient vignette for cinematic depth
    const ambient = ctx.createRadialGradient(
        VIEW_WIDTH / 2,
        VIEW_HEIGHT / 2,
        VIEW_HEIGHT * 0.42,
        VIEW_WIDTH / 2,
        VIEW_HEIGHT / 2,
        VIEW_HEIGHT * 0.78
    );
    ambient.addColorStop(0, "rgba(0, 0, 0, 0)");
    ambient.addColorStop(1, "rgba(0, 0, 0, 0.22)");
    ctx.fillStyle = ambient;
    ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);

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