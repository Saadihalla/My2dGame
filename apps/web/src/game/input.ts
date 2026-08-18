// ======================
// INPUT (keyboard, gamepad, mobile)
// ======================

import { gameState } from "./state";
import {
    triggerStartGame,
    triggerRestartGame,
    triggerTogglePause,
    triggerLevelUpChoice
} from "./events";
import { DASH_DOUBLE_TAP_WINDOW } from "./config";

export const keys: Record<string, boolean> = {};
export let attacking = false;

// Edge-triggered dash request, consumed by entities.updatePlayer.
export let dashRequested = false;

const lastKeyPress = {};

function requestDash() {
    dashRequested = true;
}

// Debug/agent input synthesis uses this to trigger the same dash edge
// the keyboard double-tap and dash button produce.
export function triggerDash() {
    requestDash();
}

// Debug/agent input synthesis: drive the held-attack flag directly.
export function setAttacking(hold: boolean) {
    attacking = hold;
}

export function clearDashRequest() {
    dashRequested = false;
}

// Reads and clears the dash request; entities consume it via this
// call so all writes to the flag stay inside this module.

export function consumeDashRequest() {
    const requested = dashRequested;
    dashRequested = false;
    return requested;
}

function handleKeydown(event: KeyboardEvent, key: string) {
    if (key === "shift") {
        if (!event.repeat) {
            requestDash();
        }
        return;
    }

    if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright"].indexOf(key) !== -1) {
        const now = performance.now();

        if (!event.repeat && now - (lastKeyPress[key] || 0) <= DASH_DOUBLE_TAP_WINDOW * 1000) {
            requestDash();
        }

        lastKeyPress[key] = now;
    }
}

document.addEventListener("keydown", function (event) {
    const key = event.key.toLowerCase();
    keys[key] = true;

    if (gameState === "title" && (key === "enter" || event.code === "Space")) {
        triggerStartGame();
        return;
    }

    if (gameState === "levelup") {
        if (key === "1") {
            triggerLevelUpChoice(0);
        } else if (key === "2") {
            triggerLevelUpChoice(1);
        } else if (key === "3") {
            triggerLevelUpChoice(2);
        } else if (event.code === "Space" || key === "enter") {
            triggerLevelUpChoice(0);
        }
        return;
    }

    if (event.code === "Space") {
        attacking = true;
        event.preventDefault();
    }

    if (key === "r") {
        triggerRestartGame();
    }

    if (key === "p" || key === "escape") {
        triggerTogglePause();
    }

    if (["arrowup", "arrowdown", "arrowleft", "arrowright"].indexOf(key) !== -1) {
        event.preventDefault();
    }

    handleKeydown(event, key);
});

document.addEventListener("keyup", function (event) {
    const key = event.key.toLowerCase();
    keys[key] = false;

    if (event.code === "Space") {
        attacking = false;
    }
});

window.addEventListener("blur", function () {
    for (const key in keys) {
        keys[key] = false;
    }
    attacking = false;
    dashRequested = false;
    resetJoystick();
});

// ======================
// GAMEPAD (polled once per frame)
// ======================

let padPresent = false;
let gamepadDashHeld = false;
let gamepadStartHeld = false;

export function pollGamepad() {
    if (!navigator.getGamepads) {
        return;
    }

    const pads = navigator.getGamepads();
    let found = false;

    for (const pad of pads) {
        if (!pad) {
            continue;
        }
        found = true;

        const ax = pad.axes[0] || 0;
        const ay = pad.axes[1] || 0;
        const dead = 0.3;

        keys["a"] = ax < -dead;
        keys["d"] = ax > dead;
        keys["w"] = ay < -dead;
        keys["s"] = ay > dead;

        attacking = !!(pad.buttons[0] && pad.buttons[0].pressed);

        const dashHeld = !!(pad.buttons[2] && pad.buttons[2].pressed);
        if (dashHeld && !gamepadDashHeld) {
            requestDash();
        }
        gamepadDashHeld = dashHeld;

        const startHeld = !!(pad.buttons[9] && pad.buttons[9].pressed);
        if (startHeld && !gamepadStartHeld) {
            if (gameState === "title") {
                triggerStartGame();
            } else {
                triggerTogglePause();
            }
        }
        gamepadStartHeld = startHeld;

        break;
    }

    if (padPresent && !found) {
        keys["w"] = false;
        keys["a"] = false;
        keys["s"] = false;
        keys["d"] = false;
        attacking = false;
    }
    padPresent = found;
}

