// ======================
// SPAWN POINT SELECTION (pure)
// ======================

import { isColliding } from "./collision.js";

const SPAWN_SIZE = 40;
const DEFAULT_TILE_SIZE = 50;

export function findSpawnPoints(map, solids, player, count, options) {
    const opts = options || {};
    const bounds = opts.bounds || { x: 60, y: 60, w: 640, h: 380 };
    const minPlayerDist = opts.minPlayerDist !== undefined ? opts.minPlayerDist : 160;
    const minSep = opts.minSep !== undefined ? opts.minSep : 60;
    const maxAttempts = opts.maxAttempts !== undefined ? opts.maxAttempts : 200;
    const tileSize = opts.tileSize || DEFAULT_TILE_SIZE;

    const points = collect(
        map, solids, player, count,
        bounds, minPlayerDist, minSep, maxAttempts, tileSize
    );

    // Relaxed pass: if the strict constraints could not fill the wave,
    // allow spawning closer to the player and to each other.

    if (points.length < count) {
        const relaxed = collect(
            map, solids, player, count - points.length,
            bounds, minPlayerDist * 0.5, minSep * 0.5, maxAttempts, tileSize
        );

        for (const p of relaxed) {
            if (!tooClose(p, points, minSep)) {
                points.push(p);
            }
        }
    }

    // Last resort: scan tiles for any open spot (never return empty
    // while open space exists — avoids undefined-point crashes).

    if (points.length === 0) {
        const fallback = findAnyOpenSpot(map, solids, bounds, tileSize);
        if (fallback) {
            points.push(fallback);
        }
    }

    return points;
}

function collect(map, solids, player, count, bounds, minPlayerDist, minSep, maxAttempts, tileSize) {
    const points = [];

    for (let attempt = 0; attempt < maxAttempts && points.length < count; attempt++) {
        const x = bounds.x + Math.random() * bounds.w;
        const y = bounds.y + Math.random() * bounds.h;

        if (isColliding(x, y, SPAWN_SIZE, SPAWN_SIZE, map, solids, tileSize)) {
            continue;
        }

        const dx = x - player.x;
        const dy = y - player.y;

        if (Math.hypot(dx, dy) < minPlayerDist) {
            continue;
        }

        if (tooClose({ x: x, y: y }, points, minSep)) {
            continue;
        }

        points.push({ x: x, y: y });
    }

    return points;
}

function tooClose(point, points, minSep) {
    for (const p of points) {
        if (Math.hypot(p.x - point.x, p.y - point.y) < minSep) {
            return true;
        }
    }
    return false;
}

function findAnyOpenSpot(map, solids, bounds, tileSize) {
    for (let row = 0; row < map.length; row++) {
        for (let column = 0; column < map[row].length; column++) {
            const x = column * tileSize + (tileSize - SPAWN_SIZE) / 2;
            const y = row * tileSize + (tileSize - SPAWN_SIZE) / 2;

            if (x < bounds.x || x > bounds.x + bounds.w || y < bounds.y || y > bounds.y + bounds.h) {
                continue;
            }

            if (!isColliding(x, y, SPAWN_SIZE, SPAWN_SIZE, map, solids, tileSize)) {
                return { x: x, y: y };
            }
        }
    }

    return null;
}