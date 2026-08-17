// ======================
// ANIMATION FRAMES LOOKUP (pure)
// ======================

import type { FrameRect, SpriteSheetDef, Vec2 } from "./types.js";

export interface AnimationFrameDetails {
    frame: FrameRect;
    anchor: Vec2;
    scale: number;
}

export function getAnimationFrame(
    sheetDef: SpriteSheetDef | null | undefined,
    entityType: string,
    state: string,
    time: number
): AnimationFrameDetails | null {
    if (!sheetDef || !sheetDef.animations || !sheetDef.frames) {
        return null;
    }

    const entityAnims = sheetDef.animations[entityType];
    if (!entityAnims) {
        return null;
    }

    const anim = entityAnims[state];
    if (!anim) {
        // Fallback to idle state if specified state is not found
        const fallbackAnim = entityAnims["idle"];
        if (!fallbackAnim) {
            return null;
        }
        return getFrameDetails(sheetDef, fallbackAnim, time);
    }

    return getFrameDetails(sheetDef, anim, time);
}

function getFrameDetails(
    sheetDef: SpriteSheetDef,
    anim: { frames: string[]; frameRate?: number; loop?: boolean },
    time: number
): AnimationFrameDetails | null {
    const totalFrames = anim.frames.length;
    if (totalFrames === 0) {
        return null;
    }

    const frameRate = anim.frameRate || 8;
    let index = Math.floor(time * frameRate);

    if (anim.loop) {
        index = index % totalFrames;
    } else {
        index = Math.min(index, totalFrames - 1);
    }

    const frameName = anim.frames[index];
    const frameData = sheetDef.frames[frameName];
    if (!frameData) {
        return null;
    }

    return {
        frame: frameData.frame,
        anchor: frameData.anchor || { x: frameData.frame.w / 2, y: frameData.frame.h / 2 },
        scale: frameData.scale || 1
    };
}