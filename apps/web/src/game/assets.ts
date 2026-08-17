// ======================
// ASSETS PRELOADER
// ======================

import type { SpriteSheetDef } from "@dark-fantasy/sim";

export interface AssetLoader {
    loaded: boolean;
    progress: number;
    spritesheet: HTMLImageElement | null;
    spritesheetDef: SpriteSheetDef | null;
    fallbackMode: boolean;
    load: (onProgress?: (p: number) => void, onComplete?: () => void) => void;
    validateSheet: () => boolean;
}

export const Assets: AssetLoader = {
    loaded: false,
    progress: 0,
    spritesheet: null,
    spritesheetDef: null,
    fallbackMode: false,

    load: function (onProgress, onComplete) {
        const totalItems = 3; // font, json, image
        let itemsLoaded = 0;
        let criticalFailure = false;

        function itemDone(success) {
            if (!success) {
                criticalFailure = true;
            }
            itemsLoaded++;
            Assets.progress = itemsLoaded / totalItems;

            if (onProgress) {
                onProgress(Assets.progress);
            }

            if (itemsLoaded >= totalItems) {
                Assets.loaded = true;

                if (criticalFailure || !Assets.validateSheet()) {
                    console.warn("Assets loader: sheet missing, invalid, or failed to load. Falling back to procedural graphics.");
                    Assets.fallbackMode = true;
                }

                if (onComplete) {
                    onComplete();
                }
            }
        }

        // 1. Load Font (non-critical: a font failure must not nuke the
        // whole asset pipeline, just keep the fallback font)
        if (document.fonts && document.fonts.ready) {
            document.fonts.ready.then(function () {
                itemDone(true);
            }).catch(function (err) {
                console.warn("Font loading error (non-critical):", err);
                itemDone(true);
            });
        } else {
            itemDone(true);
        }

        // 2. Fetch JSON
        fetch("/assets/spritesheet.json")
            .then(function (res) {
                if (!res.ok) {
                    throw new Error("HTTP error " + res.status);
                }
                return res.json();
            })
            .then(function (data) {
                Assets.spritesheetDef = data;
                itemDone(true);
            })
            .catch(function (err) {
                console.error("JSON loading error:", err);
                itemDone(false);
            });

        // 3. Load Image Sheet
        const img = new Image();
        img.onload = function () {
            Assets.spritesheet = img;
            itemDone(true);
        };
        img.onerror = function (err) {
            console.error("Image loading error:", err);
            itemDone(false);
        };
        img.src = "/assets/spritesheet.png";
    },

    // Guards against a malformed sheet silently shipping: checks the image
    // dimensions match the JSON meta and every frame rect is in-bounds.
    // A mismatch means the game runs in procedural fallback instead of
    // rendering misaligned/cropped sprites.
    validateSheet: function () {
        const img = Assets.spritesheet;
        const def = Assets.spritesheetDef;

        if (!img || !def || !def.frames) {
            return false;
        }

        const meta = def.meta && def.meta.size;
        if (meta && (meta.w !== img.naturalWidth || meta.h !== img.naturalHeight)) {
            console.warn(
                "Assets: sheet size mismatch — expected " +
                meta.w + "x" + meta.h +
                ", got " + img.naturalWidth + "x" + img.naturalHeight
            );
            return false;
        }

        for (const name of Object.keys(def.frames)) {
            const f = def.frames[name].frame;
            if (!f || f.w <= 0 || f.h <= 0 ||
                f.x < 0 || f.y < 0 ||
                f.x + f.w > img.naturalWidth ||
                f.y + f.h > img.naturalHeight) {
                console.warn("Assets: frame out of bounds:", name, JSON.stringify(f));
                return false;
            }
        }

        return true;
    }
};
