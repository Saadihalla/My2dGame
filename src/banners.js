// ======================
// BANNERS (wave announcements, level-ups)
// ======================

import { ctx, VIEW_WIDTH } from "./config.js";

let banners = [];

export function showBanner(text, sub, duration) {
    banners.push({
        text: text,
        sub: sub || "",
        timer: duration || 2.5,
        max: duration || 2.5
    });

    if (banners.length > 3) {
        banners.shift();
    }
}

export function updateBanners(dt) {
    for (let i = banners.length - 1; i >= 0; i--) {
        banners[i].timer -= dt;

        if (banners[i].timer <= 0) {
            banners.splice(i, 1);
        }
    }
}

export function clearBanners() {
    banners.length = 0;
}

export function drawBanners() {
    let y = 96;

    for (const banner of banners) {
        const alpha = Math.min(1, banner.timer / 0.4);

        ctx.globalAlpha = alpha;

        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 34px Georgia, serif";
        ctx.textAlign = "center";

        ctx.fillText(banner.text, VIEW_WIDTH / 2, y);

        if (banner.sub) {
            ctx.fillStyle = "#dddddd";
            ctx.font = "16px Arial";
            ctx.fillText(banner.sub, VIEW_WIDTH / 2, y + 24);
        }

        y += banner.sub ? 62 : 46;
    }

    ctx.globalAlpha = 1;
}