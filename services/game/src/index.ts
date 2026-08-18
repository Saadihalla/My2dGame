import http from "http";
import express from "express";
import cors from "cors";
import { Server } from "@colyseus/core";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { LobbyRoom } from "./rooms/LobbyRoom.js";
import { GameRoom } from "./rooms/GameRoom.js";

const port = Number(process.env.PORT) || 2567;
const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
    res.json({ status: "Dark Fantasy Game Server online", timestamp: Date.now() });
});

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