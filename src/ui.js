// ======================
// UI (HUD, screens, buttons, settings)
// ======================

import { canvas, ctx, VIEW_WIDTH, VIEW_HEIGHT, DASH_COOLDOWN } from "./config.js";
import { gameState, gameTime, stats, wave, waveState, waveTimer, highScore, newHighScore } from "./state.js";
import { currentPlayer } from "./auth.js";
import { player, enemies, ENEMY_TYPES } from "./entities.js";
import {
    COLORS,
    drawPanel,
    drawGradientBar,
    drawIcon,
    drawText,
    wrapText,
    Settings
} from "./theme.js";

let uiButtons = [];

export function setButtons(list) {
    uiButtons = list;
}

export function makeButton(label, action, y, width) {
    return {
        x: VIEW_WIDTH / 2 - (width || 200) / 2,
        y: y,
        w: width || 200,
        h: 48,
        label: label,
        action: action,
        kind: "button"
    };
}

export function makeCard(label, desc, key, x, y, w, h, action, id) {
    return {
        x: x,
        y: y,
        w: w,
        h: h,
        label: label,
        desc: desc,
        key: key,
        id: id,
        kind: "card",
        action: action
    };
}

const UPGRADE_ICONS = {
    damage: "sword",
    range: "sword",
    speed: "sword",
    vitality: "heart",
    boots: "dash",
    reflex: "dash",
    crit: "upgrade",
    lifesteal: "potion",
    cleave: "upgrade"
};

function upgradeIcon(id) {
    return UPGRADE_ICONS[id] || "upgrade";
}

function drawButton(button) {
    if (button.kind === "card") {
        drawPanel(ctx, button.x, button.y, button.w, button.h);

        ctx.fillStyle = COLORS.panelLight;
        ctx.fillRect(button.x + 8, button.y + 8, button.w - 16, 42);

        drawIcon(ctx, upgradeIcon(button.id), button.x + 14, button.y + 13, 30, COLORS.gold);

        drawText(ctx, String(button.key), button.x + button.w - 22, button.y + 18, 11, COLORS.gold, "center");
        drawText(ctx, button.label, button.x + button.w / 2, button.y + 64, 10, COLORS.text, "center");

        const descLines = wrapText(ctx, button.desc, 7, button.w - 20).slice(0, 2);
        descLines.forEach(function (line, i) {
            drawText(ctx, line, button.x + button.w / 2, button.y + 82 + i * 10, 7, COLORS.dim, "center");
        });

        drawText(ctx, "[" + button.key + "] or click", button.x + button.w / 2, button.y + button.h - 10, 7, "rgba(255,255,255,0.5)", "center");
        return;
    }

    drawPanel(ctx, button.x, button.y, button.w, button.h);

    ctx.fillStyle = "rgba(255, 215, 90, 0.05)";
    ctx.fillRect(button.x + 1, button.y + 1, button.w - 2, button.h - 2);

    drawText(ctx, button.label, button.x + button.w / 2, button.y + button.h / 2 + 6, 12, COLORS.text, "center");
}

// ======================
// HUD
// ======================

