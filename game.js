const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

canvas.width = 800;
canvas.height = 500;

// ======================
// GAME STATE
// ======================

let gameOver = false;

// ======================
// MAP
// ======================

const tileSize = 50;

const map = [
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
    [1, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 0, 0, 0, 0, 1],
    [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 1],
    [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 1],
    [1, 0, 0, 0, 1, 1, 1, 0, 1, 0, 1, 0, 0, 0, 0, 1],
    [1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 1, 0, 0, 0, 0, 1],
    [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1],
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
];

// ======================
// PLAYER
// ======================

const player = {
    x: 100,
    y: 100,
    width: 40,
    height: 40,
    speed: 5,
    health: 100,
    direction: "right"
};

let damageCooldown = 0;

// ======================
// ENEMY
// ======================

const enemy = {
    x: 600,
    y: 150,
    width: 40,
    height: 40,
    speed: 2,
    health: 100
};

// ======================
// ATTACK
// ======================

let attacking = false;
let attackCooldown = 0;

// ======================
// KEYBOARD
// ======================

const keys = {};

document.addEventListener("keydown", (event) => {

    keys[event.key.toLowerCase()] = true;

    if (event.code === "Space") {
        attacking = true;
    }
});

document.addEventListener("keyup", (event) => {

    keys[event.key.toLowerCase()] = false;

    if (event.code === "Space") {
        attacking = false;
    }
});

// ======================
// MAP COLLISION
// ======================

function isColliding(x, y, width = player.width, height = player.height) {

    const left = Math.floor(x / tileSize);
    const right = Math.floor((x + width - 1) / tileSize);

    const top = Math.floor(y / tileSize);
    const bottom = Math.floor((y + height - 1) / tileSize);

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

    return false;
}

// ======================
// PLAYER + ENEMY COLLISION
// ======================

function isPlayerTouchingEnemy() {

    return (
        player.x < enemy.x + enemy.width &&
        player.x + player.width > enemy.x &&
        player.y < enemy.y + enemy.height &&
        player.y + player.height > enemy.y
    );
}

// ======================
// ATTACK ENEMY
// ======================

function attackEnemy() {

    if (attackCooldown > 0) {
        attackCooldown--;
    }

    if (!attacking || enemy.health <= 0) {
        return;
    }

    if (attackCooldown > 0) {
        return;
    }

    const attackRange = 30;

    let attackBox = {
        x: player.x,
        y: player.y,
        width: player.width,
        height: player.height
    };

    if (player.direction === "right") {

        attackBox.x = player.x + player.width;
        attackBox.y = player.y + 5;
        attackBox.width = attackRange;
        attackBox.height = player.height - 10;

    }

    if (player.direction === "left") {

        attackBox.x = player.x - attackRange;
        attackBox.y = player.y + 5;
        attackBox.width = attackRange;
        attackBox.height = player.height - 10;

    }

    if (player.direction === "down") {

        attackBox.x = player.x + 5;
        attackBox.y = player.y + player.height;
        attackBox.width = player.width - 10;
        attackBox.height = attackRange;

    }

    if (player.direction === "up") {

        attackBox.x = player.x + 5;
        attackBox.y = player.y - attackRange;
        attackBox.width = player.width - 10;
        attackBox.height = attackRange;

    }

    if (
        attackBox.x < enemy.x + enemy.width &&
        attackBox.x + attackBox.width > enemy.x &&
        attackBox.y < enemy.y + enemy.height &&
        attackBox.y + attackBox.height > enemy.y
    ) {

        enemy.health -= 20;

        attackCooldown = 20;

        if (enemy.health < 0) {
            enemy.health = 0;
        }
    }
}
// ======================
// UPDATE
// ======================

