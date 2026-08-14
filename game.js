// ======================
// GAME (state machine, waves, loop)
// ======================

let gameState = "title"; // "title" | "playing" | "paused" | "gameover" | "victory"
let gameTime = 0;

let wave = 1;
let waveState = "break"; // "break" | "active" | "clear" | "portal"
let waveTimer = 0;
let portalActive = false;
let portalTimer = 0;

let stats = {
    score: 0,
    kills: 0,
    hitsTaken: 0,
    survived: 0
};

let highScore = 0;
let newHighScore = false;

try {
    highScore = parseInt(localStorage.getItem("darkFantasyHighScore") || "0", 10) || 0;
} catch (e) {
    highScore = 0;
}

function saveHighScore() {
    if (stats.score <= highScore) {
        return;
    }

    highScore = stats.score;
    newHighScore = true;

    try {
        localStorage.setItem("darkFantasyHighScore", String(highScore));
    } catch (e) {
        // storage unavailable — ignore
    }
}

function addScore(amount) {
    stats.score += amount;
}

// ======================
// WAVES
// ======================

function waveEnemyList(waveNumber) {
    const list = [];

    const grunts = 2 + Math.floor(waveNumber * 1.2);
    for (let i = 0; i < grunts; i++) {
        list.push("grunt");
    }

    if (waveNumber >= 2) {
        const fasts = 1 + Math.floor((waveNumber - 1) / 2);
        for (let i = 0; i < fasts; i++) {
            list.push("fast");
        }
    }

    if (waveNumber >= 4) {
        const tanks = 1 + Math.floor((waveNumber - 3) / 3);
        for (let i = 0; i < tanks; i++) {
            list.push("tank");
        }
    }

    if (waveNumber % 5 === 0) {
        list.push("boss");
    }

    return list;
}

function pickSpawnPoints(count) {
    const points = [];

    for (let attempt = 0; attempt < 200 && points.length < count; attempt++) {
        const x = 60 + Math.random() * (VIEW_WIDTH - 200);
        const y = 60 + Math.random() * (VIEW_HEIGHT - 120);
        const w = 40;
        const h = 40;

        if (isColliding(x, y, w, h)) {
            continue;
        }

        const dx = x - player.x;
        const dy = y - player.y;

        if (Math.hypot(dx, dy) < 160) {
            continue;
        }

        let tooClose = false;
        for (const p of points) {
            if (Math.hypot(p.x - x, p.y - y) < 60) {
                tooClose = true;
                break;
            }
        }

        if (!tooClose) {
            points.push({ x: x, y: y });
        }
    }

    return points;
}

function spawnWave(waveNumber) {
    enemies.length = 0;

    const list = waveEnemyList(waveNumber);
    const points = pickSpawnPoints(list.length);
    const hpScale = 1 + (waveNumber - 1) * 0.12;

    for (let i = 0; i < list.length; i++) {
        const point = points[i % Math.max(1, points.length)];
        spawnEnemy(list[i], point.x, point.y, hpScale);
    }

    if (waveNumber % 5 === 0) {
        showBanner("BOSS APPROACHES", "Wave " + waveNumber, 3);
        AudioFX.boss();
    } else {
        showBanner("WAVE " + waveNumber, "", 2);
        AudioFX.wave();
    }

    waveState = "active";
}

function updateWaves(dt) {
    if (waveState === "break") {

        waveTimer -= dt;
        if (waveTimer <= 0) {
            spawnWave(wave);
        }

    } else if (waveState === "active") {

        if (allEnemiesDead()) {
            const bonus = 150 * wave;
            addScore(bonus);

            AudioFX.clear();
            showBanner("WAVE " + wave + " CLEARED", "+" + bonus + " points", 2);

            waveState = "clear";
            waveTimer = WAVE_CLEAR_TIME;
            portalActive = true;
            portalTimer = PORTAL_TIME;
        }

    } else if (waveState === "clear") {

        waveTimer -= dt;
        if (waveTimer <= 0) {
            if (wave >= WAVE_VICTORY) {
                victory();
            } else {
                waveState = "portal";
            }
        }

    } else if (waveState === "portal") {

        portalTimer -= dt;

        const portalRect = {
            x: currentLevel.portal.x - 25,
            y: currentLevel.portal.y - 25,
            w: 50,
            h: 50
        };
        const playerRect = {
            x: player.x,
            y: player.y,
            w: player.width,
            h: player.height
        };

        if (aabb(portalRect, playerRect) || portalTimer <= 0) {
            advanceLevel();
        }
    }
}

function advanceLevel() {
    AudioFX.portal();

    levelIndex = (levelIndex + 1) % LEVELS.length;
    buildLevel(levelIndex);

    portalActive = false;

    player.x = currentLevel.spawn.x;
    player.y = currentLevel.spawn.y;
    player.health = Math.min(player.maxHealth, player.health + LEVEL_HEAL);

    wave++;
    waveState = "break";
    waveTimer = WAVE_BREAK_TIME;

    addScore(500);
    showBanner("LEVEL " + (levelIndex + 1), currentLevel.name + " · +500", 3);
}

