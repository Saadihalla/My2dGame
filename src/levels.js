// ======================
// LEVELS (maps, decor, palettes)
// ======================

import { TILE, ctx, VIEW_WIDTH, VIEW_HEIGHT } from "./config.js";
import { isColliding as rectCollides } from "./logic/collision.js";
import { LEVELS } from "./logic/levelData.js";

export { aabb } from "./logic/collision.js";
export { LEVELS };

export let levelIndex = 0;
export let currentLevel = null;
export let currentMap = [];
export let solidObjects = [];

let currentTorches = [];

export function buildLevel(index) {
    levelIndex = index;
    currentLevel = LEVELS[index];

    currentMap = [];
    for (const line of currentLevel.tiles) {
        const row = [];
        for (const ch of line) {
            row.push(ch === "#" ? 1 : 0);
        }
        currentMap.push(row);
    }

    solidObjects = [];
    currentTorches = [];

    for (const water of currentLevel.water) {
        solidObjects.push(water);
    }

    for (const tree of currentLevel.trees) {
        solidObjects.push({ x: tree[0] - 10, y: tree[1] - 16, w: 38, h: 52 });
    }

    for (const rock of currentLevel.rocks) {
        solidObjects.push({ x: rock[0] - 3, y: rock[1] - 3, w: 32, h: 20 });
    }

    for (const torch of currentLevel.torches) {
        currentTorches.push({ x: torch[0], y: torch[1] });
    }
}

// ======================
// COLLISION
// ======================

export function isColliding(x, y, width, height) {
    return rectCollides(x, y, width, height, currentMap, solidObjects, TILE);
}

// ======================
// DRAW MAP
// ======================

function drawGrassTile(x, y, p) {
    ctx.fillStyle = p.grass;
    ctx.fillRect(x, y, TILE, TILE);

    ctx.fillStyle = p.grassLight;

    ctx.fillRect(x + 7, y + 9, 3, 3);
    ctx.fillRect(x + 31, y + 13, 2, 3);
    ctx.fillRect(x + 18, y + 34, 3, 2);
    ctx.fillRect(x + 40, y + 27, 2, 3);

    ctx.fillStyle = p.grassDark;

    ctx.fillRect(x + 12, y + 25, 2, 5);
    ctx.fillRect(x + 34, y + 39, 3, 2);
}

function drawStoneTile(x, y, p) {
    ctx.fillStyle = p.wall;
    ctx.fillRect(x, y, TILE, TILE);

    ctx.fillStyle = p.wallLight;
    ctx.fillRect(x + 2, y + 2, TILE - 4, 7);

    ctx.fillStyle = p.wallDark;
    ctx.fillRect(x + 2, y + 41, TILE - 4, 7);

    ctx.fillStyle = p.wallCrack;

    ctx.fillRect(x + 8, y + 19, 13, 2);
    ctx.fillRect(x + 18, y + 20, 2, 9);
    ctx.fillRect(x + 32, y + 13, 9, 2);
    ctx.fillRect(x + 34, y + 14, 2, 7);
}

function drawTree(x, y) {
    ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
    ctx.fillRect(x - 15, y + 30, 45, 10);

    ctx.fillStyle = "#4b3020";
    ctx.fillRect(x, y, 15, 35);

    ctx.fillStyle = "#163d20";
    ctx.fillRect(x - 15, y - 15, 45, 25);
    ctx.fillRect(x - 8, y - 25, 30, 20);

    ctx.fillStyle = "#285b2d";
    ctx.fillRect(x - 8, y - 18, 25, 12);
    ctx.fillRect(x - 3, y - 28, 18, 12);
}

function drawRock(x, y) {
    ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
    ctx.fillRect(x - 5, y + 12, 35, 8);

    ctx.fillStyle = "#555";
    ctx.fillRect(x, y, 30, 15);
    ctx.fillRect(x + 5, y - 5, 20, 20);

    ctx.fillStyle = "#707070";
    ctx.fillRect(x + 7, y - 2, 10, 5);
}

function drawGrass(x, y) {
    ctx.fillStyle = "#4c7c45";

    ctx.fillRect(x, y, 3, 10);
    ctx.fillRect(x + 5, y - 4, 3, 14);
    ctx.fillRect(x + 10, y + 2, 3, 8);
}

function drawTorch(x, y, time) {
    ctx.fillStyle = "#4a2d1c";
    ctx.fillRect(x, y, 6, 30);

    const flicker = Math.sin(time * 13 + x) * 2.5;

    ctx.fillStyle = "#ff9d22";
    ctx.fillRect(x - 4, y - 12 - flicker * 0.4, 14, 14 + flicker);

    ctx.fillStyle = "#ffe36b";
    ctx.fillRect(x - 1, y - 9 - flicker * 0.4, 8, 9 + flicker);
}

export function drawMap(time) {
    const p = currentLevel.palette;

    ctx.fillStyle = p.base;
    ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);

    for (let row = 0; row < currentMap.length; row++) {
        for (let column = 0; column < currentMap[row].length; column++) {
            const x = column * TILE;
            const y = row * TILE;

            if (currentMap[row][column] === 0) {
                drawGrassTile(x, y, p);
            } else {
                drawStoneTile(x, y, p);
            }
        }
    }

    // Dirt path

    if (currentLevel.path) {
        const py = currentLevel.path.y;

        ctx.fillStyle = p.path;
        ctx.fillRect(50, py, 700, 45);

        ctx.fillStyle = p.pathLight;
        ctx.fillRect(50, py + 7, 700, 30);

        ctx.fillStyle = p.pathDark;

        ctx.fillRect(120, py + 15, 15, 4);
        ctx.fillRect(240, py + 25, 9, 3);
        ctx.fillRect(390, py + 11, 13, 4);
        ctx.fillRect(520, py + 27, 18, 3);
        ctx.fillRect(650, py + 16, 10, 4);

        // Redraw walls under the path so they stay visible

        const startRow = Math.floor(py / TILE);
        const endRow = Math.floor((py + 45) / TILE);

        for (let row = startRow; row <= endRow; row++) {
            for (let column = 1; column <= 14; column++) {
                if (currentMap[row][column] === 1) {
                    drawStoneTile(column * TILE, row * TILE, p);
                }
            }
        }
    }

    // Water

    for (const water of currentLevel.water) {
        ctx.fillStyle = p.water;
        ctx.fillRect(water.x, water.y, water.w, water.h);

        ctx.fillStyle = p.waterLight;

        for (let y = water.y + 10; y < water.y + water.h - 5; y += 20) {
            ctx.fillRect(water.x + 10, y, water.w * 0.22, 3);
            ctx.fillRect(water.x + water.w * 0.45, y + 7, water.w * 0.27, 3);
            ctx.fillRect(water.x + water.w * 0.78, y, water.w * 0.12, 3);
        }
    }

    // Trees / rocks / grass tufts

    for (const tree of currentLevel.trees) {
        drawTree(tree[0], tree[1]);
    }

    for (const rock of currentLevel.rocks) {
        drawRock(rock[0], rock[1]);
    }

    for (const grass of currentLevel.grass) {
        drawGrass(grass[0], grass[1]);
    }

    // Torches

    for (const torch of currentLevel.torches) {
        drawTorch(torch[0], torch[1], time);
    }
}

// ======================
// TORCH LIGHT
// ======================

export function drawTorchLights(time) {
    ctx.globalCompositeOperation = "lighter";

    for (const torch of currentTorches) {
        const flicker = Math.sin(time * 9 + torch.x) * 10;
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