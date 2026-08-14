import { describe, it, expect } from "vitest";
import { UPGRADE_POOL, rollUpgradeOptions } from "../src/logic/upgrades.js";

function seq(values) {
    let i = 0;
    return function () {
        return values[i++ % values.length];
    };
}

describe("rollUpgradeOptions", () => {
    it("returns distinct options from the pool", () => {
        const options = rollUpgradeOptions(3, seq([0.1, 0.5, 0.9]));

        expect(options).toHaveLength(3);

        const ids = options.map(function (o) {
            return o.id;
        });

        expect(new Set(ids).size).toBe(3);
        expect(UPGRADE_POOL.some((o) => o.id === ids[0])).toBe(true);
    });

    it("returns exactly the requested count up to the pool size", () => {
        expect(rollUpgradeOptions(1, seq([0.1]))).toHaveLength(1);
        expect(rollUpgradeOptions(9, seq([0.1]))).toHaveLength(9);
        expect(rollUpgradeOptions(50, seq([0.1]))).toHaveLength(9);
    });

    it("every option has an id, name and description", () => {
        for (const option of UPGRADE_POOL) {
            expect(option.id).toBeTruthy();
            expect(option.name).toBeTruthy();
            expect(option.desc).toBeTruthy();
        }
    });
});