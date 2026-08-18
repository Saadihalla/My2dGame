// ======================
// PING HUD — round-trip latency against the game room
// ======================

import type { Room } from "colyseus.js";
import { netWorld } from "./world";

const PING_INTERVAL_MS = 2000;

let intervalId: number | null = null;
let lastSentAt = 0;

export function startPing(room: Room) {
    if (intervalId !== null) {
        return;
    }

    room.onMessage("pong", (timestamp: number) => {
        if (Math.abs(timestamp - lastSentAt) < 1500) {
            netWorld.pingMs = performance.now() - timestamp;
        }
    });

    intervalId = window.setInterval(() => {
        lastSentAt = performance.now();
        room.send("ping", lastSentAt);
    }, PING_INTERVAL_MS);
}

export function stopPing() {
    if (intervalId !== null) {
        window.clearInterval(intervalId);
        intervalId = null;
    }
}