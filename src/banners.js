// ======================
// BANNERS (wave announcements, level-ups)
// Slide/fade in with easing, fade out. Honors reduced-motion.
// ======================

import { ctx, VIEW_WIDTH } from "./config.js";
import { drawPanel, drawText, Settings } from "./theme.js";
import { tweenProgress, easeOutBack } from "./logic/tween.js";

let banners = [];

export function showBanner(text, sub, duration) {
    banners.push({
        text: text,
        sub: sub || "",
        timer: duration || 2.5,
        max: duration || 2.5,
        slide: 0,
        active: true
    });

    if (banners.length > 3) {
        banners.shift();
    }
}

export function updateBanners(dt) {
    for (let i = banners.length - 1; i >= 0; i--) {
        const banner = banners[i];
        banner.timer -= dt;
        banner.slide += dt;

        if (banner.timer <= 0) {
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
        const fadeIn = tweenProgress(banner.slide, 0.35);
        const fadeOut = Math.min(1, banner.timer / 0.4);

        const eased = Settings.reducedMotion ? 1 : easeOutBack(fadeIn);
        const offset = (1 - eased) * -46;

        ctx.save();
        ctx.globalAlpha = Math.min(1, fadeIn) * fadeOut;

        drawPanel(ctx, VIEW_WIDTH / 2 - 170, y - 34 + offset, 340, 54);

        drawText(ctx, banner.text, VIEW_WIDTH / 2, y + offset, 15, "#ffffff", "center");

        if (banner.sub) {
            drawText(ctx, banner.sub, VIEW_WIDTH / 2, y + 22 + offset, 8, "#dddddd", "center");
        }

        ctx.restore();

        y += banner.sub ? 74 : 58;
    }
}