// ======================
// GAME FLOW
// ======================

function resetRun() {
    buildLevel(0);

    player.maxHealth = PLAYER_BASE_HEALTH;
    player.health = PLAYER_BASE_HEALTH;
    player.damage = ATTACK_BASE_DAMAGE;
    player.range = ATTACK_BASE_RANGE;
    player.level = 1;
    player.xp = 0;
    player.xpNext = LEVEL_XP_BASE;
    resetPlayer();

    enemies.length = 0;
    loot.length = 0;

    wave = 1;
    waveState = "break";
    waveTimer = 1.5;
    portalActive = false;
    portalTimer = 0;

    stats.score = 0;
    stats.kills = 0;
    stats.hitsTaken = 0;
    stats.survived = 0;

    newHighScore = false;

    clearFX();
    banners.length = 0;
}

function startGame() {
    resetRun();
    gameState = "playing";
    setButtons([]);
}

function restartGame() {
    startGame();
}

function goTitle() {
    gameState = "title";
    enemies.length = 0;
    loot.length = 0;
    setButtons([
        makeButton("START", startGame, 250)
    ]);
}

function togglePause() {
    if (gameState === "playing") {
        gameState = "paused";
        setButtons([
            makeButton("RESUME", togglePause, 220),
            makeButton("RESTART", restartGame, 280),
            makeButton("TITLE", goTitle, 340)
        ]);
    } else if (gameState === "paused") {
        gameState = "playing";
        setButtons([]);
    }
}

function onPlayerDeath() {
    gameState = "gameover";
    saveHighScore();
    AudioFX.kill();
    setButtons([
        makeButton("PLAY AGAIN", restartGame, 250),
        makeButton("TITLE", goTitle, 310)
    ]);
}

function victory() {
    gameState = "victory";
    saveHighScore();
    AudioFX.fanfare();
    setButtons([
        makeButton("PLAY AGAIN", restartGame, 290),
        makeButton("TITLE", goTitle, 350)
    ]);
}

// ======================
// UPDATE
// ======================

function update(dt) {
    gameTime += dt;

    updateFX(dt);
    updateBanners(dt);

    if (gameState !== "playing") {
        return;
    }

    stats.survived += dt;

    if (player.invuln > 0) {
        player.invuln -= dt;
    }

    updatePlayer(dt);
    updateEnemies(dt);
    updateLoot(dt);
    playerAttack(dt);
    updateWaves(dt);
}

// ======================
// DRAW
// ======================

function drawPortal(gameTime) {
    if (!portalActive) {
        return;
    }

    const px = currentLevel.portal.x;
    const py = currentLevel.portal.y;
    const pulse = 0.5 + 0.5 * Math.sin(gameTime * 5);

    ctx.save();
    ctx.globalCompositeOperation = "lighter";

    const gradient = ctx.createRadialGradient(px, py, 4, px, py, 34 + pulse * 6);

    gradient.addColorStop(0, "rgba(255, 220, 90, 0.9)");
    gradient.addColorStop(0.6, "rgba(255, 160, 40, 0.35)");
    gradient.addColorStop(1, "rgba(255, 160, 40, 0)");

    ctx.fillStyle = gradient;
    ctx.fillRect(px - 44, py - 44, 88, 88);

    ctx.restore();

    ctx.fillStyle = "#fff3c4";
    ctx.font = "13px Arial";
    ctx.textAlign = "center";
    ctx.fillText("ENTER PORTAL", px, py + 44);
}

function draw() {
    ctx.clearRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);

    ctx.save();

    if (getShake() > 0.1) {
        const s = getShake();
        ctx.translate(
            (Math.random() - 0.5) * s,
            (Math.random() - 0.5) * s
        );
    }

    drawMap(gameTime);
    drawTorchLights(gameTime);
    drawPortal(gameTime);
    drawLoot(gameTime);
    drawParticles();
    drawPlayer(gameTime);
    drawEnemies(gameTime);
    drawNumbers();

    ctx.restore();

    // Lighting (darkness around the player)

    const centerX = player.x + player.width / 2;
    const centerY = player.y + player.height / 2;

    const gradient = ctx.createRadialGradient(centerX, centerY, 70, centerX, centerY, 380);

    gradient.addColorStop(0, "rgba(0, 0, 0, 0)");
    gradient.addColorStop(1, "rgba(0, 0, 0, 0.55)");

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);

    // Hurt vignette

    drawVignette(Math.max(0, 1 - player.health / player.maxHealth));

    drawHUD();
    drawBanners();
    drawOverlays();
}

// ======================
// RESTART BUTTON
// ======================

document.getElementById("refreshButton").addEventListener("click", function (event) {
    event.currentTarget.blur();
    restartGame();
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

buildLevel(0);
goTitle();

requestAnimationFrame(gameLoop);