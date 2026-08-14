import { describe, it, expect } from "vitest";
import { waveEnemyList } from "../src/logic/waves.js";

describe("waveEnemyList", () => {
    it("wave 1 is all grunts", () => {
        expect(waveEnemyList(1)).toEqual(["grunt", "grunt", "grunt"]);
    });

    it("wave 2 adds a fast enemy", () => {
        const list = waveEnemyList(2);
        expect(list.filter((e) => e === "fast").length).toBeGreaterThan(0);
    });

    it("wave 4 adds a tank", () => {
        const list = waveEnemyList(4);
        expect(list.filter((e) => e === "tank").length).toBeGreaterThan(0);
    });

    it("every 5th wave includes exactly one boss", () => {
        for (const wave of [5, 10, 15, 20]) {
            const list = waveEnemyList(wave);
            expect(list.filter((e) => e === "boss")).toHaveLength(1);
        }
    });

    it("non-boss waves never include a boss", () => {
        for (const wave of [1, 2, 3, 4, 6, 7, 8, 9]) {
            expect(waveEnemyList(wave).includes("boss")).toBe(false);
        }
    });

    it("enemy count scales with wave number", () => {
        const small = waveEnemyList(1).length;
        const big = waveEnemyList(10).length;
        expect(big).toBeGreaterThan(small);
    });
});