function update() {

    if (gameOver) {
        return;
    }

    // ----------------------
    // PLAYER MOVEMENT
    // ----------------------

    let newX = player.x;
    let newY = player.y;

   if (keys["w"] || keys["arrowup"]) {
    newY -= player.speed;
    player.direction = "up";
}

if (keys["s"] || keys["arrowdown"]) {
    newY += player.speed;
    player.direction = "down";
}

if (keys["a"] || keys["arrowleft"]) {
    newX -= player.speed;
    player.direction = "left";
}

if (keys["d"] || keys["arrowright"]) {
    newX += player.speed;
    player.direction = "right";
}

    // Horizontal collision

    if (!isColliding(newX, player.y)) {
        player.x = newX;
    }

    // Vertical collision

    if (!isColliding(player.x, newY)) {
        player.y = newY;
    }

    // ----------------------
    // ATTACK
    // ----------------------

    attackEnemy();

    // ----------------------
    // ENEMY MOVEMENT
    // ----------------------

    if (enemy.health > 0) {

        let enemyNewX = enemy.x;
        let enemyNewY = enemy.y;

        if (player.x > enemy.x) {
            enemyNewX += enemy.speed;
        }

        if (player.x < enemy.x) {
            enemyNewX -= enemy.speed;
        }

        if (player.y > enemy.y) {
            enemyNewY += enemy.speed;
        }

        if (player.y < enemy.y) {
            enemyNewY -= enemy.speed;
        }

        // Enemy horizontal collision

        if (
            !isColliding(
                enemyNewX,
                enemy.y,
                enemy.width,
                enemy.height
            )
        ) {
            enemy.x = enemyNewX;
        }

        // Enemy vertical collision

        if (
            !isColliding(
                enemy.x,
                enemyNewY,
                enemy.width,
                enemy.height
            )
        ) {
            enemy.y = enemyNewY;
        }
    }

    // ----------------------
    // ENEMY DAMAGE
    // ----------------------

    if (damageCooldown > 0) {
        damageCooldown--;
    }

    if (
        isPlayerTouchingEnemy() &&
        damageCooldown === 0 &&
        enemy.health > 0
    ) {

        player.health -= 10;

        damageCooldown = 30;

        if (player.health <= 0) {
            player.health = 0;
            gameOver = true;
        }
    }
}

// ======================
// DRAW MAP
// ======================

