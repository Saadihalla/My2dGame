import { test, expect } from "@playwright/test";
import { loginOffline, netState, startFightBot } from "./helpers";

// Full online co-op journey with two real browser clients:
// lobby create/join -> ready -> start -> match -> prediction ->
// remote interpolation -> kills -> wave advance -> ping -> reconnect.
test("two players co-op online: prediction, interpolation, reconnect", async ({ browser }) => {
    const context = await browser.newContext();
    const errors: string[] = [];

    async function newPage() {
        const page = await context.newPage();
        page.on("console", m => { if (m.type() === "error") errors.push(m.text()); });
        page.on("pageerror", e => errors.push(String(e)));
        await page.goto("/", { waitUntil: "domcontentloaded" });
        await loginOffline(page, "OnlineTester");
        return page;
    }

    const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

    // Host creates the lobby (retry on transient room-creation races)
    let host: any, guest: any, roomCode = "";
    for (let attempt = 0; attempt < 3; attempt++) {
        host = await newPage();
        await host.click(".online-button");
        await host.getByRole("button", { name: "CREATE ROOM" }).click();
        await host.getByRole("button", { name: "HOST ROOM" }).click();
        await host.waitForSelector(".lobby-code", { timeout: 15000 });
        roomCode = (await host.textContent(".lobby-code")).trim();

        guest = await newPage();
        await guest.click(".online-button");
        await guest.getByRole("button", { name: "JOIN ROOM" }).click();
        await guest.fill(".lobby-label input", roomCode);
        await guest.getByRole("button", { name: "JOIN", exact: true }).click();
        await guest.waitForSelector(".lobby-code", { timeout: 15000 });

        await guest.getByRole("button", { name: "READY", exact: true }).click();
        await host.waitForTimeout(1000);
        await host.getByRole("button", { name: "START MATCH" }).click();

        let ok = true;
        for (const page of [host, guest]) {
            try {
                await page.waitForSelector(".lobby-inmatch", { timeout: 20000 });
            } catch {
                ok = false;
            }
        }
        if (ok) break;
        await guest.close();
        await host.close();
    }
    expect(await host.isVisible(".lobby-inmatch")).toBeTruthy();

    // Both worlds see wave 1 + enemies (2-player scaling)
    let h = await netState(host);
    let g = await netState(guest);
    for (let i = 0; i < 60; i++) {
        h = await netState(host);
        g = await netState(guest);
        if (h.active && g.active && h.enemies > 0 && g.enemies > 0) break;
        await sleep(500);
    }
    expect(h.active && g.active).toBeTruthy();
    expect(h.enemies).toBeGreaterThan(0);
    expect(h.players.length).toBe(2);

    // Remote visibility: guest sees the host
    const hostId = h.localId;
    expect(g.players.some(p => p.id === hostId)).toBeTruthy();

    // Prediction: host moves right, predicted position follows
    await host.keyboard.down("d");
    await sleep(1200);
    await host.keyboard.up("d");
    const h2 = await netState(host);
    expect(h2.predicted.x).toBeGreaterThan(h.predicted.x + 50);

    // Interpolation: the guest's mirror of the host also moves
    const g3 = await netState(guest);
    const hostSeenByGuest = g3.players.find(p => p.id === hostId)!;
    expect(hostSeenByGuest.x).toBeGreaterThan(g.players.find(p => p.id === hostId)!.x + 20);

    // Both fight with held attack + chase bots
    await host.keyboard.down("Space");
    await guest.keyboard.down("Space");
    const stopHostBot = await startFightBot(host);
    const stopGuestBot = await startFightBot(guest);

    // Kills land and ping climbs
    let kills = 0;
    for (let i = 0; i < 80; i++) {
        await sleep(500);
        h = await netState(host);
        if (!h.active || !h.predicted) break;
        kills = h.predicted.kills;
        if (kills > 0 && h.pingMs > 0) break;
    }
    expect(kills).toBeGreaterThan(0);
    expect(h.pingMs).toBeGreaterThan(0);

    // Wave advances past 1
    let finalWave = h.wave;
    for (let i = 0; i < 120; i++) {
        await sleep(500);
        h = await netState(host);
        if (!h.active) break;
        finalWave = h.wave;
        if (finalWave >= 2) break;
    }
    expect(finalWave).toBeGreaterThanOrEqual(2);

    await host.keyboard.up("Space");
    await guest.keyboard.up("Space");
    await stopHostBot();
    await stopGuestBot();

    // Reconnect: kill the host's network briefly, then restore it — the
    // client should resume the same match via its reconnection token.
    await context.setOffline(true);
    await sleep(2500);
    await context.setOffline(false);

    let reconnected = false;
    for (let i = 0; i < 30; i++) {
        const st = await netState(host);
        if (st.active && st.wave === finalWave) { reconnected = true; break; }
        await sleep(1000);
    }
    expect(reconnected).toBeTruthy();

    // No unexpected console errors
    const fatal = errors.filter(e =>
        !e.includes("favicon") &&
        !e.includes("/api/auth/") &&
        !e.includes("Failed to load resource")
    );
    expect(fatal).toEqual([]);
});