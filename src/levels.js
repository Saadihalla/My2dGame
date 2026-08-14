// ======================
// LEVELS (maps, decor, palettes)
// ======================

import { TILE, ctx, VIEW_WIDTH, VIEW_HEIGHT } from "./config.js";
import { isColliding as rectCollides } from "./logic/collision.js";
import { LEVELS } from "./logic/levelData.js";
import { camera } from "./state.js";
import { isInView } from "./logic/camera.js";
import { Assets } from "./assets.js";
import { getAnimationFrame } from "./logic/frames.js";

export { aabb } from "./logic/collision.js";
export { LEVELS };

export let levelIndex = 0;
export let currentLevel = null;
export let currentMap = [];
export let solidObjects = [];

let currentTorches = [];
let mapCanvas = null;
let mapCtx = null;

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

    // Pre-render static tiles to offscreen canvas
    const worldW = currentLevel.cols * TILE;
    const worldH = currentLevel.rows * TILE;

    mapCanvas = document.createElement("canvas");
    mapCanvas.width = worldW;
    mapCanvas.height = worldH;
    mapCtx = mapCanvas.getContext("2d");

    preRenderMap();
}

// ======================
// COLLISION
// ======================

export function isColliding(x, y, width, height) {
    return rectCollides(x, y, width, height, currentMap, solidObjects, TILE);
}

// ======================
// PRE-RENDER MAP
// ======================

function drawGrassTile(gctx, x, y, p) {
    gctx.fillStyle = p.grass;
    gctx.fillRect(x, y, TILE, TILE);

    gctx.fillStyle = p.grassLight;
    gctx.fillRect(x + 7, y + 9, 3, 3);
    gctx.fillRect(x + 31, y + 13, 2, 3);
    gctx.fillRect(x + 18, y + 34, 3, 2);
    gctx.fillRect(x + 40, y + 27, 2, 3);

    gctx.fillStyle = p.grassDark;
    gctx.fillRect(x + 12, y + 25, 2, 5);
    gctx.fillRect(x + 34, y + 39, 3, 2);
}

function drawStoneTile(gctx, x, y, p) {
    gctx.fillStyle = p.wall;
    gctx.fillRect(x, y, TILE, TILE);

    gctx.fillStyle = p.wallLight;
    gctx.fillRect(x + 2, y + 2, TILE - 4, 7);

    gctx.fillStyle = p.wallDark;
    gctx.fillRect(x + 2, y + 41, TILE - 4, 7);

    gctx.fillStyle = p.wallCrack;
    gctx.fillRect(x + 8, y + 19, 13, 2);
    gctx.fillRect(x + 18, y + 20, 2, 9);
    gctx.fillRect(x + 32, y + 13, 9, 2);
    gctx.fillRect(x + 34, y + 14, 2, 7);
}

function drawTree(gctx, x, y) {
    gctx.fillStyle = "rgba(0, 0, 0, 0.3)";
    gctx.fillRect(x - 15, y + 30, 45, 10);

    gctx.fillStyle = "#4b3020";
    gctx.fillRect(x, y, 15, 35);

    gctx.fillStyle = "#163d20";
    gctx.fillRect(x - 15, y - 15, 45, 25);
    gctx.fillRect(x - 8, y - 25, 30, 20);

    gctx.fillStyle = "#285b2d";
    gctx.fillRect(x - 8, y - 18, 25, 12);
    gctx.fillRect(x - 3, y - 28, 18, 12);
}

function drawRock(gctx, x, y) {
    gctx.fillStyle = "rgba(0, 0, 0, 0.3)";
    gctx.fillRect(x - 5, y + 12, 35, 8);

    gctx.fillStyle = "#555";
    gctx.fillRect(x, y, 30, 15);
    gctx.fillRect(x + 5, y - 5, 20, 20);

    gctx.fillStyle = "#707070";
    gctx.fillRect(x + 7, y - 2, 10, 5);
}

function drawGrass(gctx, x, y) {
    gctx.fillStyle = "#4c7c45";
    gctx.fillRect(x, y, 3, 10);
    gctx.fillRect(x + 5, y - 4, 3, 14);
    gctx.fillRect(x + 10, y + 2, 3, 8);
}

function drawTorch(gctx, x, y, time) {
    gctx.fillStyle = "#4a2d1c";
    gctx.fillRect(x, y, 6, 30);

    const flicker = Math.sin(time * 13 + x) * 2.5;

    gctx.fillStyle = "#ff9d22";
    gctx.fillRect(x - 4, y - 12 - flicker * 0.4, 14, 14 + flicker);

    gctx.fillStyle = "#ffe36b";
    gctx.fillRect(x - 1, y - 9 - flicker * 0.4, 8, 9 + flicker);
}

