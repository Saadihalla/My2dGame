import { describe, it, expect } from "vitest";
import {
    clamp,
    lerp,
    tweenProgress,
    easeIn,
    easeOut,
    easeInOut,
    easeOutBack,
    easeOutElastic,
    easeOutBounce,
    tween
} from "../src/logic/tween.js";

describe("clamp", () => {
    it("clamps into range", () => {
        expect(clamp(5, 0, 10)).toBe(5);
        expect(clamp(-1, 0, 10)).toBe(0);
        expect(clamp(11, 0, 10)).toBe(10);
    });
});

describe("lerp", () => {
    it("interpolates linearly", () => {
        expect(lerp(0, 10, 0.5)).toBe(5);
        expect(lerp(10, 20, 0)).toBe(10);
        expect(lerp(10, 20, 1)).toBe(20);
    });
});

describe("tweenProgress", () => {
    it("normalizes elapsed over duration", () => {
        expect(tweenProgress(0, 2)).toBe(0);
        expect(tweenProgress(1, 2)).toBe(0.5);
        expect(tweenProgress(2, 2)).toBe(1);
    });

    it("clamps past the end and guards zero duration", () => {
        expect(tweenProgress(5, 2)).toBe(1);
        expect(tweenProgress(1, 0)).toBe(1);
    });
});

describe("easing curves", () => {
    it("all start at 0 and end at 1", () => {
        for (const fn of [easeIn, easeOut, easeInOut, easeOutBack, easeOutElastic, easeOutBounce]) {
            expect(fn(0)).toBe(0);
            expect(fn(1)).toBe(1);
        }
    });

    it("easeIn is slower early, faster late", () => {
        expect(easeIn(0.5)).toBeCloseTo(0.25);
    });

    it("easeOutBack overshoots past 1 mid-curve", () => {
        expect(easeOutBack(0.5)).toBeGreaterThan(1);
    });
});

describe("tween", () => {
    it("advances state and interpolates", () => {
        const state = { t: 0, from: 0, to: 100, duration: 1, curve: easeOut };
        expect(tween(state, 0.5)).toBeCloseTo(75, 5);
        expect(state.t).toBeCloseTo(0.5);
    });

    it("completes once elapsed passes duration", () => {
        const state = { t: 0, from: 0, to: 100, duration: 1 };
        tween(state, 2);
        expect(tween(state, 0)).toBe(100);
    });
});
