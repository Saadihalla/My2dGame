// ======================
// SETUP
// ======================

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const DPR = Math.min(window.devicePixelRatio || 1, 2);

const VIEW_WIDTH = 800;
const VIEW_HEIGHT = 500;

canvas.width = VIEW_WIDTH * DPR;
canvas.height = VIEW_HEIGHT * DPR;
ctx.scale(DPR, DPR);

// ======================
// CONFIG
// ======================

const TILE = 50;

const PLAYER_SPEED = 250;
const PLAYER_MAX_HEALTH = 100;
const ATTACK_DURATION = 0.28;
const ATTACK_COOLDOWN = 0.35;
const ATTACK_RANGE = 30;
const ATTACK_DAMAGE = 20;
const PLAYER_IFRAMES = 0.6;

const ENEMY_SPEED = 110;
const ENEMY_MAX_HEALTH = 100;
const ENEMY_DAMAGE = 10;
const ENEMY_AGGRO_RANGE = 260;
const ENEMY_ATTACK_RANGE = 55;
const ENEMY_ATTACK_COOLDOWN = 1.2;
const ENEMY_WINDUP = 0.6;
const ENEMY_STRIKE = 0.15;
const ENEMY_RECOVER = 0.5;
const ENEMY_RETREAT_TIME = 0.8;
const ENEMY_RETREAT_HP = 30;

// ======================
// GAME STATE
// ======================

let gameState = "playing"; // "playing" | "gameover" | "victory"
let gameTime = 0;
let victoryTimer = 0;
let stats = { survived: 0, hitsTaken: 0 };
let uiButtons = [];

let damageCooldown = 0;
let attacking = false;
let shake = 0;
let particles = [];
let numbers = [];

// ======================
// MAP
// ======================

