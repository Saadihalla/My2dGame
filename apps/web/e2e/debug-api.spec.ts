import { test, expect } from "@playwright/test";

// Exercises the window.__game debug surface: state snapshots, control
// mutations, input synthesis, canvas-button clicks, and waiters.
test("window.__game debug API drives everything", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.waitForSelector("#gameCanvas", { timeout: 30000 });
    await page.waitForTimeout(1500);

    // API attached in dev
    expect(await page.evaluate(() => !!(window as any).__game)).toBeTruthy();

    // state() snapshot shape
    const s0 = await page.evaluate(() => (window as any).__game.state());
    expect(s0.player.health).toBe(100);
    expect(s0.wave.number).toBe(1);

    // Canvas buttons are exposed
    const btns = await page.evaluate(() => (window as any).__game.ui.buttons());
    expect(btns.map((b: any) => b.label)).toEqual(expect.arrayContaining(["START", "ACCOUNT", "SETTINGS"]));

    // control.start() bypasses the placeholder gate and begins a run
    await page.evaluate(() => (window as any).__game.control.start());
    await page.waitForTimeout(900);
    const s1 = await page.evaluate(() => (window as any).__game.state());
    expect(s1.state).toBe("playing");
    expect(s1.wave.number).toBe(1);

    // control: wave + spawn + godMode + freeze
    await page.evaluate(() => {
        const g = (window as any).__game;
        g.control.godMode(true);
        g.control.freezeEnemies(true);
        g.control.setWave(5);
        g.control.spawnEnemy("boss", 300, 200);
    });
    await page.waitForTimeout(1200);
    const s2 = await page.evaluate(() => (window as any).__game.state());
    expect(s2.wave.number).toBe(5);
    expect(s2.wave.state).toBe("active");
    expect(s2.enemies.list.some((e: any) => e.type === "boss")).toBeTruthy();
    expect(s2.player.invuln).toBeGreaterThan(60);

    // input synthesis: move + attack + dash through the real pipeline
    const xBefore = s2.player.x;
    await page.evaluate(() => {
        const g = (window as any).__game;
        g.input.move(1, 0);
        g.input.attack(true);
        g.input.dash();
    });
    await page.waitForTimeout(300);
    const s3 = await page.evaluate(() => (window as any).__game.state());
    expect(s3.player.x).toBeGreaterThan(xBefore);
    expect(s3.player.dashCooldown).toBeGreaterThan(0);

    // frozen enemies hold position
    const fA = await page.evaluate(() => (window as any).__game.state().enemies.list[0]);
    await page.waitForTimeout(1200);
    const fB = await page.evaluate(() => (window as any).__game.state().enemies.list[0]);
    expect(fA && fB && fA.x === fB.x && fA.y === fB.y).toBeTruthy();

    // when() waiter resolves on a state condition
    await page.evaluate(() => (window as any).__game.control.setHp(50));
    expect(await page.evaluate(() => (window as any).__game.when((s: any) => s.player.health === 50, 2000)))
        .toBeTruthy();

    // teleport + killAllEnemies (clear held input first)
    await page.evaluate(() => {
        const g = (window as any).__game;
        g.input.clear();
        g.control.teleport(700, 700);
        g.control.killAllEnemies();
    });
    await page.waitForTimeout(600);
    const s4 = await page.evaluate(() => (window as any).__game.state());
    expect(s4.player.x).toBe(700);
    expect(s4.player.y).toBe(700);
    expect(s4.enemies.count).toBe(0);

    // df:game events fire on mutations
    const eventSeen = await page.evaluate(() => new Promise(resolve => {
        const t = setTimeout(() => resolve(false), 2000);
        window.addEventListener("df:game", () => { clearTimeout(t); resolve(true); }, { once: true });
        (window as any).__game.control.heal();
    }));
    expect(eventSeen).toBeTruthy();

    // ?debug=1 also enables the API
    await page.goto("/?debug=1", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1500);
    expect(await page.evaluate(() => !!(window as any).__game)).toBeTruthy();
});