export function drawHUD() {
    const barWidth = 170;
    const barHeight = 12;
    const x = 64;
    const y = 14;

    // ----- Left panel: health / xp / dash -----

    drawPanel(ctx, x - 8, y - 8, barWidth + 56, 84);

    // HP: icon, then bar; the number lives on the bar itself so it
    // never overflows the panel.
    drawIcon(ctx, "heart", x + 4, y + 2, 18, COLORS.red);
    drawGradientBar(
        ctx, x + 26, y + 4, barWidth, barHeight,
        Math.max(0, player.health / player.maxHealth),
        "#ff6b6b", "#a01818"
    );
    drawText(
        ctx,
        Math.max(0, Math.ceil(player.health)) + "/" + player.maxHealth,
        x + 26 + barWidth / 2, y + 13, 8, "#fff", "center"
    );

    drawIcon(ctx, "upgrade", x + 5, y + 22, 14, COLORS.blue);
    drawGradientBar(
        ctx, x + 26, y + 24, barWidth, 7,
        Math.min(1, player.xp / player.xpNext),
        "#7ec8ff", "#2a5a8a"
    );

    drawIcon(ctx, "dash", x + 5, y + 38, 14, player.dashCooldown > 0 ? "#666" : COLORS.green);
    drawGradientBar(
        ctx, x + 26, y + 40, barWidth, 6,
        Math.max(0, 1 - player.dashCooldown / DASH_COOLDOWN),
        "#7dff8a", "#2a6a3a"
    );

    drawText(ctx, "LV " + player.level, x + 2, y + 62, 9, COLORS.text);
    drawText(ctx, "DMG " + player.damage, x + 66, y + 62, 9, "#7ec8ff");
    drawText(ctx, "RNG " + player.range, x + 136, y + 62, 9, "#c07bff");

    // ----- Picked upgrades row (bottom-left) -----

    const ups = player.pickedUpgrades || [];
    for (let i = 0; i < ups.length; i++) {
        drawIcon(ctx, upgradeIcon(ups[i]), 18 + i * 26, VIEW_HEIGHT - 34, 16, COLORS.gold);
    }
    if (ups.length > 0) {
        drawText(ctx, "GEAR", 18, VIEW_HEIGHT - 44, 7, COLORS.dim);
    }

    // ----- Top-center: boss health bar -----

    const boss = enemies.find((e) => e.type === "boss" && e.health > 0);
    if (boss) {
        const bw = 300;
        const bx = VIEW_WIDTH / 2 - bw / 2;
        const by = 12;

        drawPanel(ctx, bx - 8, by - 8, bw + 16, 32);

        drawText(ctx, "PALE KING", VIEW_WIDTH / 2, by + 2, 8, COLORS.gold, "center");
        drawGradientBar(
            ctx, bx, by + 12, bw, 10,
            Math.max(0, boss.health / boss.maxHealth),
            "#ff5a5a", "#6a1010"
        );
    }

    // ----- Right panel: score / wave / time -----

    const rx = VIEW_WIDTH - 216;
    drawPanel(ctx, rx, 6, 200, 68);

    drawText(ctx, "SCORE " + stats.score, VIEW_WIDTH - 16, 20, 12, COLORS.gold, "right");
    drawText(ctx, "WAVE " + Math.max(1, wave), VIEW_WIDTH - 16, 38, 9, COLORS.text, "right");

    const next = nextWaveCountdown();
    if (next) {
        drawText(ctx, next, VIEW_WIDTH - 16, 52, 7, "#7ec8ff", "right");
    }
    drawText(ctx, stats.kills + " KILLS", VIEW_WIDTH - 16, 66, 7, COLORS.dim, "right");
}

function nextWaveCountdown() {
    if (waveState === "break") {
        return "NEXT WAVE IN " + Math.ceil(waveTimer) + "s";
    }
    if (waveState === "clear") {
        return "PORTAL OPEN " + Math.ceil(waveTimer) + "s";
    }
    return "";
}

// ======================
// ANIMATED TITLE BACKDROP
// ======================

function drawEmbers(seedOffset) {
    if (Settings.reducedMotion) {
        return;
    }
    const count = 26;
    for (let i = 0; i < count; i++) {
        const phase = (i * 0.618) + gameTime * (0.4 + (i % 5) * 0.06);
        const x = ((i * 97 + phase * 40) % VIEW_WIDTH + VIEW_WIDTH) % VIEW_WIDTH;
        const y = VIEW_HEIGHT - ((phase * 30) % (VIEW_HEIGHT + 40)) + 20;
        const flicker = 0.4 + 0.6 * Math.abs(Math.sin(phase * 2.1 + seedOffset));

        ctx.globalAlpha = flicker * 0.5;
        ctx.fillStyle = i % 3 === 0 ? "#ff9d22" : "#ffd75a";
        ctx.fillRect(x, y, 3, 3);
    }
    ctx.globalAlpha = 1;
}

// ======================
// SCREENS
// ======================