const map = [
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
    [1, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 0, 0, 0, 0, 1],
    [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 1],
    [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
    [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
    [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
    [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
    [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
];

// Solid decorative objects (water, trees, rocks, torches)

const solidObjects = [
    { x: 400, y: 50, w: 200, h: 100 },   // water
    { x: 60, y: 54, w: 38, h: 52 },      // tree 70,70
    { x: 690, y: 54, w: 38, h: 52 },     // tree 700,70
    { x: 60, y: 364, w: 38, h: 52 },     // tree 70,380
    { x: 690, y: 364, w: 38, h: 52 },    // tree 700,380
    { x: 320, y: 54, w: 38, h: 52 },     // tree 330,70
    { x: 177, y: 77, w: 32, h: 20 },     // rock 180,80
    { x: 647, y: 197, w: 32, h: 20 },    // rock 650,200
    { x: 247, y: 387, w: 32, h: 20 },    // rock 250,390
    { x: 577, y: 387, w: 32, h: 20 }     // rock 580,390
];

const TORCHES = [
    { x: 150, y: 250 },
    { x: 650, y: 250 }
];

// ======================
// AUDIO (WebAudio synth)
// ======================

const AudioFX = {
    ctx: null,
    master: null,

    ensure: function () {
        if (!this.ctx) {
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            if (!AudioContextClass) {
                return;
            }
            this.ctx = new AudioContextClass();
            this.master = this.ctx.createGain();
            this.master.gain.value = 0.5;
            this.master.connect(this.ctx.destination);
        }
        if (this.ctx.state === "suspended") {
            this.ctx.resume();
        }
    },

    tone: function (freq, duration, type, volume, slideTo, delay) {
        if (!this.ctx) {
            return;
        }
        const start = this.ctx.currentTime + (delay || 0);
        const oscillator = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        oscillator.type = type;
        oscillator.frequency.setValueAtTime(freq, start);
        if (slideTo) {
            oscillator.frequency.exponentialRampToValueAtTime(slideTo, start + duration);
        }

        gain.gain.setValueAtTime(volume, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + duration);

        oscillator.connect(gain);
        gain.connect(this.master);
        oscillator.start(start);
        oscillator.stop(start + duration + 0.02);
    },

    noise: function (duration, volume, frequency) {
        if (!this.ctx) {
            return;
        }
        const start = this.ctx.currentTime;
        const length = Math.max(1, Math.floor(this.ctx.sampleRate * duration));
        const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);

        for (let i = 0; i < length; i++) {
            data[i] = (Math.random() * 2 - 1) * (1 - i / length);
        }

        const source = this.ctx.createBufferSource();
        source.buffer = buffer;

        const filter = this.ctx.createBiquadFilter();
        filter.type = "bandpass";
        filter.frequency.value = frequency;
        filter.Q.value = 1.2;

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(volume, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + duration);

        source.connect(filter);
        filter.connect(gain);
        gain.connect(this.master);
        source.start(start);
    },

    swing: function () {
        this.ensure();
        this.noise(0.12, 0.3, 1600);
    },

    hit: function () {
        this.ensure();
        this.tone(200, 0.1, "square", 0.25, 80);
        this.noise(0.08, 0.25, 900);
    },

    hurt: function () {
        this.ensure();
        this.tone(150, 0.22, "sawtooth", 0.3, 55);
    },

    kill: function () {
        this.ensure();
        this.tone(320, 0.6, "sawtooth", 0.3, 35);
        this.noise(0.4, 0.3, 500);
    },

    victory: function () {
        this.ensure();
        const notes = [523, 659, 784, 1047];
        for (let i = 0; i < notes.length; i++) {
            this.tone(notes[i], 0.35, "square", 0.18, null, i * 0.13);
        }
    }
};

// ======================
// KEYBOARD
// ======================

const keys = {};

document.addEventListener("keydown", function (event) {
    const key = event.key.toLowerCase();
    keys[key] = true;

    if (event.code === "Space") {
        attacking = true;
        event.preventDefault();
    }

    if (key === "r") {
        restartGame();
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

window.addEventListener("keydown", function () {
    AudioFX.ensure();
}, { once: true });

window.addEventListener("pointerdown", function () {
    AudioFX.ensure();
}, { once: true });

// ======================
// PLAYER
// ======================

const player = {
    x: 100,
    y: 100,
    width: 40,
    height: 40,
    health: PLAYER_MAX_HEALTH,
    direction: "right",
    attackTimer: 0,
    attackCooldown: 0
};

// ======================
// ENEMY
// ======================

const enemy = {
    x: 600,
    y: 150,
    width: 40,
    height: 40,
    health: ENEMY_MAX_HEALTH,
    barHealth: ENEMY_MAX_HEALTH,
    facing: "left",
    state: "idle",
    stateTimer: 0,
    attackCooldown: 0,
    flash: 0,
    kx: 0,
    ky: 0
};

// ======================
// COLLISION
// ======================

function aabb(a, b) {
    return (
        a.x < b.x + b.w &&
        a.x + a.w > b.x &&
        a.y < b.y + b.h &&
        a.y + a.h > b.y
    );
}

function isColliding(x, y, width, height) {
    const left = Math.floor(x / TILE);
    const right = Math.floor((x + width - 1) / TILE);
    const top = Math.floor(y / TILE);
    const bottom = Math.floor((y + height - 1) / TILE);

    for (let row = top; row <= bottom; row++) {
        for (let column = left; column <= right; column++) {
            if (
                row < 0 ||
                row >= map.length ||
                column < 0 ||
                column >= map[row].length
            ) {
                return true;
            }

            if (map[row][column] === 1) {
                return true;
            }
        }
    }

    for (const object of solidObjects) {
        if (
            x < object.x + object.w &&
            x + width > object.x &&
            y < object.y + object.h &&
            y + height > object.y
        ) {
            return true;
        }
    }

    return false;
}

function playerCollidesWith(x, y, width, height) {
    if (isColliding(x, y, width, height)) {
        return true;
    }

    if (enemy.health > 0) {
        const enemyBox = { x: enemy.x, y: enemy.y, w: enemy.width, h: enemy.height };
        const rect = { x: x, y: y, w: width, h: height };

        if (aabb(rect, enemyBox)) {
            return true;
        }
    }

    return false;
}

function enemyCollidesWith(x, y, width, height) {
    if (isColliding(x, y, width, height)) {
        return true;
    }

    const playerBox = { x: player.x, y: player.y, w: player.width, h: player.height };
    const rect = { x: x, y: y, w: width, h: height };

    return aabb(rect, playerBox);
}

function tryMove(ent, vx, vy) {
    if (!enemyCollidesWith(ent.x + vx, ent.y, ent.width, ent.height)) {
        ent.x += vx;
    }
    if (!enemyCollidesWith(ent.x, ent.y + vy, ent.width, ent.height)) {
        ent.y += vy;
    }
}

// ======================
// FX (particles, damage numbers, shake)
// ======================

function spawnParticles(x, y, count, colors, speed) {
    for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const magnitude = speed * (0.4 + Math.random() * 0.8);

        particles.push({
            x: x,
            y: y,
            vx: Math.cos(angle) * magnitude,
            vy: Math.sin(angle) * magnitude - 40,
            life: 0.3 + Math.random() * 0.35,
            maxLife: 0.65,
            size: 2 + Math.random() * 3,
            color: colors[Math.floor(Math.random() * colors.length)]
        });
    }
}

function updateParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.life -= dt;

        if (p.life <= 0) {
            particles.splice(i, 1);
            continue;
        }

        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 350 * dt;
    }
}

function addNumber(x, y, text, color) {
    numbers.push({
        x: x,
        y: y,
        life: 0.9,
        text: text,
        color: color
    });
}

function updateNumbers(dt) {
    for (let i = numbers.length - 1; i >= 0; i--) {
        const n = numbers[i];
        n.life -= dt;
        n.y -= 45 * dt;

        if (n.life <= 0) {
            numbers.splice(i, 1);
        }
    }
}

// ======================
// COMBAT
// ======================

function killEnemy() {
    enemy.health = 0;
    enemy.flash = 0;

    shake = Math.min(shake + 10, 18);
    AudioFX.kill();

    spawnParticles(
        enemy.x + enemy.width / 2,
        enemy.y + enemy.height / 2,
        30,
        ["#c62828", "#8b1a1a", "#f2f2f2", "#eee", "#ffd54f"],
        240
    );
    addNumber(enemy.x + enemy.width / 2, enemy.y - 20, "VANQUISHED", "#ffffff");

    victoryTimer = 1.2;
}

function attackEnemy(dt) {
    if (player.attackCooldown > 0) {
        player.attackCooldown -= dt;
    }
    if (player.attackTimer > 0) {
        player.attackTimer -= dt;
    }

    if (!attacking || enemy.health <= 0 || player.attackCooldown > 0) {
        return;
    }

    player.attackTimer = ATTACK_DURATION;
    player.attackCooldown = ATTACK_COOLDOWN;

    shake = Math.min(shake + 1.5, 12);
    AudioFX.swing();

    const attackBox = {
        x: player.x,
        y: player.y,
        w: player.width,
        h: player.height
    };

    if (player.direction === "right") {
        attackBox.x = player.x + player.width;
        attackBox.y = player.y + 5;
        attackBox.w = ATTACK_RANGE;
        attackBox.h = player.height - 10;
    }

    if (player.direction === "left") {
        attackBox.x = player.x - ATTACK_RANGE;
        attackBox.y = player.y + 5;
        attackBox.w = ATTACK_RANGE;
        attackBox.h = player.height - 10;
    }

    if (player.direction === "down") {
        attackBox.x = player.x + 5;
        attackBox.y = player.y + player.height;
        attackBox.w = player.width - 10;
        attackBox.h = ATTACK_RANGE;
    }

    if (player.direction === "up") {
        attackBox.x = player.x + 5;
        attackBox.y = player.y - ATTACK_RANGE;
        attackBox.w = player.width - 10;
        attackBox.h = ATTACK_RANGE;
    }

    const enemyBox = { x: enemy.x, y: enemy.y, w: enemy.width, h: enemy.height };

    if (aabb(attackBox, enemyBox)) {
        enemy.health -= ATTACK_DAMAGE;
        enemy.flash = 0.12;

        const knockX = player.x + player.width / 2 < enemy.x + enemy.width / 2 ? 1 : -1;
        const knockY = player.y + player.height / 2 < enemy.y + enemy.height / 2 ? 1 : -1;
        enemy.kx = knockX * 300;
        enemy.ky = knockY * 120;

        shake = Math.min(shake + 4, 15);
        AudioFX.hit();

        spawnParticles(
            attackBox.x + attackBox.w / 2,
            attackBox.y + attackBox.h / 2,
            8,
            ["#c62828", "#8b1a1a", "#ffd54f"],
            160
        );
        addNumber(enemy.x + enemy.width / 2, enemy.y - 14, String(ATTACK_DAMAGE), "#ffe08a");

        if (enemy.health <= 0) {
            killEnemy();
        }
    }
}

function strikePlayer() {
    if (damageCooldown > 0 || gameState !== "playing") {
        return;
    }

    const attackBox = {
        x: enemy.facing === "right" ? enemy.x + enemy.width : enemy.x - 50,
        y: enemy.y + 4,
        w: 50,
        h: enemy.height - 8
    };

    const playerBox = { x: player.x, y: player.y, w: player.width, h: player.height };

    if (!aabb(attackBox, playerBox)) {
        return;
    }

    player.health -= ENEMY_DAMAGE;
    damageCooldown = PLAYER_IFRAMES;
    stats.hitsTaken++;

    shake = Math.min(shake + 6, 16);
    AudioFX.hurt();

    spawnParticles(
        player.x + player.width / 2,
        player.y + player.height / 2,
        10,
        ["#c62828", "#8b1a1a", "#eee"],
        140
    );
    addNumber(player.x + player.width / 2, player.y - 10, String(ENEMY_DAMAGE), "#ff6b6b");

    if (player.health <= 0) {
        player.health = 0;
        gameState = "gameover";
        uiButtons = [playAgainButton];
        AudioFX.kill();
    }
}

// ======================
// ENEMY AI
// ======================

function updateEnemy(dt) {
    if (enemy.health <= 0) {
        if (enemy.barHealth > 0) {
            enemy.barHealth = Math.max(0, enemy.barHealth - 60 * dt);
        }
        return;
    }

    if (enemy.flash > 0) {
        enemy.flash -= dt;
    }
    if (enemy.attackCooldown > 0) {
        enemy.attackCooldown -= dt;
    }

    enemy.barHealth += (enemy.health - enemy.barHealth) * Math.min(1, dt * 8);

    // Knockback

    if (enemy.kx !== 0 || enemy.ky !== 0) {
        if (!enemyCollidesWith(enemy.x + enemy.kx * dt, enemy.y, enemy.width, enemy.height)) {
            enemy.x += enemy.kx * dt;
        }
        if (!enemyCollidesWith(enemy.x, enemy.y + enemy.ky * dt, enemy.width, enemy.height)) {
            enemy.y += enemy.ky * dt;
        }

        enemy.kx *= Math.exp(-6 * dt);
        enemy.ky *= Math.exp(-6 * dt);

        if (Math.abs(enemy.kx) < 1 && Math.abs(enemy.ky) < 1) {
            enemy.kx = 0;
            enemy.ky = 0;
        }
    }

    const playerCenterX = player.x + player.width / 2;
    const playerCenterY = player.y + player.height / 2;
    const enemyCenterX = enemy.x + enemy.width / 2;
    const enemyCenterY = enemy.y + enemy.height / 2;

    const dx = playerCenterX - enemyCenterX;
    const dy = playerCenterY - enemyCenterY;
    const dist = Math.hypot(dx, dy);

    enemy.facing = dx >= 0 ? "right" : "left";

    switch (enemy.state) {
        case "idle":
            if (dist < ENEMY_AGGRO_RANGE) {
                enemy.state = "chase";
            }
            break;

        case "chase":
            if (dist > ENEMY_ATTACK_RANGE) {
                const vx = (dx / dist) * ENEMY_SPEED * dt;
                const vy = (dy / dist) * ENEMY_SPEED * dt;
                tryMove(enemy, vx, vy);
            } else if (enemy.attackCooldown <= 0) {
                enemy.state = "windup";
                enemy.stateTimer = ENEMY_WINDUP;
            }
            break;

        case "windup":
            enemy.stateTimer -= dt;
            if (enemy.stateTimer <= 0) {
                enemy.state = "strike";
                enemy.stateTimer = ENEMY_STRIKE;
            }
            break;

        case "strike":
            enemy.stateTimer -= dt;
            if (enemy.stateTimer <= 0) {
                strikePlayer();
                enemy.state = "recover";
                enemy.stateTimer = ENEMY_RECOVER;
                enemy.attackCooldown = ENEMY_ATTACK_COOLDOWN;
            }
            break;

        case "recover":
            enemy.stateTimer -= dt;
            if (enemy.stateTimer <= 0) {
                if (enemy.health <= ENEMY_RETREAT_HP && Math.random() < 0.35) {
                    enemy.state = "retreat";
                    enemy.stateTimer = ENEMY_RETREAT_TIME;
                } else {
                    enemy.state = "chase";
                }
            }
            break;

        case "retreat":
            enemy.stateTimer -= dt;
            if (enemy.stateTimer > 0 && dist > 1) {
                const vx = (-dx / dist) * ENEMY_SPEED * dt;
                const vy = (-dy / dist) * ENEMY_SPEED * dt;
                tryMove(enemy, vx, vy);
            } else {
                enemy.state = "chase";
            }
            break;
    }
}

// ======================
// PLAYER UPDATE
// ======================

function updatePlayer(dt) {
    let dx = 0;
    let dy = 0;

    if (keys["w"] || keys["arrowup"]) {
        dy -= 1;
    }
    if (keys["s"] || keys["arrowdown"]) {
        dy += 1;
    }
    if (keys["a"] || keys["arrowleft"]) {
        dx -= 1;
    }
    if (keys["d"] || keys["arrowright"]) {
        dx += 1;
    }

    if (dx !== 0 || dy !== 0) {
        const length = Math.hypot(dx, dy);
        const moveX = (dx / length) * PLAYER_SPEED * dt;
        const moveY = (dy / length) * PLAYER_SPEED * dt;

        if (!playerCollidesWith(player.x + moveX, player.y, player.width, player.height)) {
            player.x += moveX;
        }
        if (!playerCollidesWith(player.x, player.y + moveY, player.width, player.height)) {
            player.y += moveY;
        }

        if (Math.abs(dx) >= Math.abs(dy)) {
            player.direction = dx > 0 ? "right" : "left";
        } else {
            player.direction = dy > 0 ? "down" : "up";
        }
    }
}

// ======================
// UPDATE
// ======================

function update(dt) {
    gameTime += dt;

    if (shake > 0) {
        shake = Math.max(0, shake - 35 * dt);
    }

    updateParticles(dt);
    updateNumbers(dt);

    if (gameState !== "playing") {
        return;
    }

    stats.survived += dt;

    if (damageCooldown > 0) {
        damageCooldown -= dt;
    }

    updatePlayer(dt);
    updateEnemy(dt);
    attackEnemy(dt);

    if (victoryTimer > 0) {
        victoryTimer -= dt;

        if (victoryTimer <= 0) {
            gameState = "victory";
            uiButtons = [playAgainButton];
            AudioFX.victory();
        }
    }
}

// ======================
// DRAW MAP
// ======================

function drawGrassTile(x, y) {

    ctx.fillStyle = "#315d34";

    ctx.fillRect(x, y, TILE, TILE);

    // Random-looking grass details

    ctx.fillStyle = "#3d6d40";

    ctx.fillRect(x + 7, y + 9, 3, 3);
    ctx.fillRect(x + 31, y + 13, 2, 3);
    ctx.fillRect(x + 18, y + 34, 3, 2);
    ctx.fillRect(x + 40, y + 27, 2, 3);

    ctx.fillStyle = "#254c29";

    ctx.fillRect(x + 12, y + 25, 2, 5);
    ctx.fillRect(x + 34, y + 39, 3, 2);
}

function drawStoneTile(x, y) {

    ctx.fillStyle = "#363636";

    ctx.fillRect(x, y, TILE, TILE);

    // Top highlight

    ctx.fillStyle = "#505050";

    ctx.fillRect(x + 2, y + 2, TILE - 4, 7);

    // Bottom shadow

    ctx.fillStyle = "#202020";

    ctx.fillRect(x + 2, y + 41, TILE - 4, 7);

    // Stone cracks

    ctx.fillStyle = "#181818";

    ctx.fillRect(x + 8, y + 19, 13, 2);
    ctx.fillRect(x + 18, y + 20, 2, 9);
    ctx.fillRect(x + 32, y + 13, 9, 2);
    ctx.fillRect(x + 34, y + 14, 2, 7);
}

function drawMap() {

    // =========================
    // BASE WORLD
    // =========================

    ctx.fillStyle = "#294d2c";
    ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);

    // =========================
    // TILES
    // =========================

    for (let row = 0; row < map.length; row++) {

        for (let column = 0; column < map[row].length; column++) {

            const tile = map[row][column];

            const x = column * TILE;
            const y = row * TILE;

            if (tile === 0) {
                drawGrassTile(x, y);
            }

            if (tile === 1) {
                drawStoneTile(x, y);
            }
        }
    }

    // =========================
    // DIRT PATH
    // =========================

    ctx.fillStyle = "#6b5136";

    ctx.fillRect(50, 275, 700, 45);

    ctx.fillStyle = "#806346";

    ctx.fillRect(50, 282, 700, 30);

    // Little dirt marks

    ctx.fillStyle = "#59422c";

    ctx.fillRect(120, 290, 15, 4);
    ctx.fillRect(240, 300, 9, 3);
    ctx.fillRect(390, 286, 13, 4);
    ctx.fillRect(520, 302, 18, 3);
    ctx.fillRect(650, 291, 10, 4);

    // Redraw stone tiles under the path so walls stay visible

    for (let row = 5; row <= 6; row++) {

        for (let column = 1; column <= 14; column++) {

            if (map[row][column] === 1) {
                drawStoneTile(column * TILE, row * TILE);
            }
        }
    }

    // =========================
    // WATER (solid)
    // =========================

    ctx.fillStyle = "#193f52";

    ctx.fillRect(400, 50, 200, 100);

    ctx.fillStyle = "#245b70";

    for (let y = 60; y < 145; y += 20) {

        ctx.fillRect(410, y, 45, 3);
        ctx.fillRect(480, y + 7, 55, 3);
        ctx.fillRect(560, y, 25, 3);
    }

    // =========================
    // TREES
    // =========================

    drawTree(70, 70);
    drawTree(700, 70);

    drawTree(70, 380);
    drawTree(700, 380);

    drawTree(330, 70);

    // =========================
    // ROCKS
    // =========================

    drawRock(180, 80);
    drawRock(650, 200);
    drawRock(250, 390);
    drawRock(580, 390);

    // =========================
    // GRASS TUFTS
    // =========================

    drawGrass(180, 200);
    drawGrass(220, 230);
    drawGrass(650, 340);
    drawGrass(330, 370);
    drawGrass(600, 230);

    // =========================
    // TORCHES
    // =========================

    drawTorch(150, 250);
    drawTorch(650, 250);
}

function drawTree(x, y) {

    // Shadow

    ctx.fillStyle = "rgba(0, 0, 0, 0.3)";

    ctx.fillRect(x - 15, y + 30, 45, 10);

    // Trunk

    ctx.fillStyle = "#4b3020";

    ctx.fillRect(x, y, 15, 35);

    // Dark leaves

    ctx.fillStyle = "#163d20";

    ctx.fillRect(x - 15, y - 15, 45, 25);
    ctx.fillRect(x - 8, y - 25, 30, 20);

    // Light leaves

    ctx.fillStyle = "#285b2d";

    ctx.fillRect(x - 8, y - 18, 25, 12);
    ctx.fillRect(x - 3, y - 28, 18, 12);
}

function drawRock(x, y) {

    // Shadow

    ctx.fillStyle = "rgba(0, 0, 0, 0.3)";

    ctx.fillRect(x - 5, y + 12, 35, 8);

    // Rock

    ctx.fillStyle = "#555";

    ctx.fillRect(x, y, 30, 15);
    ctx.fillRect(x + 5, y - 5, 20, 20);

    // Highlight

    ctx.fillStyle = "#707070";

    ctx.fillRect(x + 7, y - 2, 10, 5);
}

function drawGrass(x, y) {

    ctx.fillStyle = "#4c7c45";

    ctx.fillRect(x, y, 3, 10);
    ctx.fillRect(x + 5, y - 4, 3, 14);
    ctx.fillRect(x + 10, y + 2, 3, 8);
}

function drawTorch(x, y) {

    // Pole

    ctx.fillStyle = "#4a2d1c";

    ctx.fillRect(x, y, 6, 30);

    // Fire (flickers)

    const flicker = Math.sin(gameTime * 13 + x) * 2.5;

    ctx.fillStyle = "#ff9d22";

    ctx.fillRect(x - 4, y - 12 - flicker * 0.4, 14, 14 + flicker);

    ctx.fillStyle = "#ffe36b";

    ctx.fillRect(x - 1, y - 9 - flicker * 0.4, 8, 9 + flicker);
}

// ======================
// TORCH LIGHT
// ======================

function drawTorchLights() {

    ctx.globalCompositeOperation = "lighter";

    for (const torch of TORCHES) {

        const flicker = Math.sin(gameTime * 9 + torch.x) * 10;
        const radius = 120 + flicker;
        const gx = torch.x + 3;
        const gy = torch.y - 5;

        const gradient = ctx.createRadialGradient(gx, gy, 5, gx, gy, radius);

        gradient.addColorStop(0, "rgba(255, 150, 50, 0.30)");
        gradient.addColorStop(1, "rgba(255, 150, 50, 0)");

        ctx.fillStyle = gradient;
        ctx.fillRect(gx - radius, gy - radius, radius * 2, radius * 2);
    }

    ctx.globalCompositeOperation = "source-over";
}

// ======================
// DRAW PLAYER
// ======================

function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
}

function drawSwordSwing(x, y) {

    const progress = 1 - player.attackTimer / ATTACK_DURATION;
    const sweep = -1.2 + easeOutCubic(progress) * 2.4;

    let baseAngle = 0;

    if (player.direction === "left") {
        baseAngle = Math.PI;
    }
    if (player.direction === "up") {
        baseAngle = -Math.PI / 2;
    }
    if (player.direction === "down") {
        baseAngle = Math.PI / 2;
    }

    ctx.save();
    ctx.translate(x + 20, y + 22);
    ctx.rotate(baseAngle + sweep);

    ctx.fillStyle = "#777";
    ctx.fillRect(0, -3, 34, 6);

    ctx.fillStyle = "#bbb";
    ctx.fillRect(2, -3, 30, 2);

    ctx.fillStyle = "#151515";
    ctx.fillRect(-2, 2, 7, 3);

    ctx.restore();
}

function drawPlayer() {

    // Blink while invulnerable

    if (
        damageCooldown > 0 &&
        gameState === "playing" &&
        Math.floor(gameTime * 12) % 2 === 0
    ) {
        return;
    }

    const x = player.x;
    const y = player.y;

    const swinging = player.attackTimer > 0;

    // ===== CAPE / BACK =====

    ctx.fillStyle = "#151515";

    ctx.fillRect(x + 4, y + 18, 8, 18);

    // ===== LEGS =====

    ctx.fillStyle = "#242424";

    ctx.fillRect(x + 9, y + 31, 9, 9);
    ctx.fillRect(x + 23, y + 31, 9, 9);

    // Boots

    ctx.fillStyle = "#111";

    ctx.fillRect(x + 7, y + 38, 11, 4);
    ctx.fillRect(x + 22, y + 38, 13, 4);

    // ===== BODY ARMOR =====

    ctx.fillStyle = "#292929";

    ctx.fillRect(x + 8, y + 15, 25, 19);

    // Armor highlights

    ctx.fillStyle = "#444";

    ctx.fillRect(x + 10, y + 17, 5, 12);
    ctx.fillRect(x + 25, y + 17, 5, 12);

    // ===== HEAD =====

    ctx.fillStyle = "#c58b65";

    ctx.fillRect(x + 10, y + 4, 20, 16);

    // ===== HAIR =====

    ctx.fillStyle = "#080808";

    ctx.fillRect(x + 7, y + 1, 26, 8);
    ctx.fillRect(x + 5, y + 5, 7, 12);
    ctx.fillRect(x + 28, y + 5, 6, 10);

    // Hair spikes

    ctx.fillRect(x + 8, y, 7, 5);
    ctx.fillRect(x + 17, y - 2, 7, 6);
    ctx.fillRect(x + 25, y, 7, 5);

    // ===== EYES =====

    ctx.fillStyle = "#eee";

    ctx.fillRect(x + 13, y + 10, 4, 2);
    ctx.fillRect(x + 23, y + 10, 4, 2);

    // ===== ARM =====

    ctx.fillStyle = "#242424";

    ctx.fillRect(x + 2, y + 17, 8, 17);
    ctx.fillRect(x + 31, y + 16, 8, 18);

    // ===== SWORD =====

    if (swinging) {

        drawSwordSwing(x, y);

    } else {

        if (player.direction === "right") {

            ctx.fillStyle = "#777";
            ctx.fillRect(x + 38, y + 10, 28, 6);

            ctx.fillStyle = "#bbb";
            ctx.fillRect(x + 40, y + 10, 24, 2);

            ctx.fillStyle = "#151515";
            ctx.fillRect(x + 37, y + 17, 8, 4);
        }

        if (player.direction === "left") {

            ctx.fillStyle = "#777";
            ctx.fillRect(x - 28, y + 10, 28, 6);

            ctx.fillStyle = "#bbb";
            ctx.fillRect(x - 26, y + 10, 24, 2);

            ctx.fillStyle = "#151515";
            ctx.fillRect(x - 5, y + 17, 8, 4);
        }

        if (player.direction === "up") {

            ctx.fillStyle = "#777";
            ctx.fillRect(x + 17, y - 27, 6, 27);

            ctx.fillStyle = "#bbb";
            ctx.fillRect(x + 17, y - 25, 2, 23);

            ctx.fillStyle = "#151515";
            ctx.fillRect(x + 14, y - 3, 12, 5);
        }

        if (player.direction === "down") {

            ctx.fillStyle = "#777";
            ctx.fillRect(x + 17, y + 40, 6, 27);

            ctx.fillStyle = "#bbb";
            ctx.fillRect(x + 19, y + 42, 2, 23);

            ctx.fillStyle = "#151515";
            ctx.fillRect(x + 14, y + 38, 12, 5);
        }
    }
}

// ======================
// DRAW ENEMY
// ======================

function drawEnemy() {

    if (enemy.health <= 0) {
        return;
    }

    const x = enemy.x;
    const y = enemy.y;

    // ===== HEALTH BAR =====

    ctx.fillStyle = "darkred";

    ctx.fillRect(x, y - 10, enemy.width, 5);

    ctx.fillStyle = "lime";

    ctx.fillRect(
        x,
        y - 10,
        enemy.width * Math.max(0, enemy.barHealth / ENEMY_MAX_HEALTH),
        5
    );

    ctx.save();

    if (enemy.facing === "left") {
        ctx.translate(x + enemy.width, 0);
        ctx.scale(-1, 1);
        ctx.translate(-x, 0);
    }

    // ===== WINDUP TELEGRAPH =====

    if (enemy.state === "windup") {

        const pulse = 0.5 + 0.5 * Math.sin(gameTime * 20);

        ctx.fillStyle = "rgba(255, 60, 60, " + (0.15 + pulse * 0.25).toFixed(3) + ")";

        ctx.fillRect(x - 2, y - 2, enemy.width + 4, enemy.height + 4);

        ctx.fillStyle = "#ff5555";
        ctx.font = "bold 22px Arial";
        ctx.textAlign = "center";

        ctx.fillText("!", x + enemy.width / 2, y - 12);
    }

    // ===== CAPE =====

    ctx.fillStyle = "#eee";

    ctx.fillRect(x + 5, y + 20, 30, 18);

    // ===== LEGS =====

    ctx.fillStyle = "#d8d8d8";

    ctx.fillRect(x + 10, y + 32, 8, 8);
    ctx.fillRect(x + 22, y + 32, 8, 8);

    // ===== BODY ARMOR =====

    ctx.fillStyle = "#f2f2f2";

    ctx.fillRect(x + 8, y + 14, 25, 20);

    // Armor shadows

    ctx.fillStyle = "#aaa";

    ctx.fillRect(x + 8, y + 18, 5, 15);
    ctx.fillRect(x + 28, y + 18, 5, 15);

    // ===== HEAD =====

    ctx.fillStyle = "#f1c7aa";

    ctx.fillRect(x + 10, y + 3, 20, 17);

    // ===== LONG PALE HAIR =====

    ctx.fillStyle = "#f4f4f4";

    ctx.fillRect(x + 7, y + 1, 26, 8);
    ctx.fillRect(x + 5, y + 6, 7, 20);
    ctx.fillRect(x + 28, y + 6, 7, 20);

    // Hair highlights

    ctx.fillStyle = "#ffffff";

    ctx.fillRect(x + 10, y, 5, 7);
    ctx.fillRect(x + 19, y - 1, 5, 8);
    ctx.fillRect(x + 27, y + 1, 4, 7);

    // ===== EYES =====

    ctx.fillStyle = "#555";

    ctx.fillRect(x + 13, y + 10, 4, 2);
    ctx.fillRect(x + 23, y + 10, 4, 2);

    // ===== SWORD =====

    ctx.fillStyle = "#aaa";

    ctx.fillRect(x + 36, y + 5, 4, 30);

    ctx.fillStyle = "#eee";

    ctx.fillRect(x + 37, y + 5, 2, 27);

    // Sword handle

    ctx.fillStyle = "#555";

    ctx.fillRect(x + 34, y + 31, 9, 4);

    // ===== HURT FLASH =====

    if (enemy.flash > 0) {

        ctx.fillStyle = "rgba(255, 255, 255, " + ((enemy.flash / 0.12) * 0.75).toFixed(3) + ")";

        ctx.fillRect(x - 2, y - 2, enemy.width + 4, enemy.height + 4);
    }

    ctx.restore();
}

// ======================
// DRAW FX
// ======================

function drawParticles() {

    for (const p of particles) {

        ctx.globalAlpha = Math.max(0, p.life / p.maxLife);

        ctx.fillStyle = p.color;

        ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }

    ctx.globalAlpha = 1;
}

function drawNumbers() {

    for (const n of numbers) {

        ctx.globalAlpha = Math.min(1, n.life / 0.45);

        ctx.fillStyle = n.color;
        ctx.font = "bold 15px Arial";
        ctx.textAlign = "center";

        ctx.fillText(n.text, n.x, n.y);
    }

    ctx.globalAlpha = 1;
}

// ======================
// LIGHTING
// ======================

function drawLighting() {

    const centerX = player.x + player.width / 2;
    const centerY = player.y + player.height / 2;

    const gradient = ctx.createRadialGradient(
        centerX,
        centerY,
        70,
        centerX,
        centerY,
        380
    );

    gradient.addColorStop(0, "rgba(0, 0, 0, 0)");
    gradient.addColorStop(1, "rgba(0, 0, 0, 0.55)");

    ctx.fillStyle = gradient;

    ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
}

// ======================
// DRAW HUD
// ======================

function drawHUD() {

    const barWidth = 200;
    const barHeight = 20;

    const x = 20;
    const y = 20;

    // Background

    ctx.fillStyle = "darkred";

    ctx.fillRect(x, y, barWidth, barHeight);

    // Current health

    ctx.fillStyle = "lime";

    ctx.fillRect(x, y, barWidth * (player.health / PLAYER_MAX_HEALTH), barHeight);

    // Border

    ctx.strokeStyle = "white";

    ctx.strokeRect(x, y, barWidth, barHeight);

    // Label

    ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
    ctx.font = "13px Arial";
    ctx.textAlign = "left";

    ctx.fillText("HP", x, y - 5);

    // Stats

    ctx.fillStyle = "rgba(255, 255, 255, 0.65)";
    ctx.font = "13px Arial";
    ctx.textAlign = "right";

    ctx.fillText(stats.survived.toFixed(1) + "s survived", VIEW_WIDTH - 16, 30);
    ctx.fillText("hits taken: " + stats.hitsTaken, VIEW_WIDTH - 16, 48);
}

// ======================
// OVERLAYS + BUTTONS
// ======================

const playAgainButton = {
    x: VIEW_WIDTH / 2 - 100,
    y: VIEW_HEIGHT / 2 + 20,
    w: 200,
    h: 60,
    label: "PLAY AGAIN",
    action: restartGame
};

function drawOverlays() {

    if (gameState === "playing") {
        return;
    }

    // Dark overlay

    ctx.fillStyle = "rgba(0, 0, 0, 0.72)";

    ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);

    ctx.textAlign = "center";

    if (gameState === "gameover") {

        ctx.fillStyle = "#ff5a5a";
        ctx.font = "60px Georgia, serif";

        ctx.fillText("GAME OVER", VIEW_WIDTH / 2, VIEW_HEIGHT / 2 - 60);

        ctx.fillStyle = "#cccccc";
        ctx.font = "18px Arial";

        ctx.fillText(
            "You survived " + stats.survived.toFixed(1) + "s — " +
            stats.hitsTaken + " hit" + (stats.hitsTaken === 1 ? "" : "s") + " taken",
            VIEW_WIDTH / 2,
            VIEW_HEIGHT / 2 - 32
        );
    }

    if (gameState === "victory") {

        ctx.fillStyle = "#ffd75a";
        ctx.font = "60px Georgia, serif";

        ctx.fillText("VICTORY", VIEW_WIDTH / 2, VIEW_HEIGHT / 2 - 60);

        ctx.fillStyle = "#cccccc";
        ctx.font = "18px Arial";

        ctx.fillText(
            "The pale knight has fallen — " + stats.survived.toFixed(1) + "s",
            VIEW_WIDTH / 2,
            VIEW_HEIGHT / 2 - 32
        );
    }

    for (const button of uiButtons) {

        ctx.fillStyle = "#3498db";

        ctx.fillRect(button.x, button.y, button.w, button.h);

        ctx.strokeStyle = "rgba(255, 255, 255, 0.6)";

        ctx.strokeRect(button.x, button.y, button.w, button.h);

        ctx.fillStyle = "white";
        ctx.font = "25px Arial";

        ctx.fillText(button.label, button.x + button.w / 2, button.y + button.h / 2 + 9);
    }
}

// ======================
// CLICK HANDLER
// ======================

canvas.addEventListener("click", function (event) {

    const rect = canvas.getBoundingClientRect();

    const mouseX = (event.clientX - rect.left) * (VIEW_WIDTH / rect.width);
    const mouseY = (event.clientY - rect.top) * (VIEW_HEIGHT / rect.height);

    for (const button of uiButtons) {

        if (
            mouseX >= button.x &&
            mouseX <= button.x + button.w &&
            mouseY >= button.y &&
            mouseY <= button.y + button.h
        ) {
            button.action();
            return;
        }
    }
});

// ======================
// RESTART
// ======================

function restartGame() {

    for (const key in keys) {
        keys[key] = false;
    }

    attacking = false;

    player.x = 100;
    player.y = 100;
    player.health = PLAYER_MAX_HEALTH;
    player.direction = "right";
    player.attackTimer = 0;
    player.attackCooldown = 0;

    enemy.x = 600;
    enemy.y = 150;
    enemy.health = ENEMY_MAX_HEALTH;
    enemy.barHealth = ENEMY_MAX_HEALTH;
    enemy.facing = "left";
    enemy.state = "idle";
    enemy.stateTimer = 0;
    enemy.attackCooldown = 0;
    enemy.flash = 0;
    enemy.kx = 0;
    enemy.ky = 0;

    damageCooldown = 0;
    shake = 0;
    victoryTimer = 0;
    gameState = "playing";

    stats.survived = 0;
    stats.hitsTaken = 0;

    particles.length = 0;
    numbers.length = 0;
    uiButtons = [];

    resetJoystick();
}

// ======================
// RESTART BUTTON
// ======================

document.getElementById("refreshButton").addEventListener("click", function (event) {

    event.currentTarget.blur();

    restartGame();
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

    // Reset directions

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

// ======================
// MOBILE ATTACK
// ======================

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

// ======================
// GAME LOOP
// ======================

let lastTime = performance.now();

function gameLoop(timestamp) {

    const dt = Math.min((timestamp - lastTime) / 1000, 0.05);

    lastTime = timestamp;

    update(dt);

    draw();

    requestAnimationFrame(gameLoop);
}

// ======================
// DRAW
// ======================

function draw() {

    ctx.clearRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);

    ctx.save();

    // Screen shake

    if (shake > 0.1) {

        ctx.translate(
            (Math.random() - 0.5) * shake,
            (Math.random() - 0.5) * shake
        );
    }

    drawMap();
    drawTorchLights();
    drawParticles();
    drawPlayer();
    drawEnemy();
    drawNumbers();

    ctx.restore();

    drawLighting();
    drawHUD();
    drawOverlays();
}

requestAnimationFrame(gameLoop);
