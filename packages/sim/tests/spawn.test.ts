import { describe, it, expect } from "vitest";
import { findSpawnPoints } from "../src/spawn.js";
import type { GridMap, Rect, Vec2 } from "../src/types.js";

function makeMap(rows: string[]): GridMap {
    return rows.map(function (line) {
        return line.split("").map(function (ch) {
            return ch === "#" ? 1 : 0;
        });
    });
}

const openMap = makeMap([
    "################",
    "#..............#",
    "#..............#",
    "#..............#",
    "#..............#",
    "#..............#",
    "#..............#",
    "#..............#",
    "#..............#",
    "################"
]);

const player: Vec2 = { x: 400, y: 250 };

describe("findSpawnPoints", () => {
    it("finds the requested number of points on an open map", () => {
        const points = findSpawnPoints(openMap, [], player, 10);
        expect(points).toHaveLength(10);
    });

    it("returns points inside the bounds", () => {
        const points = findSpawnPoints(openMap, [], player, 10, {
            bounds: { x: 60, y: 60, w: 640, h: 380 }
        });

        for (const p of points) {
            expect(p.x).toBeGreaterThanOrEqual(60);
            expect(p.x).toBeLessThanOrEqual(700);
            expect(p.y).toBeGreaterThanOrEqual(60);
            expect(p.y).toBeLessThanOrEqual(440);
        }
    });

    it("keeps points away from the player", () => {
        const points = findSpawnPoints(openMap, [], player, 10, { minPlayerDist: 160 });
        for (const p of points) {
            expect(Math.hypot(p.x - player.x, p.y - player.y)).toBeGreaterThanOrEqual(160);
        }
    });

    it("keeps points separated from each other", () => {
        const points = findSpawnPoints(openMap, [], player, 10, { minSep: 60 });
        for (let i = 0; i < points.length; i++) {
            for (let j = i + 1; j < points.length; j++) {
                expect(Math.hypot(points[i].x - points[j].x, points[i].y - points[j].y))
                    .toBeGreaterThanOrEqual(60);
            }
        }
    });

    it("skips points that collide with solid objects", () => {
        const solids: Rect[] = [{ x: 300, y: 200, w: 150, h: 100 }];
        const points = findSpawnPoints(openMap, solids, player, 20, { minPlayerDist: 0 });

        for (const p of points) {
            const box = { x: p.x, y: p.y, w: 40, h: 40 };
            const overlap = box.x < 450 && box.x + 40 > 300 && box.y < 300 && box.y + 40 > 200;
            expect(overlap).toBe(false);
        }
    });

    it("relaxes constraints when the strict pass cannot fill the wave", () => {
        // Player in a corner + huge separation demand makes the strict pass fail.
        const cornerPlayer: Vec2 = { x: 60, y: 60 };
        const points = findSpawnPoints(openMap, [], cornerPlayer, 5, {
            minPlayerDist: 700,
            minSep: 500,
            maxAttempts: 50
        });

        expect(points.length).toBeGreaterThan(0);
    });

    it("falls back to a tile scan when random passes fail completely", () => {
        const cornerPlayer: Vec2 = { x: 60, y: 60 };
        const points = findSpawnPoints(openMap, [], cornerPlayer, 5, {
            minPlayerDist: 10000,
            minSep: 10000,
            maxAttempts: 20
        });

        // Strict + relaxed passes both fail; the tile scan still yields a point.
        expect(points.length).toBeGreaterThan(0);
    });

    it("returns an empty array on a fully solid map", () => {
        const solidMap = makeMap([
            "####",
            "####",
            "####"
        ]);

        expect(findSpawnPoints(solidMap, [], player, 5)).toEqual([]);
    });
});