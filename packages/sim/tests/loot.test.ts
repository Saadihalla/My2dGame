import { describe, it, expect } from "vitest";
import { rollLoot } from "../src/loot.js";

describe("rollLoot", () => {
    it("bosses always drop a potion and an upgrade", () => {
        expect(rollLoot("boss", 0.99)).toEqual(["potion", "upgrade"]);
        expect(rollLoot("boss", 0)).toEqual(["potion", "upgrade"]);
    });

    it("tanks drop an upgrade at 18%", () => {
        expect(rollLoot("tank", 0.1)).toEqual(["upgrade"]);
        expect(rollLoot("tank", 0.1799)).toEqual(["upgrade"]);
    });

    it("tanks drop a potion between 18% and 28%", () => {
        expect(rollLoot("tank", 0.2)).toEqual(["potion"]);
        expect(rollLoot("tank", 0.2799)).toEqual(["potion"]);
    });

    it("tanks drop nothing at 28% and above", () => {
        expect(rollLoot("tank", 0.28)).toEqual([]);
        expect(rollLoot("tank", 0.9)).toEqual([]);
    });

    it("normal enemies drop an upgrade below 8%", () => {
        expect(rollLoot("grunt", 0.05)).toEqual(["upgrade"]);
        expect(rollLoot("grunt", 0.0799)).toEqual(["upgrade"]);
    });

    it("normal enemies drop a potion between 8% and 28%", () => {
        expect(rollLoot("grunt", 0.1)).toEqual(["potion"]);
        expect(rollLoot("grunt", 0.2799)).toEqual(["potion"]);
    });

    it("normal enemies drop nothing at 28% and above", () => {
        expect(rollLoot("grunt", 0.28)).toEqual([]);
        expect(rollLoot("grunt", 0.5)).toEqual([]);
    });
});