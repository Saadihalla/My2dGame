// ======================
// NET RENDER — draws the authoritative world mirrored from the server:
// arena floor, remote players, enemies, projectiles, HUD, ping, and the
// match-end banner. Local player is drawn from the predicted state.
// ======================

import { ctx, VIEW_WIDTH, VIEW_HEIGHT } from "../game/config";
import { drawEnemyEntity, drawProjectileEntity, type EnemyRenderView } from "../game/entities";
import { netWorld, netBoundary } from "./world";
import { camera } from "../game/state";

const ARENA_COLORS = ["#101014", "#14141a"];

// Stable hue per session id for remote players.
function playerHue(id: string): string {
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
        hash = (hash * 31 + id.charCodeAt(i)) | 0;
    }
    const hues = ["#7ec8ff", "#7dff8a", "#ffd75a", "#c07bff", "#ff9d22", "#ff6b6b"];
    return hues[Math.abs(hash) % hues.length];
}

// ======================
// ARENA
// ======================

export function drawNetArena() {
    const { w, h } = netBoundary();

    // Checkerboard floor
    const tile = 50;
    for (let row = 0; row * tile < h; row++) {
        for (let col = 0; col * tile < w; col++) {
            ctx.fillStyle = ARENA_COLORS[(row + col) % 2];
            ctx.fillRect(col * tile, row * tile, tile, tile);
        }
    }

    // Faint rune ring around the arena
    ctx.strokeStyle = "rgba(255, 215, 90, 0.10)";
    ctx.lineWidth = 2;
    ctx.strokeRect(4, 4, w - 8, h - 8);

    // Boundary warning glow
    const gradient = ctx.createLinearGradient(0, 0, w, h);
    gradient.addColorStop(0, "rgba(200, 30, 30, 0.05)");
    gradient.addColorStop(0.5, "rgba(0, 0, 0, 0)");
    gradient.addColorStop(1, "rgba(200, 30, 30, 0.05)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);
}

// ======================
// REMOTE PLAYERS
// ======================

export function drawRemotePlayer(p: any, gameTime: number, alpha: number) {
    const x = p.x + (p.x - p.prevX) * alpha;
    const y = p.y + (p.y - p.prevY) * alpha;
    const hue = playerHue(p.id);

    // Ground shadow
    ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
    ctx.fillRect(x + 5, y + 39, 30, 4);

    // Body (dark armor with a colored sash)
    ctx.fillStyle = "#1a1a1a";
    ctx.fillRect(x + 8, y + 15, 24, 20);

    ctx.fillStyle = "#333";
    ctx.fillRect(x + 10, y + 16, 6, 12);
    ctx.fillRect(x + 24, y + 16, 6, 12);

    ctx.fillStyle = hue;
    ctx.fillRect(x + 9, y + 27, 22, 4);

    ctx.fillStyle = "#151515";
    ctx.fillRect(x + 10, y + 33, 8, 8);
    ctx.fillRect(x + 22, y + 33, 8, 8);

    // Head
    ctx.fillStyle = "#c58b65";
    ctx.fillRect(x + 10, y + 5, 20, 12);
    ctx.fillStyle = "#0d0d0d";
    ctx.fillRect(x + 8, y + 1, 24, 6);
    ctx.fillRect(x + 12, y - 2, 8, 5);

    // Sword (facing)
    ctx.fillStyle = "#222";
    if (p.direction === "right") {
        ctx.fillRect(x + 36, y + 6, 32, 8);
        ctx.fillStyle = "#888";
        ctx.fillRect(x + 42, y + 9, 22, 2);
    } else if (p.direction === "left") {
        ctx.fillRect(x - 32, y + 6, 32, 8);
        ctx.fillStyle = "#888";
        ctx.fillRect(x - 26, y + 9, 22, 2);
    } else if (p.direction === "down") {
        ctx.fillRect(x + 16, y + 36, 8, 32);
    } else {
        ctx.fillRect(x + 16, y - 32, 8, 32);
    }

    // Swing flash
    if (p.attackTimer > 0) {
        ctx.fillStyle = "rgba(255, 255, 255, 0.25)";
        ctx.fillRect(x - 4, y - 4, 48, 48);
    }

    // Name + hp bar
    ctx.font = "bold 9px Arial";
    ctx.textAlign = "center";
    ctx.fillStyle = hue;
    ctx.fillText(p.name, x + 20, y - 8);

    if (p.hp < p.maxHp) {
        const bw = 40;
        const ratio = Math.max(0, p.hp / p.maxHp);
        ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
        ctx.fillRect(x - 1, y - 4, bw + 2, 5);
        ctx.fillStyle = ratio > 0.5 ? "#7dff8a" : ratio > 0.25 ? "#ffd75a" : "#ff5a5a";
        ctx.fillRect(x, y - 3, bw * ratio, 3);
    }

    // Invuln flicker
    if (p.invuln > 0 && Math.floor(gameTime * 12) % 2 === 0) {
        ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
        ctx.fillRect(x - 2, y - 2, 44, 44);
    }

    ctx.textAlign = "left";
}

// ======================
// LOCAL PLAYER (predicted state)
// ======================

export function drawLocalPlayer(gameTime: number) {
    const p = netWorld.predicted;
    if (!p) {
        return;
    }

    const x = p.x;
    const y = p.y;

    ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
    ctx.fillRect(x + 5, y + 39, 30, 4);

    // Local player reads with a golden trim so you always know who you are
    ctx.fillStyle = "#1a1a1a";
    ctx.fillRect(x + 8, y + 15, 24, 20);
    ctx.fillStyle = "#333";
    ctx.fillRect(x + 10, y + 16, 6, 12);
    ctx.fillRect(x + 24, y + 16, 6, 12);
    ctx.fillStyle = "#ffd75a";
    ctx.fillRect(x + 9, y + 27, 22, 4);
    ctx.fillStyle = "#151515";
    ctx.fillRect(x + 10, y + 33, 8, 8);
    ctx.fillRect(x + 22, y + 33, 8, 8);

    ctx.fillStyle = "#c58b65";
    ctx.fillRect(x + 10, y + 5, 20, 12);
    ctx.fillStyle = "#0d0d0d";
    ctx.fillRect(x + 8, y + 1, 24, 6);
    ctx.fillRect(x + 12, y - 2, 8, 5);

    // Dragonslayer
    ctx.fillStyle = "#222";
    if (p.direction === "right") {
        ctx.fillRect(x + 36, y + 6, 32, 8);
        ctx.fillStyle = "#888";
        ctx.fillRect(x + 42, y + 9, 22, 2);
        ctx.fillStyle = "#111";
        ctx.fillRect(x + 34, y + 4, 6, 12);
    } else if (p.direction === "left") {
        ctx.fillRect(x - 32, y + 6, 32, 8);
        ctx.fillStyle = "#888";
        ctx.fillRect(x - 26, y + 9, 22, 2);
        ctx.fillStyle = "#111";
        ctx.fillRect(x - 4, y + 4, 6, 12);
    } else if (p.direction === "down") {
        ctx.fillRect(x + 16, y + 36, 8, 32);
        ctx.fillStyle = "#111";
        ctx.fillRect(x + 14, y + 34, 12, 6);
    } else {
        ctx.fillRect(x + 16, y - 32, 8, 32);
        ctx.fillStyle = "#111";
        ctx.fillRect(x + 14, y - 4, 12, 6);
    }

    // Attack swing flash
    if (p.attackTimer > 0) {
        ctx.fillStyle = "rgba(255, 255, 255, 0.2)";
        ctx.fillRect(x - 4, y - 4, 48, 48);
    }

    // Dash air effect
    if (p.dashTimer > 0) {
        ctx.fillStyle = "rgba(41, 41, 41, 0.7)";
        ctx.fillRect(x - p.dashDX * 8, y - p.dashDY * 8 + 6, 12, 12);
        ctx.fillRect(x - p.dashDX * 16, y - p.dashDY * 16 + 10, 8, 8);
    }

    // Death veil
    if (!p.alive) {
        ctx.fillStyle = "rgba(120, 20, 20, 0.5)";
        ctx.fillRect(x, y, 40, 40);
    }

    // I-frames flicker
    if (p.invuln > 0 && Math.floor(gameTime * 12) % 2 === 0) {
        ctx.fillStyle = "rgba(255, 255, 255, 0.25)";
        ctx.fillRect(x - 2, y - 2, 44, 44);
    }
}

// ======================
// WORLD DRAW (everything net-related)
// ======================

export function drawNetWorld(gameTime: number, alpha: number) {
    const camX = cameraX();
    const camY = cameraY();

    ctx.save();
    ctx.translate(-camX, -camY);

    drawNetArena();

    // Enemies
    netWorld.enemies.forEach(e => {
        const view: EnemyRenderView = {
            type: e.type,
            x: e.x,
            y: e.y,
            prevX: e.prevX,
            prevY: e.prevY,
            width: e.width,
            height: e.height,
            state: e.state,
            facing: e.facing as EnemyRenderView["facing"],
            flash: e.flash,
            barHealth: e.hp,
            maxHealth: e.maxHp
        };
        drawEnemyEntity(view, gameTime, 0);
    });

    // Projectiles
    for (const p of netWorld.projectiles) {
        drawProjectileEntity({ x: p.x, y: p.y, vx: 0, vy: 0, size: p.size, damage: p.damage, life: 1, color: p.color }, gameTime);
    }

    // Remote players
    netWorld.players.forEach(p => {
        if (p.id === netWorld.localId) {
            return;
        }
        drawRemotePlayer(p, gameTime, alpha);
    });

    // Local player last (on top)
    drawLocalPlayer(gameTime);

    ctx.restore();

    drawNetHUD();
    drawNetBanner();
}

// ======================
// HUD
// ======================

export function drawNetHUD() {
    const p = netWorld.predicted;

    // Local player health
    if (p) {
        const hpRatio = Math.max(0, p.hp / p.maxHp);
        ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
        ctx.fillRect(10, 12, 204, 20);
        ctx.fillStyle = hpRatio > 0.5 ? "#7dff8a" : hpRatio > 0.25 ? "#ffd75a" : "#ff5a5a";
        ctx.fillRect(12, 14, 200 * hpRatio, 16);

        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 10px Arial";
        ctx.textAlign = "left";
        ctx.fillText("HP " + Math.ceil(p.hp) + "/" + p.maxHp, 16, 26);

        // Level + score
        ctx.fillStyle = "#ffd75a";
        ctx.fillText("LV " + p.level, 130, 26);
    }

    // Wave + status
    ctx.fillStyle = "#9aa";
    ctx.font = "bold 12px Arial";
    ctx.textAlign = "center";
    ctx.fillText("WAVE " + netWorld.wave, VIEW_WIDTH / 2, 26);

    ctx.font = "9px Arial";
    ctx.fillStyle = "#666";
    ctx.fillText(netWorld.waveState === "break" ? "PREPARE" : netWorld.waveState === "clear" ? "CLEARED" : "FIGHT", VIEW_WIDTH / 2, 40);

    // Ping
    ctx.textAlign = "right";
    ctx.fillStyle = netWorld.pingMs < 100 ? "#7dff8a" : netWorld.pingMs < 200 ? "#ffd75a" : "#ff5a5a";
    ctx.font = "bold 10px Arial";
    ctx.fillText("PING " + Math.round(netWorld.pingMs) + "ms", VIEW_WIDTH - 12, 24);

    ctx.textAlign = "left";
}

// ======================
// MATCH END BANNER
// ======================

export function drawNetBanner() {
    if (!netWorld.ended) {
        return;
    }

    ctx.fillStyle = "rgba(0, 0, 0, 0.75)";
    ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);

    const victory = netWorld.status === "victory";

    ctx.textAlign = "center";
    ctx.fillStyle = victory ? "#ffd75a" : "#ff5a5a";
    ctx.font = "bold 30px Arial";
    ctx.fillText(victory ? "VICTORY" : "DEFEAT", VIEW_WIDTH / 2, VIEW_HEIGHT / 2 - 40);

    ctx.fillStyle = "#e6e6e6";
    ctx.font = "12px Arial";
    ctx.fillText("Wave " + netWorld.wave + " reached", VIEW_WIDTH / 2, VIEW_HEIGHT / 2);

    if (netWorld.endInfo && netWorld.endInfo.results.length > 0) {
        const me = netWorld.endInfo.results.find(r => r.sessionId === netWorld.localId);
        if (me) {
            ctx.fillStyle = "#7ec8ff";
            ctx.font = "bold 14px Arial";
            ctx.fillText("SCORE " + me.score + " · KILLS " + me.kills, VIEW_WIDTH / 2, VIEW_HEIGHT / 2 + 30);
        }
    }

    ctx.fillStyle = "#888";
    ctx.font = "10px Arial";
    ctx.fillText("Returning to lobby...", VIEW_WIDTH / 2, VIEW_HEIGHT / 2 + 60);

    ctx.textAlign = "left";
}

// ======================
// HELPERS
// ======================

function cameraX(): number {
    return camera.x + (camera.x - camera.prevX);
}

function cameraY(): number {
    return camera.y + (camera.y - camera.prevY);
}