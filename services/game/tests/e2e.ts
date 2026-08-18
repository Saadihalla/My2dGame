// ======================
// GAME SERVER E2E — simulated clients in a co-op match
// Spins up the Colyseus server in-process, then drives a host + guest
// through: lobby create -> join by code -> ready -> host start ->
// gameStart handoff -> join match -> movement -> bot combat -> kills ->
// wave scaling -> casters/projectiles -> ping -> gameover matchEnd.
// The E2E clients act as simple bots (chase nearest enemy, retreat when
// hurt) — deterministic enough for CI and a preview of Phase 3 bots.
// ======================

import http from "http";
import express from "express";
import { Server } from "@colyseus/core";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { Client } from "colyseus.js";
import assert from "node:assert";
import { LobbyRoom } from "../src/rooms/LobbyRoom.js";
import { GameRoom } from "../src/rooms/GameRoom.js";

const BASE_PORT = 2577;
const URL = (port: number) => `ws://localhost:${port}`;

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Resolves once the initial state snapshot has arrived for a room.
function onFirstState(room: any): Promise<void> {
    return new Promise(resolve => {
        if (room.state && room.state.players && room.state.players.size > 0) {
            resolve();
            return;
        }
        room.onStateChange.once(() => resolve());
    });
}

// Polls the room state until the predicate passes (or times out).
async function waitFor(room: any, predicate: (state: any) => boolean, timeoutMs = 10000): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    while (!predicate(room.state)) {
        if (Date.now() > deadline) {
            throw new Error("waitFor timed out");
        }
        await sleep(100);
    }
}

// Chase bot: run at the nearest enemy and swing; dash to close in.
// With the co-op balance (bonus HP, regen, longer arc) this clears
// waves reliably — and it previews Phase 3 server bots.
function startSweeper(room: any) {
    const timer = setInterval(() => {
        const state = room.state;
        if (!state || state.status !== "playing") {
            return;
        }

        const me = state.players.get(room.sessionId);
        if (!me || !me.alive) {
            return;
        }

        let nearest: any = null;
        let minDst = Infinity;

        state.enemies.forEach((e: any) => {
            const dst = Math.hypot(e.x - me.x, e.y - me.y);
            if (dst < minDst) {
                minDst = dst;
                nearest = e;
            }
        });

        if (!nearest) {
            return;
        }

        const dx = nearest.x - me.x;
        const dy = nearest.y - me.y;
        const len = Math.hypot(dx, dy) || 1;

        // Fight normally; emergency retreat + dash only at the last
        // moment so regen + level-up heals can recover the bot.
        const retreating = me.hp < 25;

        room.send("input", {
            vx: retreating ? -dx / len : dx / len,
            vy: retreating ? -dy / len : dy / len,
            dash: (minDst < 160 || retreating) && me.dashCooldown <= 0,
            attack: true
        });
    }, 500);

    return () => clearInterval(timer);
}

async function main() {
    // The bot-driven combat section has run-to-run variance (bots can
    // be overwhelmed at wave 2). Retry the whole flow once with fresh
    // rooms — the infrastructure checks are deterministic.
    try {
        await runMatch(BASE_PORT);
    } catch (err) {
        console.log("FIRST ATTEMPT FAILED:", err instanceof Error ? err.message : err);
        console.log("RETRYING with a fresh match...");
        await runMatch(BASE_PORT + 1);
    }
}

