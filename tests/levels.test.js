import { describe, it, expect } from "vitest";
import { LEVELS } from "../src/logic/levelData.js";
import { isColliding } from "../src/logic/collision.js";

const TILE = 50;
const PLAYER_SIZE = 40;

// Mirrors buildLevel's solid geometry so the test is independent of
// the DOM-touching levels module.

function buildMap(level) {
    return level.tiles.map(function (line) {
        return line.split("").map(function (ch) {
            return ch === "#" ? 1 : 0;
        });
    });
}

function buildSolids(level) {
    const solids = [];

    for (const water of level.water) {
        solids.push(water);
    }

    for (const tree of level.trees) {
        solids.push({ x: tree[0] - 10, y: tree[1] - 16, w: 38, h: 52 });
    }

    for (const rock of level.rocks) {
        solids.push({ x: rock[0] - 3, y: rock[1] - 3, w: 32, h: 20 });
    }

    return solids;
}

describe("level data", () => {
    for (const level of LEVELS) {
        describe(level.name, () => {
            const map = buildMap(level);
            const solids = buildSolids(level);

            it("has consistent dimensions of 32x20", () => {
                expect(level.cols).toBe(32);
                expect(level.rows).toBe(20);
                expect(level.tiles).toHaveLength(20);
                for (const row of level.tiles) {
                    expect(row).toHaveLength(32);
                }
            });

            it("spawn point is free of solids (player box must not be trapped)", () => {
                expect(isColliding(
                    level.spawn.x,
                    level.spawn.y,
                    PLAYER_SIZE,
                    PLAYER_SIZE,
                    map,
                    solids,
                    TILE
                )).toBe(false);
            });

            it("portal center is walkable", () => {
                expect(isColliding(
                    level.portal.x,
                    level.portal.y,
                    1,
                    1,
                    map,
                    solids,
                    TILE
                )).toBe(false);
            });
        });
    }
});