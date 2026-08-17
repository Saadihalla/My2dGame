import { describe, it, expect } from "vitest";
import { decideEnemyState, kiteDirection } from "../src/ai.js";
import type { AIDecisionContext } from "../src/types.js";

function ctx(overrides: Partial<AIDecisionContext> = {}): AIDecisionContext {
    return Object.assign({
        stateTimerDone: false,
        inRange: false,
        cooldownReady: false,
        type: "grunt",
        hpRatio: 1,
        retreatRoll: 1,
        dist: 500,
        timers: {
            windup: 0.6,
            strike: 0.15,
            recover: 0.5,
            cooldown: 1.2
        }
    }, overrides);
}

describe("decideEnemyState", () => {
    it("chases while out of range", () => {
        expect(decideEnemyState("chase", ctx({ inRange: false }))).toEqual({ state: "chase" });
    });

    it("winds up when in range and off cooldown", () => {
        const decision = decideEnemyState("chase", ctx({ inRange: true, cooldownReady: true }));
        expect(decision).toEqual({ state: "windup", timer: 0.6 });
    });

    it("stays in windup until the timer runs out", () => {
        expect(decideEnemyState("windup", ctx({ stateTimerDone: false }))).toEqual({ state: "windup" });
        expect(decideEnemyState("windup", ctx({ stateTimerDone: true }))).toEqual({ state: "strike", timer: 0.15 });
    });

    it("strike lands and resets the cooldown", () => {
        const decision = decideEnemyState("strike", ctx({ stateTimerDone: true }));
        expect(decision).toEqual({
            state: "recover",
            timer: 0.5,
            cooldown: 1.2
        });
    });

    it("recovers back to chase normally", () => {
        expect(decideEnemyState("recover", ctx({ stateTimerDone: true, type: "grunt", hpRatio: 1 }))).toEqual({ state: "chase" });
    });

    it("grunts at low HP may retreat instead", () => {
        expect(decideEnemyState("recover", ctx({ stateTimerDone: true, type: "grunt", hpRatio: 0.2, retreatRoll: 0.1 })))
            .toEqual({ state: "retreat", timer: 0.8 });
    });

    it("grunts at low HP but unlucky roll keep chasing", () => {
        expect(decideEnemyState("recover", ctx({ stateTimerDone: true, type: "grunt", hpRatio: 0.2, retreatRoll: 0.9 })))
            .toEqual({ state: "chase" });
    });

    it("non-grunt enemies never retreat", () => {
        expect(decideEnemyState("recover", ctx({ stateTimerDone: true, type: "tank", hpRatio: 0.1, retreatRoll: 0 })))
            .toEqual({ state: "chase" });
    });

    it("retreat ends when the timer expires or the player is close", () => {
        expect(decideEnemyState("retreat", ctx({ stateTimerDone: true }))).toEqual({ state: "chase" });
        expect(decideEnemyState("retreat", ctx({ dist: 0.5 }))).toEqual({ state: "chase" });
        expect(decideEnemyState("retreat", ctx({ stateTimerDone: false, dist: 200 }))).toEqual({ state: "retreat" });
    });

    it("unknown states fall back to chase", () => {
        expect(decideEnemyState("nonsense", ctx())).toEqual({ state: "chase" });
    });
});

describe("kiteDirection", () => {
    it("retreats when too close", () => {
        expect(kiteDirection(100, 150, 260)).toBe(-1);
    });

    it("approaches when too far", () => {
        expect(kiteDirection(400, 150, 260)).toBe(1);
    });

    it("holds position inside the band", () => {
        expect(kiteDirection(200, 150, 260)).toBe(0);
    });

    it("holds at the exact band edges", () => {
        expect(kiteDirection(150, 150, 260)).toBe(0);
        expect(kiteDirection(260, 150, 260)).toBe(0);
    });
});