async function runMatch(port: number) {
    const app = express();
    const server = http.createServer(app);
    const gameServer = new Server({
        server,
        transport: new WebSocketTransport({ server })
    });
    gameServer.define("lobby", LobbyRoom);
    gameServer.define("game", GameRoom);
    await gameServer.listen(port);

    // 1. Host creates a lobby; roomId IS the join code
    const host = new Client(URL(port));
    const hostLobby = await host.create("lobby", { username: "Host" });
    await onFirstState(hostLobby);
    assert.strictEqual(hostLobby.state.players.size, 1);
    const hostPlayer = hostLobby.state.players.get(hostLobby.sessionId);
    assert(hostPlayer, "host should be in the lobby");
    assert.strictEqual(hostPlayer.isHost, true, "first joiner is host");

    // 2. Guest joins by code and readies up
    const guest = new Client(URL(port));
    const guestLobby = await guest.joinById(hostLobby.roomId, { username: "Guest" });
    await onFirstState(guestLobby);
    assert.strictEqual(guestLobby.state.players.size, 2);

    guestLobby.send("ready", true);
    await sleep(250);
    assert.strictEqual(guestLobby.state.players.get(guestLobby.sessionId).ready, true);

    // 3. Host starts -> both clients get the game room id
    const hostStart = new Promise<any>(resolve => hostLobby.onMessage("gameStart", resolve));
    const guestStart = new Promise<any>(resolve => guestLobby.onMessage("gameStart", resolve));
    hostLobby.send("start");
    const [hostHandoff, guestHandoff] = await Promise.all([hostStart, guestStart]);
    assert.strictEqual(hostHandoff.roomId, guestHandoff.roomId, "same game room for everyone");

    // 4. Both join the match room
    const hostGame = await host.joinById(hostHandoff.roomId, { username: "Host" });
    const guestGame = await guest.joinById(guestHandoff.roomId, { username: "Guest" });
    await waitFor(hostGame, state => state.players.size === 2, 5000);
    await waitFor(guestGame, state => state.players.size === 2, 5000);

    // matchEnd is broadcast once when the match concludes (victory/gameover)
    let matchEndResult: any = null;
    const matchEnd = new Promise<any>(resolve => hostGame.onMessage("matchEnd", resolve));

    // 5. Wave 1 spawns with 2-player scaling (base 3 + 0.4 share = 4 enemies)
    await waitFor(hostGame, state => state.enemies.size >= 4, 25000);
    assert.strictEqual(hostGame.state.wave, 1, "wave 1 active");
    assert(hostGame.state.serverTime > 0, "serverTime streams for interpolation");

    // 6. Host moves right via input before the bots take over
    const before = hostGame.state.players.get(hostGame.sessionId).x;
    hostGame.send("input", { vx: 1, vy: 0, dash: false, attack: false });
    await sleep(800);
    const after = hostGame.state.players.get(hostGame.sessionId).x;
    assert(after > before, `host moved right (${before} -> ${after})`);

    // 7. Sweepers fight: kills land and waves advance
    const stopHostSweeper = startSweeper(hostGame);
    const stopGuestSweeper = startSweeper(guestGame);
    await waitFor(hostGame, state => state.players.get(hostGame.sessionId).kills > 0, 25000);
    assert(hostGame.state.players.get(hostGame.sessionId).score > 0, "kill awarded score");

    // 8. Wave advances; by wave 3 casters spawn projectiles
    try {
        await waitFor(hostGame, state => state.wave >= 3, 150000);
    } catch {
        const s = hostGame.state;
        const me = s.players.get(hostGame.sessionId);
        const gm = s.players.get(guestGame.sessionId);
        console.log("WAVE DIAG:", JSON.stringify({
            status: s.status, wave: s.wave, waveState: s.waveState, enemies: s.enemies.size,
            host: me && { hp: Math.round(me.hp), alive: me.alive, kills: me.kills, level: me.level },
            guest: gm && { hp: Math.round(gm.hp), alive: gm.alive, kills: gm.kills, level: gm.level }
        }));
        throw new Error("waves stalled before 3");
    }
    await waitFor(hostGame, state => state.projectiles.size > 0, 20000);
    assert(hostGame.state.projectiles.size > 0, "caster projectiles stream");

    // 9. Ping round-trip works
    const pong = new Promise<number>(resolve => hostGame.onMessage("pong", t => resolve(t)));
    hostGame.send("ping", 4242);
    assert.strictEqual(await pong, 4242, "server echoes ping timestamps");

    // 10. Stop fighting: either the match already ended in victory, or
    // the remaining enemies kill both players -> gameover. Accept both.
    stopHostSweeper();
    stopGuestSweeper();
    hostGame.send("input", { vx: 0, vy: 0, dash: false, attack: false });
    guestGame.send("input", { vx: 0, vy: 0, dash: false, attack: false });
    try {
        await waitFor(hostGame, state => state.status === "gameover" || state.status === "victory", 60000);
    } catch {
        const s = hostGame.state;
        console.log("END DIAG:", JSON.stringify({
            status: s.status, wave: s.wave, waveState: s.waveState, enemies: s.enemies.size,
            players: Array.from(s.players.values()).map((p: any) => ({ name: p.username, hp: Math.round(p.hp), alive: p.alive, kills: p.kills }))
        }));
        throw new Error("match never ended");
    }
    const result = await matchEnd;
    assert(["gameover", "victory"].includes(result.status), `matchEnd status: ${result.status}`);
    assert.strictEqual(result.results.length, 2, "results include both players");
    assert(result.results.some((r: any) => r.sessionId === hostGame.sessionId), "host stats present");

    await hostGame.leave();
    await guestGame.leave();
    await hostLobby.leave();
    await guestLobby.leave();

    console.log("E2E PASSED: lobby -> match -> movement -> bot kills -> scaling -> projectiles -> ping -> gameover");
    process.exit(0);
}

main().catch(err => {
    console.error("E2E FAILED:", err);
    process.exit(1);
});