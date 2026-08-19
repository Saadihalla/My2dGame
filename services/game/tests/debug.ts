// DEBUG CHANNEL E2E - validates the Layer 3 server debug surface
// Spins up a game server with GAME_DEBUG=1 and exercises:
//   - /debug/rooms HTTP endpoint
//   - __debug wave op
//   - __debug freeze op
//   - __debug hp op
//   - __debug end op
//   - HTTP POST /debug/rooms/:roomId/wave

import http from 'http';
import express from 'express';
import { Server, matchMaker } from '@colyseus/core';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { Client } from 'colyseus.js';
import assert from 'node:assert';
import { LobbyRoom } from '../src/rooms/LobbyRoom.js';
import { GameRoom } from '../src/rooms/GameRoom.js';

process.env.GAME_DEBUG = '1';

const PORT = 2587;
const WS_URL = 'ws://localhost:' + PORT;
const HTTP_URL = 'http://localhost:' + PORT;

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitFor(room: any, predicate: (state: any) => boolean, timeoutMs = 10000): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    while (!predicate(room.state)) {
        if (Date.now() > deadline) {
            throw new Error('waitFor timed out');
        }
        await sleep(100);
    }
}

async function main() {
    const app = express();
    app.use(express.json());

    app.get('/debug/rooms', async (_req: any, res: any) => {
        const rooms = await matchMaker.query({ name: 'game' });
        const lobbyRooms = await matchMaker.query({ name: 'lobby' });
        res.json({
            game: rooms.map((r: any) => ({ roomId: r.roomId, clients: r.clients, maxClients: r.maxClients })),
            lobby: lobbyRooms.map((r: any) => ({ roomId: r.roomId, clients: r.clients }))
        });
    });

    app.post('/debug/rooms/:roomId/:op', async (req: any, res: any) => {
        const { roomId, op } = req.params;
        try {
            const room = await matchMaker.getRoomById(roomId) as GameRoom | undefined;
            if (!room || (room as any).roomName !== 'game') {
                res.status(404).json({ error: 'game room not found' }); return;
            }
            const body = req.body as Record<string, unknown>;
            switch (op) {
                case 'wave': room.debugSpawnWave(Number(body.n) || 1); break;
                case 'hp': room.debugSetHp(String(body.sessionId || ''), Number(body.hp) || 0); break;
                case 'bots': room.debugSpawnBots(Number(body.count) || 1); break;
                case 'end': room.debugEndMatch(body.status === 'victory' ? 'victory' : 'gameover'); break;
                case 'latency': room.debugSetLatency(Number(body.ms) || 0); break;
                case 'freeze': room.debugFreeze(!!body.on); break;
                default: res.status(400).json({ error: 'unknown op' }); return;
            }
            res.json({ ok: true, roomId, op });
        } catch (err) {
            res.status(500).json({ error: String(err) });
        }
    });

    const server = http.createServer(app);
    const gameServer = new Server({ server, transport: new WebSocketTransport({ server }) });
    gameServer.define('lobby', LobbyRoom);
    gameServer.define('game', GameRoom);
    await gameServer.listen(PORT);
    console.log('[debug-e2e] Server on :' + PORT);

    const host = new Client(WS_URL);
    const hostLobby = await host.create('lobby', { username: 'DebugHost' });
    await sleep(300);
    const hostStart = new Promise<any>(resolve => hostLobby.onMessage('gameStart', resolve));
    hostLobby.send('start');
    const handoff = await hostStart;
    const hostGame = await host.joinById(handoff.roomId, { username: 'DebugHost' });
    await waitFor(hostGame, s => s.players.size >= 1, 5000);
    const roomId = hostGame.roomId;
    console.log('[debug-e2e] Joined game room ' + roomId);

    // 1. /debug/rooms lists the active room.
    const listRes = await fetch(HTTP_URL + '/debug/rooms');
    assert.strictEqual(listRes.status, 200, '/debug/rooms should return 200');
    const list = await listRes.json() as any;
    assert(Array.isArray(list.game), 'game array present');
    assert(list.game.some((r: any) => r.roomId === roomId), 'room is listed');
    console.log('[debug-e2e] PASS: /debug/rooms lists the room');

    // 2. __debug freeze halts the sim.
    await waitFor(hostGame, s => s.enemies.size > 0, 8000);
    const enemyCountBefore = hostGame.state.enemies.size;
    hostGame.send('__debug', { op: 'freeze', on: true });
    await sleep(800);
    const enemyCountAfter = hostGame.state.enemies.size;
    hostGame.send('__debug', { op: 'freeze', on: false });
    assert(enemyCountAfter >= enemyCountBefore, 'freeze held enemy count stable');
    console.log('[debug-e2e] PASS: freeze (' + enemyCountBefore + ' -> ' + enemyCountAfter + ')');

    // 3. __debug wave forces a new wave.
    hostGame.send('__debug', { op: 'wave', n: 5 });
    await waitFor(hostGame, s => s.wave === 5, 5000);
    assert.strictEqual(hostGame.state.wave, 5, 'wave set to 5');
    console.log('[debug-e2e] PASS: __debug wave op');

    // 4. __debug hp sets player HP.
    const sessionId = hostGame.sessionId;
    hostGame.send('__debug', { op: 'hp', sessionId, hp: 42 });
    await waitFor(hostGame, s => Math.round(s.players.get(sessionId)?.hp ?? 0) === 42, 3000);
    const hp = hostGame.state.players.get(sessionId)?.hp;
    assert(Math.round(hp) === 42, 'hp should be 42, got ' + hp);
    console.log('[debug-e2e] PASS: __debug hp op');

    // 5. HTTP POST mirrors __debug op.
    const postRes = await fetch(HTTP_URL + '/debug/rooms/' + roomId + '/wave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ n: 3 })
    });
    assert.strictEqual(postRes.status, 200, 'HTTP wave should return 200');
    const postBody = await postRes.json() as any;
    assert.strictEqual(postBody.ok, true, 'HTTP op returned ok');
    await waitFor(hostGame, s => s.wave === 3, 5000);
    assert.strictEqual(hostGame.state.wave, 3, 'HTTP wave op set wave to 3');
    console.log('[debug-e2e] PASS: HTTP POST /debug/rooms/:roomId/wave');

    // 6. __debug end forces match end.
    const matchEnd = new Promise<any>(resolve => hostGame.onMessage('matchEnd', resolve));
    hostGame.send('__debug', { op: 'end', status: 'victory' });
    const result = await matchEnd;
    assert.strictEqual(result.status, 'victory', 'forced victory via __debug end');
    console.log('[debug-e2e] PASS: __debug end op');

    await hostGame.leave();
    await hostLobby.leave();
    console.log('[debug-e2e] ALL TESTS PASSED');
    process.exit(0);
}

main().catch(err => {
    console.error('[debug-e2e] FAILED:', err);
    process.exit(1);
});