// ======================
// MOBILE CONTROLS
// ======================

const joystick = document.getElementById("joystick") as HTMLElement;
const joystickKnob = document.getElementById("joystickKnob") as HTMLElement;
const attackButton = document.getElementById("attackButton") as HTMLButtonElement;
const dashButton = document.getElementById("dashButton") as HTMLButtonElement;
const pauseButton = document.getElementById("pauseButton") as HTMLButtonElement;
const controlsWrap = document.querySelector(".canvas-wrapper") as HTMLElement;

let joystickActive = false;

function resetJoystick() {
    joystickActive = false;

    joystick.style.display = "none";
    joystickKnob.style.left = "31px";
    joystickKnob.style.top = "31px";

    keys["w"] = false;
    keys["a"] = false;
    keys["s"] = false;
    keys["d"] = false;
}

function moveJoystick(event: PointerEvent) {
    const rect = joystick.getBoundingClientRect();

    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    let dx = event.clientX - centerX;
    let dy = event.clientY - centerY;

    const maxDistance = 32;

    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance > maxDistance) {
        dx = (dx / distance) * maxDistance;
        dy = (dy / distance) * maxDistance;
    }

    joystickKnob.style.left = (31 + dx) + "px";
    joystickKnob.style.top = (31 + dy) + "px";

    keys["w"] = false;
    keys["a"] = false;
    keys["s"] = false;
    keys["d"] = false;

    const deadZone = 10;

    if (dx > deadZone) {
        keys["d"] = true;
    }

    if (dx < -deadZone) {
        keys["a"] = true;
    }

    if (dy > deadZone) {
        keys["s"] = true;
    }

    if (dy < -deadZone) {
        keys["w"] = true;
    }
}

// Dynamic joystick: it appears under the thumb wherever the player
// touches the left ~60% of the screen and disappears on release.

controlsWrap.addEventListener("pointerdown", function (event) {
    if (event.pointerType !== "touch") {
        return;
    }

    // Don't hijack taps aimed at the buttons.
    if ((event.target as HTMLElement).closest && (event.target as HTMLElement).closest("button")) {
        return;
    }

    // Continuing a drag on the joystick itself just re-anchors.
    if (event.target === joystick) {
        joystickActive = true;
        moveJoystick(event);
        return;
    }

    if (!joystickActive && event.clientX < window.innerWidth * 0.6) {
        event.preventDefault();
        controlsWrap.setPointerCapture(event.pointerId);

        const size = 120;
        joystick.style.display = "block";
        joystick.style.left = (event.clientX - size / 2) + "px";
        joystick.style.top = (event.clientY - size / 2) + "px";

        joystickActive = true;
        moveJoystick(event);
    }
});

controlsWrap.addEventListener("pointermove", function (event) {
    if (joystickActive) {
        moveJoystick(event);
    }
});

controlsWrap.addEventListener("pointerup", resetJoystick);
controlsWrap.addEventListener("pointercancel", resetJoystick);

attackButton.addEventListener("pointerdown", function (event) {
    event.preventDefault();
    attackButton.setPointerCapture(event.pointerId);
    attacking = true;
});

attackButton.addEventListener("pointerup", function (event) {
    event.preventDefault();
    attacking = false;
});

attackButton.addEventListener("pointercancel", function () {
    attacking = false;
});

dashButton.addEventListener("pointerdown", function (event) {
    event.preventDefault();
    dashButton.setPointerCapture(event.pointerId);
    requestDash();
});

pauseButton.addEventListener("click", function () {
    triggerTogglePause();
});