// Torch from the sprite sheet when available (anchored so the flame
// lines up with the light gradient), procedural fallback otherwise.

function drawTorchSprite(gctx, x, y, time) {
    if (Assets.loaded && !Assets.fallbackMode && Assets.spritesheet) {
        const frameData = getAnimationFrame(Assets.spritesheetDef, "torch", "idle", time);

        if (frameData) {
            const frame = frameData.frame;
            const anchor = frameData.anchor;

            gctx.save();
            gctx.imageSmoothingEnabled = false;
            const s = frameData.scale || 1;
            gctx.drawImage(
                Assets.spritesheet,
                frame.x, frame.y, frame.w, frame.h,
                x - anchor.x * s, y - anchor.y * s, frame.w * s, frame.h * s
            );
            gctx.restore();
            return;
        }
    }

    drawTorch(gctx, x, y, time);
}

function preRenderMap() {
    const p = currentLevel.palette;

    mapCtx.fillStyle = p.base;
    mapCtx.fillRect(0, 0, mapCanvas.width, mapCanvas.height);

    for (let row = 0; row < currentMap.length; row++) {
        for (let column = 0; column < currentMap[row].length; column++) {
            const x = column * TILE;
            const y = row * TILE;

            if (currentMap[row][column] === 0) {
                drawGrassTile(mapCtx, x, y, p);
            } else {
                drawStoneTile(mapCtx, x, y, p);
            }
        }
    }

    // Dirt path
    if (currentLevel.path) {
        const py = currentLevel.path.y;
        const pathW = (currentLevel.cols - 2) * TILE;

        mapCtx.fillStyle = p.path;
        mapCtx.fillRect(50, py, pathW, 45);

        mapCtx.fillStyle = p.pathLight;
        mapCtx.fillRect(50, py + 7, pathW, 30);

        mapCtx.fillStyle = p.pathDark;
        for (let px = 120; px < 50 + pathW; px += 150) {
            mapCtx.fillRect(px, py + 15, 15, 4);
            mapCtx.fillRect(px + 60, py + 25, 9, 3);
        }

        // Redraw walls under the path so they stay visible
        const startRow = Math.floor(py / TILE);
        const endRow = Math.floor((py + 45) / TILE);

        for (let row = startRow; row <= endRow; row++) {
            for (let column = 1; column <= currentLevel.cols - 2; column++) {
                if (currentMap[row][column] === 1) {
                    drawStoneTile(mapCtx, column * TILE, row * TILE, p);
                }
            }
        }
    }

    // Water
    for (const water of currentLevel.water) {
        mapCtx.fillStyle = p.water;
        mapCtx.fillRect(water.x, water.y, water.w, water.h);

        mapCtx.fillStyle = p.waterLight;
        for (let y = water.y + 10; y < water.y + water.h - 5; y += 20) {
            mapCtx.fillRect(water.x + 10, y, water.w * 0.22, 3);
            mapCtx.fillRect(water.x + water.w * 0.45, y + 7, water.w * 0.27, 3);
            mapCtx.fillRect(water.x + water.w * 0.78, y, water.w * 0.12, 3);
        }
    }

    // Trees / rocks / grass tufts
    for (const tree of currentLevel.trees) {
        drawTree(mapCtx, tree[0], tree[1]);
    }

    for (const rock of currentLevel.rocks) {
        drawRock(mapCtx, rock[0], rock[1]);
    }

    for (const grass of currentLevel.grass) {
        drawGrass(mapCtx, grass[0], grass[1]);
    }
}

// ======================
// DRAW MAP
// ======================

export function drawMap(time) {
    if (!mapCanvas) {
        return;
    }

    // Draw pre-rendered static map
    ctx.drawImage(mapCanvas, 0, 0);

    // Draw dynamic torches (only those in view)
    const viewW = VIEW_WIDTH;
    const viewH = VIEW_HEIGHT;
    const margin = 50;

    for (const torch of currentLevel.torches) {
        if (isInView(torch[0] - 10, torch[1] - 15, 26, 45, camera.x, camera.y, viewW, viewH, margin)) {
            drawTorchSprite(ctx, torch[0], torch[1], time);
        }
    }
}

// ======================
// TORCH LIGHT
// ======================

export function drawTorchLights(time) {
    ctx.globalCompositeOperation = "lighter";

    const viewW = VIEW_WIDTH;
    const viewH = VIEW_HEIGHT;
    const margin = 150; // Larger margin to allow light halo to spill into view smoothly

    for (const torch of currentTorches) {
        if (isInView(torch.x - 120, torch.y - 120, 240, 240, camera.x, camera.y, viewW, viewH, margin)) {
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
    }

    ctx.globalCompositeOperation = "source-over";
}