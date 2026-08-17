import { describe, it, expect } from "vitest";
import { aabb, isColliding } from "../src/collision.js";
import type { GridMap, Rect } from "../src/types.js";

const TILE = 50;

function makeMap(rows: string[]): GridMap {
    return rows.map(function (line) {
        return line.split("").map(function (ch) {
            return ch === "#" ? 1 : 0;
        });
    });
}

describe("aabb", () => {
    it("detects overlapping boxes", () => {
        expect(aabb({ x: 0, y: 0, w: 10, h: 10 }, { x: 5, y: 5, w: 10, h: 10 })).toBe(true);
    });

    it("detects identical boxes", () => {
        expect(aabb({ x: 0, y: 0, w: 10, h: 10 }, { x: 0, y: 0, w: 10, h: 10 })).toBe(true);
    });

    it("rejects separated boxes", () => {
        expect(aabb({ x: 0, y: 0, w: 10, h: 10 }, { x: 20, y: 0, w: 10, h: 10 })).toBe(false);
    });

    it("treats edge-touching as non-overlapping", () => {
        expect(aabb({ x: 0, y: 0, w: 10, h: 10 }, { x: 10, y: 0, w: 10, h: 10 })).toBe(false);
    });

    it("rejects boxes above/below", () => {
        expect(aabb({ x: 0, y: 0, w: 10, h: 10 }, { x: 0, y: 20, w: 10, h: 10 })).toBe(false);
    });
});

describe("isColliding", () => {
    const map = makeMap([
        "####",
        "#..#",
        "#..#",
        "####"
    ]);

    it("returns true outside map bounds", () => {
        expect(isColliding(-10, 0, 10, 10, map, [], TILE)).toBe(true);
        expect(isColliding(0, 500, 10, 10, map, [], TILE)).toBe(true);
    });

    it("returns true on solid tiles", () => {
        expect(isColliding(0, 0, 10, 10, map, [], TILE)).toBe(true);
    });

    it("returns false on open tiles", () => {
        expect(isColliding(60, 60, 10, 10, map, [], TILE)).toBe(false);
    });

    it("returns true when overlapping a solid object", () => {
        const solids: Rect[] = [{ x: 150, y: 150, w: 20, h: 20 }];
        expect(isColliding(155, 155, 10, 10, map, solids, TILE)).toBe(true);
        expect(isColliding(100, 100, 10, 10, map, solids, TILE)).toBe(false);
    });
});