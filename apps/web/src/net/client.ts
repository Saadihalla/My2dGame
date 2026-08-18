// ======================
// NETWORKING (Colyseus client)
// Wraps the game-server connection, lobby + game rooms, and exposes a
// plain NetState snapshot to React via the "df:net" window event.
// The game room stream feeds net/world (prediction + interpolation).
// ======================

import { Client, Room } from "colyseus.js";
import {
    activateNetWorld,
    deactivateNetWorld,
    ingestNetState,
    ingestMatchEnd,
    netWorld,
    type MatchEndInfo
} from "./world";
import { startPing, stopPing } from "./ping";
// inputSync is imported lazily inside bindGameRoom: it pulls in
// game/input -> game/config which touches the canvas at module load,
// and the net layer must load before React mounts it.

// Game server base URL. Set VITE_GAME_URL to the deployed Colyseus
// service (e.g. wss://game.your-game.up.railway.app). Empty = localhost.
const GAME_SERVER_URL: string =
    (import.meta.env.VITE_GAME_URL as string | undefined) || "ws://localhost:2567";

// React bridge: window event fired on every network-state change.
export const NET_EVENT = "df:net";

export type NetStatus = "disconnected" | "connecting" | "lobby" | "starting" | "ingame";

export interface LobbyPlayer {
    sessionId: string;
    username: string;
    ready: boolean;
    isHost: boolean;
}

export interface NetState {
    status: NetStatus;
    roomId: string;
    sessionId: string;
    players: LobbyPlayer[];
    gameStarted: boolean;
    error: string | null;
}

const initialState: NetState = {
    status: "disconnected",
    roomId: "",
    sessionId: "",
    players: [],
    gameStarted: false,
    error: null
};

export let netState: NetState = { ...initialState };

let client: Client | null = null;
let lobbyRoom: Room | null = null;
let gameRoom: Room | null = null;
let currentUsername = "Hero";
let gameRoomToken = "";
let userLeftGame = false;
let reconnectAttempts = 0;

// Stops the 30Hz input sender (module scope: used by bindGameRoom and
// leaveGameRoom; the pipeline is imported lazily to keep the net layer
// free of canvas-touching modules at load time).
function stopInputSyncRef() {
    import("./inputSync").then(m => m.stopInputSync()).catch(() => {});
}

function emit() {
    window.dispatchEvent(new CustomEvent(NET_EVENT));
}

function setState(patch: Partial<NetState>) {
    netState = { ...netState, ...patch };
    emit();
}

function getClient(): Client {
    if (!client) {
        client = new Client(GAME_SERVER_URL);
    }
    return client;
}

// ======================
// LOBBY
// ======================

export function isHost(): boolean {
    const me = netState.players.find(p => p.sessionId === lobbyRoom?.sessionId);
    return !!me && me.isHost;
}

export async function createLobby(username: string): Promise<boolean> {
    if (netState.status === "connecting" || netState.status === "ingame") {
        return false;
    }

    currentUsername = username;
    setState({ status: "connecting", error: null });

    try {
        const room = await getClient().create("lobby", { username });
        lobbyRoom = room;
        bindLobbyRoom(room);
        setState({ status: "lobby", roomId: room.roomId, sessionId: room.sessionId });
        return true;
    } catch {
        setState({ status: "disconnected", error: "Could not reach the game server." });
        return false;
    }
}

export async function joinLobby(roomCode: string, username: string): Promise<boolean> {
    if (netState.status === "connecting" || netState.status === "ingame") {
        return false;
    }

    currentUsername = username;
    setState({ status: "connecting", error: null });

    try {
        const room = await getClient().joinById(roomCode, { username });
        lobbyRoom = room;
        bindLobbyRoom(room);
        setState({ status: "lobby", roomId: room.roomId, sessionId: room.sessionId });
        return true;
    } catch {
        setState({ status: "disconnected", error: "Room not found." });
        return false;
    }
}

