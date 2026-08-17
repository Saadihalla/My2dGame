// ======================
// ENEMY STATE MACHINE (pure)
// ======================

import type { AIDecision, AIDecisionContext } from "./types.js";

export function decideEnemyState(state: string, ctx: AIDecisionContext): AIDecision {
    switch (state) {
        case "chase":
            if (ctx.inRange && ctx.cooldownReady) {
                return { state: "windup", timer: ctx.timers.windup };
            }
            return { state: "chase" };

        case "windup":
            if (ctx.stateTimerDone) {
                return { state: "strike", timer: ctx.timers.strike };
            }
            return { state: "windup" };

        case "strike":
            if (ctx.stateTimerDone) {
                return {
                    state: "recover",
                    timer: ctx.timers.recover,
                    cooldown: ctx.timers.cooldown
                };
            }
            return { state: "strike" };

        case "recover":
            if (ctx.stateTimerDone) {
                if (ctx.type === "grunt" && ctx.hpRatio <= 0.3 && ctx.retreatRoll < 0.35) {
                    return { state: "retreat", timer: 0.8 };
                }
                return { state: "chase" };
            }
            return { state: "recover" };

        case "retreat":
            if (ctx.stateTimerDone || ctx.dist <= 1) {
                return { state: "chase" };
            }
            return { state: "retreat" };
    }

    return { state: "chase" };
}

// Movement decision for kiting enemies: -1 retreat, 0 hold, +1 approach.

export function kiteDirection(dist: number, minRange: number, maxRange: number): number {
    if (dist < minRange) {
        return -1;
    }
    if (dist > maxRange) {
        return 1;
    }
    return 0;
}