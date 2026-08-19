import http from "http";
import express from "express";
import cors from "cors";
import { Server, matchMaker } from "@colyseus/core";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { LobbyRoom } from "./rooms/LobbyRoom.js";
import { GameRoom } from "./rooms/GameRoom.js";

const port = Number(process.env.PORT) || 2567;
const DEBUG_ENABLED = process.env.GAME_DEBUG === "1";

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
    res.json({ status: "Dark Fantasy Game Server online", timestamp: Date.now() });
});

// Debug endpoints — only registered when GAME_DEBUG=1.
// These are NEVER available in production (Railway doesn't set GAME_DEBUG).
if (DEBUG_ENABLED) {
    // GET /debug/rooms — list all active game + lobby rooms.
    app.get("/debug/rooms", async (_req, res) => {
        try {
            const rooms = await matchMaker.query({ name: "game" });
            const lobbyRooms = await matchMaker.query({ name: "lobby" });
            res.json({
                game: rooms.map(r => ({ roomId: r.roomId, clients: r.clients, maxClients: r.maxClients })),
                lobby: lobbyRooms.map(r => ({ roomId: r.roomId, clients: r.clients }))
            });
        } catch (err) {
            res.status(500).json({ error: String(err) });
        }
    });

    // POST /debug/rooms/:roomId/:op — dispatch a debug op to a game room.
    // Body fields are forwarded to the room's debug method.
    // Supported ops: wave, hp, bots, end, latency, freeze
    app.post("/debug/rooms/:roomId/:op", async (req, res) => {
        const { roomId, op } = req.params;
        try {
            const room = await matchMaker.getRoomById(roomId) as GameRoom | undefined;
            if (!room || room.roomName !== "game") {
                res.status(404).json({ error: "game room not found" });
                return;
            }
            const body = req.body as Record<string, unknown>;
            switch (op) {
                case "wave":
                    room.debugSpawnWave(Number(body.n) || 1);
                    break;
                case "hp":
                    room.debugSetHp(String(body.sessionId || ""), Number(body.hp) || 0);
                    break;
                case "bots":
                    room.debugSpawnBots(Number(body.count) || 1);
                    break;
                case "end":
                    room.debugEndMatch(body.status === "victory" ? "victory" : "gameover");
                    break;
                case "latency":
                    room.debugSetLatency(Number(body.ms) || 0);
                    break;
                case "freeze":
                    room.debugFreeze(!!body.on);
                    break;
                default:
                    res.status(400).json({ error: `unknown op: ${op}` });
                    return;
            }
            res.json({ ok: true, roomId, op });
        } catch (err) {
            res.status(500).json({ error: String(err) });
        }
    });

    console.log("[Debug] /debug/* endpoints enabled (GAME_DEBUG=1)");
}

const server = http.createServer(app);
const gameServer = new Server({
    server,
    transport: new WebSocketTransport({ server })
});

gameServer.define("lobby", LobbyRoom);
gameServer.define("game", GameRoom);

gameServer.listen(port).then(() => {
    console.log(`[Dark Fantasy Game Server] listening on ws://localhost:${port}`);
});