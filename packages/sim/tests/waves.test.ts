import { describe, it, expect } from "vitest";
import { waveEnemyList } from "../src/waves.js";

describe("waveEnemyList", () => {
    it("wave 1 is all grunts", () => {
        expect(waveEnemyList(1)).toEqual(["grunt", "grunt", "grunt"]);
    });

    it("wave 2 adds a fast enemy", () => {
        const list = waveEnemyList(2);
        expect(list.filter((e) => e === "fast").length).toBeGreaterThan(0);
    });

    it("wave 2 adds swarm minions", () => {
        const list = waveEnemyList(2);
        expect(list.filter((e) => e === "swarm").length).toBeGreaterThan(0);
    });

    it("wave 3 adds a caster", () => {
        const list = waveEnemyList(3);
        expect(list.filter((e) => e === "caster").length).toBeGreaterThan(0);
    });

    it("wave 4 adds an exploder", () => {
        const list = waveEnemyList(4);
        expect(list.filter((e) => e === "exploder").length).toBeGreaterThan(0);
    });

    it("wave 5 adds a warden", () => {
        const list = waveEnemyList(5);
        expect(list.filter((e) => e === "warden").length).toBeGreaterThan(0);
    });

    it("wave 1 contains only grunts", () => {
        const list = waveEnemyList(1);
        expect(list.every((e) => e === "grunt")).toBe(true);
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