function bindLobbyRoom(room: Room) {
    room.onStateChange((state: any) => {
        const players: LobbyPlayer[] = [];
        state.players.forEach((p: any, sessionId: string) => {
            players.push({
                sessionId,
                username: p.username,
                ready: !!p.ready,
                isHost: !!p.isHost
            });
        });

        setState({
            players,
            gameStarted: !!state.gameStarted
        });

        if (state.gameStarted) {
            setState({ status: "starting" });
        }
    });

    room.onMessage("gameStart", (message: { roomId: string }) => {
        joinGameRoom(message.roomId);
    });

    room.onLeave(() => {
        if (gameRoom) {
            return;
        }
        lobbyRoom = null;
        setState({ ...initialState });
    });
}

export function setReady(ready: boolean) {
    if (lobbyRoom) {
        lobbyRoom.send("ready", ready);
    }
}

export async function startGame(): Promise<void> {
    if (lobbyRoom) {
        lobbyRoom.send("start");
    }
}

export async function leaveLobby(): Promise<void> {
    if (lobbyRoom) {
        await lobbyRoom.leave();
        lobbyRoom = null;
    }
    setState({ ...initialState });
}

// ======================
// GAME ROOM
// ======================

async function joinGameRoom(roomId: string) {
    try {
        const room = await getClient().joinById(roomId, { username: currentUsername });
        bindGameRoom(room);
    } catch {
        setState({ status: "lobby", error: "Failed to join the match." });
    }
}

async function bindGameRoom(room: Room) {
    gameRoom = room;
    gameRoomToken = room.reconnectionToken;
    userLeftGame = false;
    reconnectAttempts = 0;

    activateNetWorld(room.sessionId);
    setState({ status: "ingame" });

    const { startInputSync } = await import("./inputSync");
    startInputSync();

    room.onStateChange((state: any) => {
        ingestNetState(state);
    });

    room.onMessage("matchEnd", (info: MatchEndInfo) => {
        ingestMatchEnd(info);
        // Give the banner a moment to be read, then return to the lobby.
        window.setTimeout(() => {
            if (netWorld.ended && gameRoom === room) {
                leaveGameRoom();
            }
        }, 6000);
    });

    startPing(room);

    room.onLeave(async (_code: number) => {
        stopPing();
        stopInputSyncRef();
        gameRoom = null;

        if (userLeftGame) {
            deactivateNetWorld();
            if (!lobbyRoom) {
                setState({ ...initialState });
            } else {
                setState({ status: "lobby", gameStarted: false });
            }
            return;
        }

        // Abrupt disconnect: try to resume the same room.
        deactivateNetWorld();
        setState({ status: "connecting", error: null });

        const ok = await reconnectToGame();
        if (!ok) {
            if (!lobbyRoom) {
                setState({ ...initialState });
            } else {
                setState({ status: "lobby", gameStarted: false });
            }
        }
    });
}

// Reconnects to the same game room using the reconnection token after
// a brief disconnect (retries a few times).
async function reconnectToGame(): Promise<boolean> {
    while (reconnectAttempts < 5) {
        reconnectAttempts++;
        try {
            const room = await getClient().reconnect(gameRoomToken);
            await bindGameRoom(room);
            return true;
        } catch {
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }
    return false;
}

// ======================
// INPUT PIPELINE (client -> server)
// ======================

export function sendInput(input: { vx: number; vy: number; dash: boolean; attack: boolean }) {
    if (gameRoom) {
        gameRoom.send("input", input);
    }
}

export function isInGameRoom(): boolean {
    return netState.status === "ingame" && !!gameRoom;
}

export function leaveGameRoom() {
    if (gameRoom) {
        userLeftGame = true;
        gameRoom.leave();
        gameRoom = null;
    }
    stopInputSyncRef();
    deactivateNetWorld();
    if (!lobbyRoom) {
        setState({ ...initialState });
    } else {
        setState({ status: "lobby", gameStarted: false });
    }
}