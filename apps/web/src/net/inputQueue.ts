// ======================
// INPUT QUEUE (shared source of truth for client input)
// Sampled once per tick (30Hz) and consumed by BOTH the prediction
// step (each frame) and the sender (per tick) so the client and the
// server see identical inputs.
// ======================

import { keys, attacking, consumeDashRequest } from "../game/input";
import type { NetInput } from "@dark-fantasy/sim";

let current: NetInput = { vx: 0, vy: 0, dash: false, attack: false };

export function sampleInput(): NetInput {
    const vx = (keys["d"] || keys["arrowright"] ? 1 : 0) - (keys["a"] || keys["arrowleft"] ? 1 : 0);
    const vy = (keys["s"] || keys["arrowdown"] ? 1 : 0) - (keys["w"] || keys["arrowup"] ? 1 : 0);

    current = {
        vx,
        vy,
        dash: consumeDashRequest(),
        attack: attacking
    };

    return current;
}

export function lastInput(): NetInput {
    return current;
}