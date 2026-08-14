// ======================
// UI (HUD, banners, screens, buttons)
// ======================

import { canvas, ctx, VIEW_WIDTH, VIEW_HEIGHT } from "./config.js";
import { gameState, stats, wave, highScore, newHighScore } from "./state.js";
import { player } from "./entities.js";

let uiButtons = [];

export function setButtons(list) {
    uiButtons = list;
}

export function makeButton(label, action, y) {
    return {
        x: VIEW_WIDTH / 2 - 100,
        y: y,
        w: 200,
        h: 48,
        label: label,
        action: action
    };
}

function drawButton(button) {
    ctx.fillStyle = "#3498db";
    ctx.fillRect(button.x, button.y, button.w, button.h);

    ctx.strokeStyle = "rgba(255, 255, 255, 0.6)";
    ctx.strokeRect(button.x, button.y, button.w, button.h);

    ctx.fillStyle = "white";
    ctx.font = "bold 20px Arial";
    ctx.textAlign = "center";

    ctx.fillText(button.label, button.x + button.w / 2, button.y + button.h / 2 + 7);
}

// ======================
// HUD
// ======================

export function drawHUD() {
    const barWidth = 200;
    const barHeight = 16;

    const x = 20;
    const y = 20;

    ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
    ctx.fillRect(x - 6, y - 6, barWidth + 12, 56);

    // Health

    ctx.fillStyle = "darkred";
    ctx.fillRect(x, y, barWidth, barHeight);

    ctx.fillStyle = "lime";
    ctx.fillRect(x, y, barWidth * Math.max(0, player.health / player.maxHealth), barHeight);

    ctx.strokeStyle = "rgba(255, 255, 255, 0.7)";
    ctx.strokeRect(x, y, barWidth, barHeight);

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 11px Arial";
    ctx.textAlign = "left";
    ctx.fillText(
        "HP " + Math.max(0, Math.ceil(player.health)) + "/" + player.maxHealth,
        x + 4,
        y + 13
    );

    // XP

    ctx.fillStyle = "#1a3a5a";
    ctx.fillRect(x, y + 22, barWidth, 8);

    ctx.fillStyle = "#4a9fe8";
    ctx.fillRect(x, y + 22, barWidth * Math.min(1, player.xp / player.xpNext), 8);

    ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
    ctx.font = "11px Arial";
    ctx.fillText("LV " + player.level, x + 2, y + 46);

    ctx.fillStyle = "#7ec8ff";
    ctx.fillText("DMG " + player.damage + " · RNG " + player.range, x + 60, y + 46);

    // Stats (top-right)

    ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
    ctx.fillRect(VIEW_WIDTH - 216, 14, 200, 62);

    ctx.textAlign = "right";

    ctx.fillStyle = "#ffd75a";
    ctx.font = "bold 18px Georgia, serif";
    ctx.fillText("SCORE " + stats.score, VIEW_WIDTH - 16, 34);

    ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
    ctx.font = "13px Arial";
    ctx.fillText(
        "WAVE " + Math.max(1, wave) + " · KILLS " + stats.kills,
        VIEW_WIDTH - 16,
        52
    );

    ctx.fillStyle = "rgba(255, 255, 255, 0.55)";
    ctx.font = "12px Arial";
    ctx.fillText(
        stats.survived.toFixed(1) + "s · BEST " + highScore,
        VIEW_WIDTH - 16,
        68
    );
}

// ======================
// SCREENS
// ======================

export function drawOverlays() {
    if (gameState === "playing") {
        return;
    }

    ctx.fillStyle = "rgba(0, 0, 0, 0.72)";
    ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);

    ctx.textAlign = "center";

    if (gameState === "title") {

        ctx.fillStyle = "#e6e6e6";
        ctx.font = "bold 64px Georgia, serif";
        ctx.fillText("DARK FANTASY", VIEW_WIDTH / 2, 130);

        ctx.fillStyle = "#888888";
        ctx.font = "18px Arial";
        ctx.fillText("Survive the waves. Slay the Pale King.", VIEW_WIDTH / 2, 165);

        if (highScore > 0) {
            ctx.fillStyle = "#ffd75a";
            ctx.font = "bold 18px Arial";
            ctx.fillText("BEST SCORE " + highScore, VIEW_WIDTH / 2, 200);
        }

        ctx.fillStyle = "#bbbbbb";
        ctx.font = "14px Arial";
        ctx.fillText("WASD move · SPACE attack · P pause · R restart", VIEW_WIDTH / 2, 380);

        for (const button of uiButtons) {
            drawButton(button);
        }

        return;
    }

    if (gameState === "paused") {

        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 48px Georgia, serif";
        ctx.fillText("PAUSED", VIEW_WIDTH / 2, 130);

        ctx.fillStyle = "#cccccc";
        ctx.font = "16px Arial";
        ctx.fillText("Wave " + Math.max(1, wave) + " · Score " + stats.score, VIEW_WIDTH / 2, 160);

        for (const button of uiButtons) { drawButton(button); }

        return;
    }

    if (gameState === "gameover") {

        ctx.fillStyle = "#ff5a5a";
        ctx.font = "bold 60px Georgia, serif";
        ctx.fillText("GAME OVER", VIEW_WIDTH / 2, 120);

        ctx.fillStyle = "#cccccc";
        ctx.font = "18px Arial";
        ctx.fillText(
            "Score " + stats.score + " · Wave " + Math.max(1, wave) +
            " · Kills " + stats.kills,
            VIEW_WIDTH / 2,
            155
        );

        ctx.fillStyle = "#aaaaaa";
        ctx.font = "15px Arial";
        ctx.fillText(
            "Survived " + stats.survived.toFixed(1) + "s · " + stats.hitsTaken +
            " hits taken",
            VIEW_WIDTH / 2,
            180
        );

        if (newHighScore) {
            ctx.fillStyle = "#ffd75a";
            ctx.font = "bold 22px Arial";
            ctx.fillText("★ NEW HIGH SCORE ★", VIEW_WIDTH / 2, 215);
        } else {
            ctx.fillStyle = "#ffd75a";
            ctx.font = "16px Arial";
            ctx.fillText("Best " + highScore, VIEW_WIDTH / 2, 215);
        }

        for (const button of uiButtons) { drawButton(button); }

        return;
    }

    if (gameState === "victory") {

        ctx.fillStyle = "#ffd75a";
        ctx.font = "bold 60px Georgia, serif";
        ctx.fillText("VICTORY", VIEW_WIDTH / 2, 120);

        ctx.fillStyle = "#dddddd";
        ctx.font = "18px Arial";
        ctx.fillText("The Pale King is dead. The darkness fades.", VIEW_WIDTH / 2, 155);

        ctx.fillStyle = "#ffd75a";
        ctx.font = "bold 24px Arial";
        ctx.fillText("Score " + stats.score, VIEW_WIDTH / 2, 195);

        ctx.fillStyle = "#bbbbbb";
        ctx.font = "15px Arial";
        ctx.fillText(
            "Waves " + Math.max(1, wave) + " · Kills " + stats.kills +
            " · Survived " + stats.survived.toFixed(1) + "s",
            VIEW_WIDTH / 2,
            220
        );

        if (newHighScore) {
            ctx.fillStyle = "#ffd75a";
            ctx.font = "bold 22px Arial";
            ctx.fillText("★ NEW HIGH SCORE ★", VIEW_WIDTH / 2, 250);
        }

        for (const button of uiButtons) { drawButton(button); }
    }
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