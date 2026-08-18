// ======================
// INPUT PIPELINE (client -> server)
// Samples the shared input queue at 30Hz and pushes it to the
// authoritative game room. Prediction reads the same queue per frame.
// ======================

import { sampleInput, lastInput } from "./inputQueue";
import { sendInput, isInGameRoom } from "./client";

const INPUT_RATE_MS = 1000 / 30;

let intervalId: number | null = null;

export function startInputSync() {
    if (intervalId !== null) {
        return;
    }

    intervalId = window.setInterval(() => {
        sampleInput();
        if (isInGameRoom()) {
            sendInput(lastInput());
        }
    }, INPUT_RATE_MS);
}

export function stopInputSync() {
    if (intervalId !== null) {
        window.clearInterval(intervalId);
        intervalId = null;
    }
}