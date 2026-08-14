// ======================
// INPUT (keyboard + mobile)
// ======================

const keys = {};
let attacking = false;

document.addEventListener("keydown", function (event) {
    const key = event.key.toLowerCase();
    keys[key] = true;

    if (gameState === "title" && (key === "enter" || event.code === "Space")) {
        startGame();
        return;
    }

    if (event.code === "Space") {
        attacking = true;
        event.preventDefault();
    }

    if (key === "r") {
        restartGame();
    }

    if (key === "p" || key === "escape") {
        togglePause();
    }

    if (["arrowup", "arrowdown", "arrowleft", "arrowright"].indexOf(key) !== -1) {
        event.preventDefault();
    }
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
    resetJoystick();
});

// ======================
// MOBILE CONTROLS
// ======================

const joystick = document.getElementById("joystick");
const joystickKnob = document.getElementById("joystickKnob");
const attackButton = document.getElementById("attackButton");

let joystickActive = false;

function resetJoystick() {
    joystickActive = false;

    joystickKnob.style.left = "31px";
    joystickKnob.style.top = "31px";

    keys["w"] = false;
    keys["a"] = false;
    keys["s"] = false;
    keys["d"] = false;
}

function moveJoystick(event) {
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

joystick.addEventListener("pointerdown", function (event) {
    joystickActive = true;
    joystick.setPointerCapture(event.pointerId);
    moveJoystick(event);
});

joystick.addEventListener("pointermove", function (event) {
    if (joystickActive) {
        moveJoystick(event);
    }
});

joystick.addEventListener("pointerup", function () {
    resetJoystick();
});

joystick.addEventListener("pointercancel", function () {
    resetJoystick();
});

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