export function drawOverlays() {
    if (gameState === "playing") {
        return;
    }

    ctx.fillStyle = "rgba(0, 0, 0, 0.75)";
    ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);

    ctx.textAlign = "center";

    if (gameState === "title") {
        drawEmbers(0);

        drawText(ctx, "DARK FANTASY", VIEW_WIDTH / 2, 118, 40, COLORS.text, "center");
        drawText(ctx, "Survive the waves. Slay the Pale King.", VIEW_WIDTH / 2, 150, 10, "#888", "center");

        if (highScore > 0) {
            drawText(ctx, "BEST " + highScore, VIEW_WIDTH / 2, 180, 10, COLORS.gold, "center");
        }

        if (currentPlayer) {
            drawText(ctx, "PLAYER: " + currentPlayer.username, VIEW_WIDTH / 2, 196, 9, "#7ec8ff", "center");
        }

        for (const button of uiButtons) {
            drawButton(button);
        }

        drawText(ctx, "WASD MOVE · SPACE ATTACK · P PAUSE · R RESTART", VIEW_WIDTH / 2, VIEW_HEIGHT - 24, 7, "#999", "center");
        return;
    }

    if (gameState === "settings") {
        drawEmbers(1);

        drawText(ctx, "SETTINGS", VIEW_WIDTH / 2, 110, 22, COLORS.gold, "center");

        for (const button of uiButtons) {
            drawButton(button);
        }

        drawText(ctx, "SETTINGS ARE SAVED AUTOMATICALLY", VIEW_WIDTH / 2, VIEW_HEIGHT - 40, 7, "#666", "center");
        return;
    }

    if (gameState === "levelup") {
        drawEmbers(2);

        drawText(ctx, "LEVEL UP", VIEW_WIDTH / 2, 100, 26, COLORS.gold, "center");
        drawText(ctx, "Choose an upgrade", VIEW_WIDTH / 2, 130, 9, "#ddd", "center");

        for (const button of uiButtons) {
            drawButton(button);
        }
        return;
    }

    if (gameState === "paused") {
        drawText(ctx, "PAUSED", VIEW_WIDTH / 2, 118, 28, COLORS.text, "center");
        drawText(ctx, "Wave " + Math.max(1, wave) + " · Score " + stats.score, VIEW_WIDTH / 2, 150, 9, "#ccc", "center");

        for (const button of uiButtons) {
            drawButton(button);
        }
        return;
    }

    if (gameState === "gameover") {
        drawEmbers(3);

        drawText(ctx, "GAME OVER", VIEW_WIDTH / 2, 84, 34, COLORS.red, "center");

        drawPanel(ctx, VIEW_WIDTH / 2 - 210, 100, 420, 150);
        drawStatsBreakdown(100);

        if (newHighScore) {
            const pulse = Settings.reducedMotion ? 1 : 0.7 + 0.3 * Math.sin(gameTime * 5);
            ctx.globalAlpha = pulse;
            drawText(ctx, "NEW HIGH SCORE!", VIEW_WIDTH / 2, 268, 12, COLORS.gold, "center");
            ctx.globalAlpha = 1;
        }

        for (const button of uiButtons) {
            drawButton(button);
        }
        return;
    }

    if (gameState === "victory") {
        drawEmbers(4);

        drawText(ctx, "VICTORY", VIEW_WIDTH / 2, 84, 34, COLORS.gold, "center");
        drawText(ctx, "The Pale King is dead. The darkness fades.", VIEW_WIDTH / 2, 118, 9, "#ddd", "center");

        drawPanel(ctx, VIEW_WIDTH / 2 - 210, 132, 420, 150);
        drawStatsBreakdown(132);

        if (newHighScore) {
            drawText(ctx, "NEW HIGH SCORE!", VIEW_WIDTH / 2, 298, 12, COLORS.gold, "center");
        }

        for (const button of uiButtons) {
            drawButton(button);
        }
    }
}

// Shared run-stats breakdown used by game-over and victory. Everything is
// positioned relative to the panel's top so it never overflows.
function drawStatsBreakdown(panelY) {
    const cx = VIEW_WIDTH / 2;
    const panelBottom = panelY + 150;

    drawText(ctx, "Score " + stats.score + " · Wave " + Math.max(1, wave), cx, panelY + 16, 9, COLORS.gold, "center");
    drawText(ctx, "Survived " + stats.survived.toFixed(1) + "s · Damage dealt " + stats.damageDealt, cx, panelY + 32, 7, "#ddd", "center");
    drawText(ctx, "Hits taken " + stats.hitsTaken + " · Kills " + stats.kills, cx, panelY + 46, 7, "#ddd", "center");

    // Kills by type (most lethal first)
    const byType = stats.byType || {};
    const rows = Object.keys(byType)
        .map((type) => ({ type: type, count: byType[type] }))
        .filter((r) => r.count > 0)
        .sort((a, b) => b.count - a.count)
        .slice(0, 4);

    if (rows.length === 0) {
        return;
    }

    const step = 14;
    const startY = panelY + 64;
    rows.forEach(function (row, i) {
        const y = startY + i * step;
        if (y > panelBottom - 8) {
            return;
        }
        const name = (ENEMY_TYPES[row.type] && ENEMY_TYPES[row.type].name) || row.type;
        ctx.textAlign = "left";
        drawText(ctx, name, cx - 170, y, 7, "#bbb", "left");
        ctx.textAlign = "right";
        drawText(ctx, String(row.count), cx + 170, y, 7, COLORS.gold, "right");
    });
}

// ======================
// CLICK HANDLER
// ======================

canvas.addEventListener("click", function (event) {
    const rect = canvas.getBoundingClientRect();

    const mouseX = (event.clientX - rect.left) * (VIEW_WIDTH / rect.width);
    const mouseY = (event.clientY - rect.top) * (VIEW_HEIGHT / rect.height);

    for (const button of uiButtons) {
        if (
            mouseX >= button.x &&
            mouseX <= button.x + button.w &&
            mouseY >= button.y &&
            mouseY <= button.y + button.h
        ) {
            button.action();
            return;
        }
    }
});