function drawMap() {

    // =========================
    // BASE WORLD
    // =========================

    ctx.fillStyle = "#294d2c";
    ctx.fillRect(0, 0, canvas.width, canvas.height);


    // =========================
    // TILES
    // =========================

    for (let row = 0; row < map.length; row++) {

        for (let column = 0; column < map[row].length; column++) {

            const tile = map[row][column];

            const x = column * tileSize;
            const y = row * tileSize;


            // -------------------------
            // GRASS
            // -------------------------

            if (tile === 0) {

                ctx.fillStyle = "#315d34";

                ctx.fillRect(
                    x,
                    y,
                    tileSize,
                    tileSize
                );

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


            // -------------------------
            // STONE WALL
            // -------------------------

            if (tile === 1) {

                ctx.fillStyle = "#363636";

                ctx.fillRect(
                    x,
                    y,
                    tileSize,
                    tileSize
                );

                // Top highlight

                ctx.fillStyle = "#505050";

                ctx.fillRect(
                    x + 2,
                    y + 2,
                    tileSize - 4,
                    7
                );

                // Bottom shadow

                ctx.fillStyle = "#202020";

                ctx.fillRect(
                    x + 2,
                    y + 41,
                    tileSize - 4,
                    7
                );

                // Stone cracks

                ctx.fillStyle = "#181818";

                ctx.fillRect(
                    x + 8,
                    y + 19,
                    13,
                    2
                );

                ctx.fillRect(
                    x + 18,
                    y + 20,
                    2,
                    9
                );

                ctx.fillRect(
                    x + 32,
                    y + 13,
                    9,
                    2
                );

                ctx.fillRect(
                    x + 34,
                    y + 14,
                    2,
                    7
                );
            }
        }
    }


    // =========================
    // DIRT PATH
    // =========================

    ctx.fillStyle = "#6b5136";

    ctx.fillRect(
        50,
        275,
        700,
        45
    );

    ctx.fillStyle = "#806346";

    ctx.fillRect(
        50,
        282,
        700,
        30
    );


    // Little dirt marks

    ctx.fillStyle = "#59422c";

    ctx.fillRect(120, 290, 15, 4);
    ctx.fillRect(240, 300, 9, 3);
    ctx.fillRect(390, 286, 13, 4);
    ctx.fillRect(520, 302, 18, 3);
    ctx.fillRect(650, 291, 10, 4);


    // =========================
    // WATER
    // =========================

    ctx.fillStyle = "#193f52";

    ctx.fillRect(
        400,
        50,
        200,
        100
    );

    ctx.fillStyle = "#245b70";

    for (let y = 60; y < 145; y += 20) {

        ctx.fillRect(
            410,
            y,
            45,
            3
        );

        ctx.fillRect(
            480,
            y + 7,
            55,
            3
        );

        ctx.fillRect(
            560,
            y,
            25,
            3
        );
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

    ctx.fillRect(
        x - 15,
        y + 30,
        45,
        10
    );

    // Trunk

    ctx.fillStyle = "#4b3020";

    ctx.fillRect(
        x,
        y,
        15,
        35
    );

    // Dark leaves

    ctx.fillStyle = "#163d20";

    ctx.fillRect(
        x - 15,
        y - 15,
        45,
        25
    );

    ctx.fillRect(
        x - 8,
        y - 25,
        30,
        20
    );

    // Light leaves

    ctx.fillStyle = "#285b2d";

    ctx.fillRect(
        x - 8,
        y - 18,
        25,
        12
    );

    ctx.fillRect(
        x - 3,
        y - 28,
        18,
        12
    );
}


function drawRock(x, y) {

    // Shadow

    ctx.fillStyle = "rgba(0, 0, 0, 0.3)";

    ctx.fillRect(
        x - 5,
        y + 12,
        35,
        8
    );

    // Rock

    ctx.fillStyle = "#555";

    ctx.fillRect(
        x,
        y,
        30,
        15
    );

    ctx.fillRect(
        x + 5,
        y - 5,
        20,
        20
    );

    // Highlight

    ctx.fillStyle = "#707070";

    ctx.fillRect(
        x + 7,
        y - 2,
        10,
        5
    );
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

    ctx.fillRect(
        x,
        y,
        6,
        30
    );

    // Fire

    ctx.fillStyle = "#ff9d22";

    ctx.fillRect(
        x - 4,
        y - 12,
        14,
        14
    );

    ctx.fillStyle = "#ffe36b";

    ctx.fillRect(
        x - 1,
        y - 9,
        8,
        9
    );
}
function drawRock(x, y) {

    // Shadow

    ctx.fillStyle = "rgba(0, 0, 0, 0.3)";

    ctx.fillRect(
        x - 5,
        y + 12,
        35,
        8
    );


    // Rock

    ctx.fillStyle = "#555";

    ctx.fillRect(
        x,
        y,
        30,
        15
    );

    ctx.fillRect(
        x + 5,
        y - 5,
        20,
        20
    );


    // Highlight

    ctx.fillStyle = "#707070";

    ctx.fillRect(
        x + 7,
        y - 2,
        10,
        5
    );
}
function drawGrass(x, y) {

    ctx.fillStyle = "#4c7c45";

    ctx.fillRect(x, y, 3, 10);

    ctx.fillRect(x + 5, y - 4, 3, 14);

    ctx.fillRect(x + 10, y + 2, 3, 8);
}

// ======================
// DRAW PLAYER
// ======================

function drawPlayer() {

    const x = player.x;
    const y = player.y;

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

    // ===== MASSIVE SWORD =====

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

// ======================
// DRAW ENEMY
// ======================

function drawEnemy() {

    if (enemy.health <= 0) {
        return;
    }

    const x = enemy.x;
    const y = enemy.y;

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

    // ===== HEALTH BAR =====

    ctx.fillStyle = "darkred";

    ctx.fillRect(
        x,
        y - 10,
        enemy.width,
        5
    );

    ctx.fillStyle = "lime";

    ctx.fillRect(
        x,
        y - 10,
        enemy.width * (enemy.health / 100),
        5
    );
}

// ======================
// DRAW PLAYER HEALTH
// ======================

function drawHealthBar() {

    const barWidth = 200;
    const barHeight = 20;

    const x = 20;
    const y = 20;

    // Background

    ctx.fillStyle = "darkred";

    ctx.fillRect(
        x,
        y,
        barWidth,
        barHeight
    );

    // Current health

    ctx.fillStyle = "lime";

    ctx.fillRect(
        x,
        y,
        barWidth * (player.health / 100),
        barHeight
    );

    // Border

    ctx.strokeStyle = "white";

    ctx.strokeRect(
        x,
        y,
        barWidth,
        barHeight
    );
}

// ======================
// GAME OVER
// ======================

function drawGameOver() {

    if (!gameOver) {
        return;
    }

    // Dark overlay

    ctx.fillStyle = "rgba(0, 0, 0, 0.7)";

    ctx.fillRect(
        0,
        0,
        canvas.width,
        canvas.height
    );

    // Text

    ctx.fillStyle = "white";

    ctx.font = "60px Arial";

    ctx.textAlign = "center";

    ctx.fillText(
        "GAME OVER",
        canvas.width / 2,
        canvas.height / 2 - 30
    );

    // Restart button

    ctx.fillStyle = "#3498db";

    ctx.fillRect(
        canvas.width / 2 - 100,
        canvas.height / 2 + 20,
        200,
        60
    );

    ctx.fillStyle = "white";

    ctx.font = "25px Arial";

    ctx.fillText(
        "PLAY AGAIN",
        canvas.width / 2,
        canvas.height / 2 + 58
    );
}

// ======================
// DRAW
// ======================

function draw() {

    ctx.clearRect(
        0,
        0,
        canvas.width,
        canvas.height
    );

    drawMap();

    drawPlayer();

    drawEnemy();

    drawHealthBar();

    drawGameOver();

    drawLighting();
  
}
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

    gradient.addColorStop(
        0,
        "rgba(0, 0, 0, 0)"
    );

    gradient.addColorStop(
        1,
        "rgba(0, 0, 0, 0.55)"
    );

    ctx.fillStyle = gradient;

    ctx.fillRect(
        0,
        0,
        canvas.width,
        canvas.height
    );
}
// ======================
// RESTART
// ======================

function restartGame() {

    player.x = 100;
    player.y = 100;

    player.health = 100;

    enemy.x = 600;
    enemy.y = 150;

    enemy.health = 100;

    damageCooldown = 0;
    attackCooldown = 0;

    attacking = false;

    gameOver = false;
}

// ======================
// RESTART BUTTON
// ======================

canvas.addEventListener("click", function(event) {

    if (!gameOver) {
        return;
    }

    const rect = canvas.getBoundingClientRect();

    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;

    const buttonX = canvas.width / 2 - 100;
    const buttonY = canvas.height / 2 + 20;
    const buttonWidth = 200;
    const buttonHeight = 60;

    if (
        mouseX >= buttonX &&
        mouseX <= buttonX + buttonWidth &&
        mouseY >= buttonY &&
        mouseY <= buttonY + buttonHeight
    ) {

        restartGame();
    }
});

// ======================
// GAME LOOP
// ======================

function gameLoop() {

    update();

    draw();

    requestAnimationFrame(gameLoop);
}

gameLoop();
document
    .getElementById("refreshButton")
    .addEventListener("click", function () {

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

    const distance = Math.sqrt(
        dx * dx + dy * dy
    );

    if (distance > maxDistance) {

        dx = (dx / distance) * maxDistance;
        dy = (dy / distance) * maxDistance;
    }

    joystickKnob.style.left =
        (31 + dx) + "px";

    joystickKnob.style.top =
        (31 + dy) + "px";

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

joystick.addEventListener(
    "pointerdown",
    function(event) {

        joystickActive = true;

        joystick.setPointerCapture(event.pointerId);

        moveJoystick(event);
    }
);

joystick.addEventListener(
    "pointermove",
    function(event) {

        if (joystickActive) {
            moveJoystick(event);
        }
    }
);

joystick.addEventListener(
    "pointerup",
    function() {

        resetJoystick();
    }
);

joystick.addEventListener(
    "pointercancel",
    function() {

        resetJoystick();
    }
);


// ======================
// MOBILE ATTACK
// ======================

attackButton.addEventListener(
    "pointerdown",
    function(event) {

        event.preventDefault();

        attacking = true;
    }
);

attackButton.addEventListener(
    "pointerup",
    function(event) {

        event.preventDefault();

        attacking = false;
    }
);

attackButton.addEventListener(
    "pointercancel",
    function() {

        attacking = false;
    }
);