import { describe, it, expect } from "vitest";
import { getAnimationFrame } from "../src/logic/frames.js";

const mockSheetDef = {
    frames: {
        player_idle_0: { frame: { x: 0, y: 0, w: 40, h: 40 }, anchor: { x: 20, y: 20 } },
        player_idle_1: { frame: { x: 40, y: 0, w: 40, h: 40 }, anchor: { x: 20, y: 20 } },
        player_walk_0: { frame: { x: 80, y: 0, w: 40, h: 40 }, anchor: { x: 20, y: 20 } },
        player_walk_1: { frame: { x: 120, y: 0, w: 40, h: 40 }, anchor: { x: 20, y: 20 } },
        player_attack_0: { frame: { x: 160, y: 0, w: 40, h: 40 } }
    },
    animations: {
        player: {
            idle: { frames: ["player_idle_0", "player_idle_1"], frameRate: 4, loop: true },
            walk: { frames: ["player_walk_0", "player_walk_1"], frameRate: 8, loop: true },
            attack: { frames: ["player_attack_0"], frameRate: 2, loop: false }
        }
    }
};

describe("Animation frames lookup", () => {
    it("returns correct coordinates and anchor for simple request", () => {
        const frame = getAnimationFrame(mockSheetDef, "player", "idle", 0);
        expect(frame).toEqual({
            frame: { x: 0, y: 0, w: 40, h: 40 },
            anchor: { x: 20, y: 20 },
            scale: 1
        });
    });

    it("calculates correct frame index over time", () => {
        // frameRate is 4, time is 0.26s -> index = floor(1.04) = 1
        const frame = getAnimationFrame(mockSheetDef, "player", "idle", 0.26);
        expect(frame.frame.x).toBe(40);
    });

    it("loops correctly over time when loop=true", () => {
        // frameRate is 4, time is 0.6s -> index = floor(2.4) = 2 -> looped index = 2 % 2 = 0
        const frame = getAnimationFrame(mockSheetDef, "player", "idle", 0.6);
        expect(frame.frame.x).toBe(0);
    });

    it("clamps to last frame when loop=false", () => {
        // time is 2.0s -> index = floor(4.0) = 4 -> clamp index to 0 (length-1)
        const frame = getAnimationFrame(mockSheetDef, "player", "attack", 2.0);
        expect(frame.frame.x).toBe(160);
    });

    it("falls back to idle state if specified state is not found", () => {
        const frame = getAnimationFrame(mockSheetDef, "player", "jump", 0);
        expect(frame.frame.x).toBe(0); // Falls back to player.idle[0]
    });

    it("returns null for non-existent entity type", () => {
        const frame = getAnimationFrame(mockSheetDef, "skeleton", "idle", 0);
        expect(frame).toBeNull();
    });

    it("assigns default anchor if anchor is not specified in json", () => {
        const frame = getAnimationFrame(mockSheetDef, "player", "attack", 0);
        expect(frame.anchor).toEqual({ x: 20, y: 20 }); // Default is w/2, h/2
    });

    it("returns scale from frame def and defaults to 1", () => {
        const scaled = getAnimationFrame(mockSheetDef, "player", "idle", 0);
        expect(scaled.scale).toBe(1); // no scale in mock -> default

        const def = {
            frames: {
                big_0: { frame: { x: 0, y: 0, w: 80, h: 80 }, scale: 0.5 }
            },
            animations: {
                big: { idle: { frames: ["big_0"], frameRate: 1, loop: true } }
            }
        };
        const s = getAnimationFrame(def, "big", "idle", 0);
        expect(s.scale).toBe(0.5);
    });
});
