import { Page, expect } from "@playwright/test";

// Opens the ACCOUNT canvas button and logs in via the offline
// localStorage fallback (no API running on the dev host).
export async function loginOffline(page: Page, username: string) {
    await page.waitForSelector("#gameCanvas", { timeout: 30000 });
    await page.waitForTimeout(1500);

    // Open the ACCOUNT canvas button; retry until the modal is visible
    // (the title screen can take a moment to boot).
    for (let i = 0; i < 20; i++) {
        await page.evaluate(() => {
            const canvas = document.getElementById("gameCanvas");
            const rect = canvas.getBoundingClientRect();
            canvas.dispatchEvent(new MouseEvent("click", {
                clientX: rect.left + (400 / 800) * rect.width,
                clientY: rect.top + (304 / 500) * rect.height,
                bubbles: true
            }));
        });
        const loggedIn = await page.isVisible("#authUserInfo").catch(() => false);
        const loggedOut = await page.isVisible("#authUsernameInput").catch(() => false);
        if (loggedIn || loggedOut) break;
        await page.waitForTimeout(500);
    }

    // Shared-context pages may already be logged in — skip auth then.
    if (await page.isVisible("#authUserInfo").catch(() => false)) {
        await page.click("#authCloseBtn");
        await page.waitForTimeout(300);
        return;
    }

    await expect(page.locator("#authUsernameInput")).toBeVisible();
    await page.fill("#authUsernameInput", username);
    await page.fill("#authPasswordInput", "password123");
    await page.click("#authRegisterBtn");
    await page.waitForTimeout(500);
    await page.fill("#authUsernameInput", username);
    await page.fill("#authPasswordInput", "password123");
    await page.click("#authLoginBtn");
    await page.waitForTimeout(500);
    await page.click("#authCloseBtn");
    await page.waitForTimeout(300);
}

// Reads the live net world state exposed by the dev debug handle.
export async function netState(page: Page) {
    return page.evaluate(() => {
        const w = (window as any).__net.netWorld;
        return {
            active: w.active,
            localId: w.localId,
            players: Array.from(w.players.values()).map(p => ({
                id: p.id, name: p.name, x: Math.round(p.x), y: Math.round(p.y),
                hp: Math.round(p.hp), alive: p.alive
            })),
            enemies: w.enemies.size,
            wave: w.wave,
            waveState: w.waveState,
            status: w.status,
            pingMs: Math.round(w.pingMs),
            predicted: w.predicted ? {
                x: Math.round(w.predicted.x), y: Math.round(w.predicted.y),
                hp: Math.round(w.predicted.hp), alive: w.predicted.alive,
                kills: w.predicted.kills
            } : null,
            ended: w.ended
        };
    });
}

// Page-level bot: chase the nearest enemy with diagonal movement;
// attack is held the whole time.
export function startFightBot(page: Page) {
    const held = new Set<string>();
    const releaseAll = async () => {
        for (const k of held) {
            await page.keyboard.up(k);
        }
        held.clear();
    };
    const bot = setInterval(async () => {
        try {
            const target = await page.evaluate(() => {
                const w = (window as any).__net.netWorld;
                if (!w.active || !w.predicted) return null;
                if (!w.predicted.alive) return { dead: true };
                const p = w.predicted;
                let best: any = null;
                let bestDst = Infinity;
                w.enemies.forEach((e: any) => {
                    const dst = Math.hypot(e.x - p.x, e.y - p.y);
                    if (dst < bestDst) { bestDst = dst; best = e; }
                });
                if (!best) return null;
                return { dx: best.x - p.x, dy: best.y - p.y, dead: false };
            });
            if (!target) return;
            const wanted = new Set<string>();
            if (!target.dead) {
                if (target.dx >= 0) wanted.add("d"); else wanted.add("a");
                if (target.dy >= 0) wanted.add("s"); else wanted.add("w");
            }
            for (const k of held) {
                if (!wanted.has(k)) { await page.keyboard.up(k); held.delete(k); }
            }
            for (const k of wanted) {
                if (!held.has(k)) { await page.keyboard.down(k); held.add(k); }
            }
        } catch {
            // page closed
        }
    }, 400);
    return async () => {
        clearInterval(bot);
        await releaseAll();
    };
}