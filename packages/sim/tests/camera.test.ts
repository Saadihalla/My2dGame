import { describe, it, expect } from "vitest";
import {
    createCamera,
    cameraUpdate,
    worldToScreen,
    screenToWorld,
    viewportRect,
    isInView
} from "../src/camera.js";

describe("Camera logic", () => {
    it("createCamera returns zeroed state", () => {
        const cam = createCamera();
        expect(cam.x).toBe(0);
        expect(cam.y).toBe(0);
        expect(cam.prevX).toBe(0);
        expect(cam.prevY).toBe(0);
    });

    it("cameraUpdate with smoothing=0 snaps to center on target", () => {
        const cam = createCamera();
        const target = { x: 100, y: 100, width: 40, height: 40 };
        // Center of target: (120, 120)
        // idealX = 120 - 400 = -280
        // idealY = 120 - 250 = -130
        // clamped bounds: map size 1600x1000, view size 800x500
        // Expect clamp to [0, 800] and [0, 500], so X clamps to 0, Y clamps to 0
        cameraUpdate(cam, target, 1600, 1000, 800, 500, 1 / 60, 0);
        expect(cam.x).toBe(0);
        expect(cam.y).toBe(0);
    });

    it("cameraUpdate snaps to correct center without out-of-bounds clamp in middle", () => {
        const cam = createCamera();
        const target = { x: 800, y: 500, width: 40, height: 40 };
        // Center: 820, 520
        // idealX = 820 - 400 = 420
        // idealY = 520 - 250 = 270
        cameraUpdate(cam, target, 1600, 1000, 800, 500, 1 / 60, 0);
        expect(cam.x).toBe(420);
        expect(cam.y).toBe(270);
    });

    it("cameraUpdate clamps at left/top edge", () => {
        const cam = createCamera();
        // Target very close to top left
        const target = { x: 10, y: 10, width: 40, height: 40 };
        cameraUpdate(cam, target, 1600, 1000, 800, 500, 1 / 60, 0);
        expect(cam.x).toBe(0);
        expect(cam.y).toBe(0);
    });

    it("cameraUpdate clamps at right/bottom edge", () => {
        const cam = createCamera();
        // Target very close to bottom right (1600, 1000)
        const target = { x: 1550, y: 950, width: 40, height: 40 };
        cameraUpdate(cam, target, 1600, 1000, 800, 500, 1 / 60, 0);
        // max X = 1600 - 800 = 800
        // max Y = 1000 - 500 = 500
        expect(cam.x).toBe(800);
        expect(cam.y).toBe(500);
    });

    it("cameraUpdate centers when world is smaller than view", () => {
        const cam = createCamera();
        const target = { x: 10, y: 10, width: 40, height: 40 };
        // World: 600x400, View: 800x500
        cameraUpdate(cam, target, 600, 400, 800, 500, 1 / 60, 0);
        expect(cam.x).toBe(-100); // (600 - 800) / 2
        expect(cam.y).toBe(-50);  // (400 - 500) / 2
    });

    it("cameraUpdate with smoothing > 0 moves partway toward target", () => {
        const cam = createCamera();
        // Target center at 820, 520 -> idealX = 420, idealY = 270
        const target = { x: 800, y: 500, width: 40, height: 40 };
        cameraUpdate(cam, target, 1600, 1000, 800, 500, 1, 0.5);
        // idealX = 420, idealY = 270
        // movement: (420 - 0) * (1 - 0.5^1) = 420 * 0.5 = 210
        expect(cam.x).toBe(210);
        expect(cam.y).toBe(135);
    });

    it("cameraUpdate stores prevX/prevY before updating", () => {
        const cam = createCamera();
        cam.x = 100;
        cam.y = 100;
        const target = { x: 800, y: 500, width: 40, height: 40 };
        cameraUpdate(cam, target, 1600, 1000, 800, 500, 1 / 60, 0);
        expect(cam.prevX).toBe(100);
        expect(cam.prevY).toBe(100);
        expect(cam.x).toBe(420);
        expect(cam.y).toBe(270);
    });

    it("worldToScreen and screenToWorld are inverses", () => {
        const camX = 150;
        const camY = 120;
        const wx = 300;
        const wy = 450;
        const screen = worldToScreen(wx, wy, camX, camY);
        expect(screen.x).toBe(150);
        expect(screen.y).toBe(330);

        const world = screenToWorld(screen.x, screen.y, camX, camY);
        expect(world.x).toBe(wx);
        expect(world.y).toBe(wy);
    });

    it("viewportRect returns correct rect", () => {
        const rect = viewportRect(100, 200, 800, 500);
        expect(rect).toEqual({ x: 100, y: 200, w: 800, h: 500 });
    });

    it("isInView returns correct value", () => {
        // Viewport: x: 100, y: 100, w: 800, h: 500
        expect(isInView(200, 200, 40, 40, 100, 100, 800, 500)).toBe(true);
        // Completely to the left
        expect(isInView(50, 200, 40, 40, 100, 100, 800, 500)).toBe(false);
        // Margins check
        expect(isInView(50, 200, 40, 40, 100, 100, 800, 500, 20)).toBe(true);
    });
});