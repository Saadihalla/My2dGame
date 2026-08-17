import { describe, it, expect } from "vitest";
import { LEVELS, compileLevelMap, compileLevelSolids } from "../src/levelData.js";
import { isColliding } from "../src/collision.js";

const TILE = 50;
const PLAYER_SIZE = 40;

describe("level data", () => {
    for (const level of LEVELS) {
        describe(level.name, () => {
            const map = compileLevelMap(level);
            const solids = compileLevelSolids(level);

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