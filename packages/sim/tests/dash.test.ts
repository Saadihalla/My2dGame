import { describe, it, expect } from "vitest";
import { dashDirection } from "../src/dash.js";

describe("dashDirection", () => {
    it("uses held input when present", () => {
        expect(dashDirection(1, 0, "up")).toEqual({ dx: 1, dy: 0 });
        expect(dashDirection(0, -1, "right")).toEqual({ dx: 0, dy: -1 });
    });

    it("normalizes diagonal input", () => {
        const result = dashDirection(1, 1, "right");
        expect(result?.dx).toBeCloseTo(Math.SQRT1_2, 5);
        expect(result?.dy).toBeCloseTo(Math.SQRT1_2, 5);
    });

    it("falls back to the facing direction when no input is held", () => {
        expect(dashDirection(0, 0, "left")).toEqual({ dx: -1, dy: 0 });
        expect(dashDirection(0, 0, "up")).toEqual({ dx: 0, dy: -1 });
        expect(dashDirection(0, 0, "down")).toEqual({ dx: 0, dy: 1 });
        expect(dashDirection(0, 0, "right")).toEqual({ dx: 1, dy: 0 });
    });
});