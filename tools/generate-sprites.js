// ============================================================
// Sprite generator: adds the 5 missing enemy character sets
// (grunt, fast, swarm, tank, boss) to the spritesheet.
//
//   node tools/generate-sprites.js
//
// Zero dependencies: decodes the existing PNG with node:zlib,
// composites new pixel-art frames, writes public/assets back.
// ============================================================

import { readFileSync, writeFileSync } from "node:fs";
import { inflateSync, deflateSync } from "node:zlib";

const OLD_PNG = "public/assets/spritesheet.png";
const OLD_JSON = "public/assets/spritesheet.json";

// ------------------------------------------------------------
// Minimal PNG decoder (8-bit RGBA, filters 0-4) / encoder
// ------------------------------------------------------------
const CRC_TABLE = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        t[n] = c >>> 0;
    }
    return t;
})();

function crc32(buf) {
    let c = 0xffffffff;
    for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body), 0);
    return Buffer.concat([len, body, crc]);
}

export function decodePng(file) {    const buf = readFileSync(file);
    if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error("not a PNG: " + file);
    let pos = 8;
    let width = 0, height = 0, bitDepth = 0, colorType = 0;
    const idat = [];
    while (pos < buf.length) {
        const len = buf.readUInt32BE(pos);
        const type = buf.toString("ascii", pos + 4, pos + 8);
        const data = buf.subarray(pos + 8, pos + 8 + len);
        if (type === "IHDR") {
            width = data.readUInt32BE(0);
            height = data.readUInt32BE(4);
            bitDepth = data[8];
            colorType = data[9];
        } else if (type === "IDAT") {
            idat.push(data);
        } else if (type === "IEND") {
            break;
        }
        pos += 12 + len;
    }
    if (bitDepth !== 8 || (colorType !== 6 && colorType !== 2)) {
        throw new Error("unsupported PNG (want 8-bit RGB/RGBA)");
    }

    const raw = inflateSync(Buffer.concat(idat));
    let src = 0;
    const pixelBytes = colorType === 6 ? 4 : 3;
    const stride = width * pixelBytes;
    const out = Buffer.alloc(width * height * 4);
    const row = Buffer.alloc(stride);
    const prevRow = Buffer.alloc(stride);

    for (let y = 0; y < height; y++) {
        const filter = raw[src++];
        for (let i = 0; i < stride; i++) {
            const rawByte = raw[src++];
            const left = i >= pixelBytes ? row[i - pixelBytes] : 0;
            const up = y > 0 ? prevRow[i] : 0;
            const upLeft = y > 0 && i >= pixelBytes ? prevRow[i - pixelBytes] : 0;
            let val;
            switch (filter) {
                case 0: val = rawByte; break;
                case 1: val = rawByte + left; break;
                case 2: val = rawByte + up; break;
                case 3: val = rawByte + ((left + up) >> 1); break;
                case 4: {
                    const p = left + up - upLeft;
                    const pa = Math.abs(p - left), pb = Math.abs(p - up), pc = Math.abs(p - upLeft);
                    val = rawByte + (pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft);
                    break;
                }
                default: throw new Error("bad filter " + filter);
            }
            row[i] = val & 0xff;
        }

        // Copy (and, for RGB, expand to RGBA) into the output.
        const dstStart = y * width * 4;
        for (let i = 0; i < width; i++) {
            const di = dstStart + i * 4;
            if (pixelBytes === 4) {
                out[di] = row[i * 4];
                out[di + 1] = row[i * 4 + 1];
                out[di + 2] = row[i * 4 + 2];
                out[di + 3] = row[i * 4 + 3];
            } else {
                out[di] = row[i * 3];
                out[di + 1] = row[i * 3 + 1];
                out[di + 2] = row[i * 3 + 2];
                out[di + 3] = 255;
            }
        }

        prevRow.set(row);
        row.fill(0);
    }
    return { width, height, pixels: out };
}

function encodePng(width, height, pixels) {
    const stride = width * 4;
    const raw = Buffer.alloc((stride + 1) * height);
    for (let y = 0; y < height; y++) {
        raw[y * (stride + 1)] = 0; // filter: none
        pixels.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
    }
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(width, 0);
    ihdr.writeUInt32BE(height, 4);
    ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
    return Buffer.concat([
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        chunk("IHDR", ihdr),
        chunk("IDAT", deflateSync(raw, { level: 9 })),
        chunk("IEND", Buffer.alloc(0)),
    ]);
}

// ------------------------------------------------------------
// Pixel-art grid helpers
// ------------------------------------------------------------
// A "grid" is { w, h, px: [ {x,y,c} ] } with palette char -> RGBA.

function parseMap(rows, palette) {
    const w = rows[0].length;
    const px = [];
    for (let y = 0; y < rows.length; y++) {
        const row = rows[y];
        if (row.length !== w) throw new Error(`map row ${y} is ${row.length} wide, expected ${w}`);
        for (let x = 0; x < w; x++) {
            const c = row[x];
            if (c !== ".") {
                if (!palette[c]) throw new Error(`missing palette char "${c}" at ${x},${y}`);
                px.push({ x, y, c });
            }
        }
    }
    return { w, h: rows.length, px };
}

function gridToRgba(grid, scale) {
    const W = grid.w * scale;
    const H = grid.h * scale;
    const buf = Buffer.alloc(W * H * 4);
    for (const p of grid.px) {
        const [r, g, b] = grid.palette[p.c];
        for (let sy = 0; sy < scale; sy++) {
            for (let sx = 0; sx < scale; sx++) {
                const i = ((p.y * scale + sy) * W + (p.x * scale + sx)) * 4;
                buf[i] = r; buf[i + 1] = g; buf[i + 2] = b; buf[i + 3] = 255;
            }
        }
    }
    return buf;
}

// move all pixels by (dx, dy), clipping to grid bounds
function move(grid, dx, dy) {
    const px = [];
    for (const p of grid.px) {
        const x = p.x + dx, y = p.y + dy;
        if (x >= 0 && x < grid.w && y >= 0 && y < grid.h) px.push({ ...p, x, y });
    }
    return { ...grid, px };
}

// shift pixels in a horizontal band [y0, y1) up/down by dy
function shiftBand(grid, y0, y1, dy) {
    const px = grid.px.filter((p) => p.y < y0 || p.y >= y1).map((p) => ({ ...p }));
    for (const p of grid.px) {
        if (p.y >= y0 && p.y < y1) {
            const y = p.y + dy;
            if (y >= 0 && y < grid.h) px.push({ ...p, y });
        }
    }
    return { ...grid, px };
}

// lean: shift all pixels above midHeight left/right by dx
function lean(grid, midHeight, dx) {
    const px = [];
    for (const p of grid.px) {
        let x = p.x;
        if (p.y < midHeight) x += dx;
        if (x >= 0 && x < grid.w) px.push({ ...p, x });
    }
    return { ...grid, px };
}

// tint every pixel toward (r,g,b) by factor a
function tint(grid, color, a) {
    const px = grid.px.map((p) => ({ ...p, tint: color, tintA: a }));
    return { ...grid, px };
}

// rotate 90deg clockwise: new grid is gh x gw
function rotate90(grid) {
    const px = grid.px.map((p) => ({ x: grid.h - 1 - p.y, y: p.x, c: p.c }));
    return { w: grid.h, h: grid.w, px, palette: grid.palette };
}

// overlay another grid's pixels on top
function overlay(grid, other, dx, dy) {
    const px = [...grid.px.map((p) => ({ ...p }))];
    for (const p of other.px) {
        const x = p.x + dx, y = p.y + dy;
        if (x >= 0 && x < grid.w && y >= 0 && y < grid.h) px.push({ ...p, x, y });
    }
    return { ...grid, px };
}

// draw an X (eyes) centered at (cx, cy) with palette char c
function xeyes(grid, cx, cy, c) {
    const px = [...grid.px.map((p) => ({ ...p }))];
    for (const [dx, dy] of [[-1, -1], [1, 1], [1, -1], [-1, 1], [0, 0]]) {
        const x = cx + dx, y = cy + dy;
        if (x >= 0 && x < grid.w && y >= 0 && y < grid.h) px.push({ x, y, c });
    }
    return { ...grid, px };
}

// ------------------------------------------------------------
// Frame variant helpers (per-state)
// ------------------------------------------------------------
const LEGS_TOP = 5; // legs occupy the bottom LEGS_TOP rows

function idleFrames(base) {
    return [base, move(base, 0, 1)];
}

function walkFrames(base) {
    // frame 0: body bobs up; frame 1: legs stride (left leg up, right leg down)
    const f0 = move(shiftBand(base, base.h - LEGS_TOP, base.h, 1), 0, -1);
    const f1 = (() => {
        const half = base.w / 2;
        const px = [];
        for (const p of base.px) {
            let y = p.y;
            if (p.y >= base.h - LEGS_TOP) {
                if (p.x < half) y -= 1;
                else y += 1;
            }
            if (y >= 0 && y < base.h) px.push({ ...p, y });
        }
        return { ...base, px };
    })();
    return [f0, f1];
}

function hurtFrame(base) {
    return lean(tint(base, [255, 64, 64], 0.45), Math.floor(base.h / 2), -1);
}

function deathFrame(base, eyeX, eyeY) {
    let g = rotate90(base);
    g = move(g, 0, 1);
    g = xeyes(g, eyeX, eyeY, "D");
    return g;
}

// ------------------------------------------------------------
// Character definitions
// ------------------------------------------------------------
const CHARS = {
    grunt: {
        // Pale knight: silver armor, red plume, skin face, side sword.
        scale: 2,
        palette: {
            B: [216, 216, 216], W: [242, 242, 242], D: [170, 170, 170],
            O: [85, 85, 85], S: [241, 199, 170], A: [198, 40, 40],
        },
        base: [
            "....OOAOAOO.....", // plume on helmet
            "...OWWWWWWWWO...",
            "..OWWWWWWWWWWO..",
            ".OWWWWWWWWWWWWO.",
            ".OWWWWWWWWWWWWO.",
            ".OWWDWWWWWWDWWO.",
            "..OWWWWWWWWWWO..",
            "..OODDDDDDOO....",
            "..OBBBBBBBBBO...",
            "..OBBBBBBBBBO...",
            "..OBBDDDDDDBO...",
            "..OBBBBBBBBBO...",
            ".OBBOBBBBBBOBBO.",
            ".OBBOBBBBBBOBBO.",
            ".OBBOBBBBBBOBBO.",
            ".OWWOBBBBBBOWWO.",
            ".OBBO......OBBO.",
            ".OBBO......OBBO.",
            ".OBBO......OBBO.",
            ".OWWO......OWWO.",
            ".OOO........OOO.",
            "................",
        ],
        weapon: (() => {
            const rows = [
                ".D.",
                "DWD",
                ".D.",
            ];
            const g = parseMap(rows, { D: [170, 170, 170], W: [240, 240, 240] });
            return g;
        })(),
    },
    fast: {
        // Stalker: dark hooded figure, glowing red eyes, dagger.
        scale: 2,
        palette: {
            B: [38, 38, 47], D: [22, 22, 28], O: [10, 10, 15],
            A: [58, 58, 70], E: [255, 90, 90], W: [136, 136, 136],
        },
        base: [
            "....OOOOOOO.....",
            "...OOOOOOOOO....",
            "..OBBBBBBBBBO...",
            ".OBBBBBBBBBBBO..",
            ".OBDDEEEEEDDBO..",
            ".OBDDDDDDDDDBO..",
            "..OBBBBBBBBBO...",
            "...OBBBBBBBO....",
            "..OBBBBBBBBBO...",
            ".OBBBBBBBBBBBO..",
            ".OBBBBBBBBBBBO..",
            ".OBBDDDDDDBBBO..",
            ".OBBBBBBBBBBBO..",
            ".OBBBOOBBOBBBBO.",
            "..OBBOOBBOOBBO..",
            "..OBBO....OBBO..",
            "..OBBO....OBBO..",
            "..OBBO....OBBO..",
            "..OBBO....OBBO..",
            "..ODDO....ODDO..",
            "..OOO......OOO..",
            "................",
        ],
        weapon: (() => {
            const rows = ["W.", "DW", ".D"];
            return parseMap(rows, { W: [220, 220, 230], D: [90, 90, 100] });
        })(),
    },
    swarm: {
        // Imp: tiny red demon, horns, wings, yellow eyes, tail.
        scale: 2,
        palette: {
            B: [163, 34, 34], D: [122, 16, 16], O: [42, 8, 8],
            A: [255, 90, 90], E: [255, 215, 90], S: [212, 96, 74],
        },
        base: [
            "..O......O..",
            "...O....O...",
            "..BBBBBBBB..",
            ".BEBBBBBBEB.",
            ".BBBBBBBBBB.",
            "..BBBBBBBB..",
            "..BBBBBBBB..",
            ".ABBBBBBBBA.",
            "A.BBBBBBBB.A",
            "..BSSSSSSB..",
            "..BBBBBBBB..",
            "..BB..BB..BB",
            "..OO....OO..",
            "....B.BB....",
        ],
        weapon: (() => {
            const rows = [".A.", "A.A"];
            return parseMap(rows, { A: [255, 90, 90] });
        })(),
    },
    tank: {
        // Bulwark: heavy steel armor, red crest, giant blade.
        scale: 2.5,
        palette: {
            B: [90, 90, 100], W: [138, 138, 148], D: [51, 51, 58],
            O: [26, 26, 32], A: [255, 90, 90],
        },
        base: [
            "....AAAAAAAA....",
            "...AAAAAAAAAA...",
            "...OAAAAAAAAO...",
            "..OBBBBBBBBBBO..",
            ".OBBBBBBBBBBBBO.",
            ".OBDDDDDDDDDDBO.",
            ".OBBBBBBBBBBBBO.",
            "..OBBBBBBBBBBO..",
            "..OOBBBBBBBBOO..",
            ".OBBBBBBBBBBBBO.",
            ".OWWBBBBBBBBWWO.",
            "OBBBBBBBBBBBBBBO",
            ".OBBBBBBBBBBBBO.",
            ".OBBBDDDDDBBBBO.",
            ".OBBBBBBBBBBBBO.",
            ".OBBDDDDDDDDBBO.",
            ".OBBBBBBBBBBBBO.",
            ".OBBO......OBBO.",
            ".OBBO......OBBO.",
            ".OBBO......OBBO.",
            ".OBBO......OBBO.",
            ".OWWO......OWWO.",
            ".OOO........OOO.",
        ],
        weapon: (() => {
            const rows = [".D.", "DWD", "DWD", "DWD", "DWD", "DWD", "DWD", ".D."];
            return parseMap(rows, { D: [51, 51, 58], W: [200, 200, 210] });
        })(),
    },
    boss: {
        // Pale King: crimson-robed regal figure, gold crown, pale face.
        scale: 3,
        palette: {
            B: [139, 26, 26], D: [74, 26, 26], O: [26, 26, 30],
            A: [255, 215, 90], W: [200, 184, 168], S: [242, 226, 208],
            E: [255, 230, 150],
        },
        base: [
            ".....AAAAAAAAAA.....",
            "....AAWWWWWWAA......",
            ".....AAAAAAAAAA.....",
            ".....OBBBBBBBBO.....",
            "....OBBBBBBBBBBO....",
            "....OSSSSSSSSSSO....",
            "...OSSEEEEEESSO.....",
            "....OSSSSSSSSSSO....",
            "...OOSSSSSSSSSSOO...",
            "....OBBBBBBBBBBO....",
            "...OBBBBBBBBBBBBO...",
            "..OBBBBBBBBBBBBBBO..",
            "..OBBBBBBBBBBBBBBO..",
            "..OBBBDDDDDDBBBBBO..",
            "..OBBBBBBBBBBBBBBO..",
            "..OBBBBBBBBBBBBBBO..",
            "...OBBBBBBBBBBBBO...",
            "....OBBBBBBBBBBO....",
            ".....OBBBBBBBBO.....",
            ".....OBB..BBBBO.....",
            ".....OBB...BBBO.....",
            ".....OBB....BBO.....",
            ".....OWW....WWO.....",
            ".....OOO....OOO.....",
        ],
        weapon: (() => {
            const rows = ["D.", "WD", "D.", "WD", "D."];
            return parseMap(rows, { D: [74, 26, 26], W: [255, 215, 90] });
        })(),
    },
};

// ------------------------------------------------------------
// Main: decode old sheet, build new layout, emit
// ------------------------------------------------------------
const old = decodePng(OLD_PNG);
const oldDef = JSON.parse(readFileSync(OLD_JSON, "utf8"));

const SHEET_W = 1024;
const SHEET_H = 1024;
const sheet = Buffer.alloc(SHEET_W * SHEET_H * 4); // transparent

function blit(src, sx, sy, sw, sh, dx, dy) {
    for (let y = 0; y < sh; y++) {
        for (let x = 0; x < sw; x++) {
            const si = ((sy + y) * old.width + (sx + x)) * 4;
            const di = ((dy + y) * SHEET_W + (dx + x)) * 4;
            const a = src[si + 3];
            if (a === 0) continue;
            sheet[di] = src[si];
            sheet[di + 1] = src[si + 1];
            sheet[di + 2] = src[si + 2];
            sheet[di + 3] = a;
        }
    }
}

function blitRgba(buf, w, h, dx, dy) {
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const si = (y * w + x) * 4;
            const di = ((dy + y) * SHEET_W + (dx + x)) * 4;
            if (buf[si + 3] === 0) continue;
            sheet[di] = buf[si];
            sheet[di + 1] = buf[si + 1];
            sheet[di + 2] = buf[si + 2];
            sheet[di + 3] = buf[si + 3];
        }
    }
}

// Order of characters on the sheet: existing 4 + new 5, then objects.
const STATE_ORDER = ["idle", "walk", "attack", "hurt", "death"];

const frames = {};
const animations = {};
let cursorY = 8;

// --- existing characters (copied verbatim) ---
for (const key of ["warden", "player", "exploder", "caster"]) {
    const stateFrames = {};
    for (const state of STATE_ORDER) {
        const names = [];
        for (let i = 0; ; i++) {
            const name = `${key}_${state}_${i}`;
            if (!oldDef.frames[name]) break;
            names.push(name);
        }
        stateFrames[state] = names;
    }
    const allNames = STATE_ORDER.flatMap((s) => stateFrames[s]);
    let maxH = 0;
    for (const name of allNames) {
        const f = oldDef.frames[name].frame;
        maxH = Math.max(maxH, f.h);
    }
    let x = 8;
    for (const name of allNames) {
        const f = oldDef.frames[name].frame;
        const meta = oldDef.frames[name];
        blit(old.pixels, f.x, f.y, f.w, f.h, x, cursorY);
        frames[name] = {
            frame: { x, y: cursorY, w: f.w, h: f.h },
            anchor: meta.anchor,
            scale: meta.scale,
        };
        x += f.w + 8;
    }
    animations[key] = {};
    for (const state of STATE_ORDER) {
        animations[key][state] = {
            frames: stateFrames[state],
            frameRate: oldDef.animations[key][state].frameRate,
            loop: oldDef.animations[key][state].loop,
        };
    }
    cursorY += maxH + 12;
}

// --- new characters (generated) ---
for (const [key, def] of Object.entries(CHARS)) {
    const base = parseMap(def.base, def.palette);
    const attackFrames = makeAttackFrames(base, def);

    const stateFrames = {
        idle: idleFrames(base),
        walk: walkFrames(base),
        attack: attackFrames,
        hurt: [hurtFrame(base)],
        death: [deathFrame(base, Math.floor(base.w / 2), Math.floor(base.h / 3))],
    };

    const allFrames = [];
    for (const state of STATE_ORDER) {
        const names = [];
        for (let i = 0; i < stateFrames[state].length; i++) {
            names.push(`${key}_${state}_${i}`);
        }
        allFrames.push(...stateFrames[state].map((g, i) => ({ name: `${key}_${state}_${i}`, grid: g })));
        animations[key] = animations[key] || {};
        animations[key][state] = {
            frames: names,
            frameRate: state === "idle" ? 3 : state === "walk" ? 6 : state === "attack" ? 6 : 1,
            loop: state !== "hurt" && state !== "death",
        };
    }

    let maxH = 0;
    for (const f of allFrames) {
        maxH = Math.max(maxH, f.grid.h * def.scale);
    }
    let x = 8;
    for (const f of allFrames) {
        const w = f.grid.w * def.scale;
        const h = f.grid.h * def.scale;
        const buf = gridToRgba({ ...f.grid, palette: def.palette }, def.scale);
        blitRgba(buf, w, h, x, cursorY);
        frames[f.name] = {
            frame: { x, y: cursorY, w, h },
            anchor: { x: (f.grid.w * def.scale) / 2, y: (f.grid.h * def.scale) - 4 },
            scale: 1,
        };
        x += w + 8;
    }
    cursorY += maxH + 12;
}

// --- objects (copied verbatim) ---
for (const key of ["potion", "upgrade"]) {
    const f = oldDef.frames[`${key}_0`].frame;
    const meta = oldDef.frames[`${key}_0`];
    blit(old.pixels, f.x, f.y, f.w, f.h, 8, cursorY);
    frames[`${key}_0`] = {
        frame: { x: 8, y: cursorY, w: f.w, h: f.h },
        anchor: meta.anchor,
        scale: meta.scale,
    };
    animations[key] = oldDef.animations[key];
    cursorY += f.h + 12;
}

function makeAttackFrames(base, def) {
    // frame 0: weapon raised at side; frame 1: blade swung forward
    const blade = def.weapon;
    const f0 = overlay(base, blade, base.w - blade.w - 1, Math.floor(base.h / 2) - 2);
    const swung = overlay(overlay(base, blade, base.w - blade.w + 3, Math.floor(base.h / 2) - 5), blade, base.w - blade.w + 3, Math.floor(base.h / 2) + 2);
    return [lean(f0, Math.floor(base.h / 2), 0), lean(swung, Math.floor(base.h / 2), -1)];
}

// --- write outputs ---
const meta = { image: "spritesheet.png", size: { w: SHEET_W, h: SHEET_H } };
const outJson = { meta, frames, animations };
writeFileSync(OLD_JSON, JSON.stringify(outJson, null, 2) + "\n");
writeFileSync(OLD_PNG, encodePng(SHEET_W, SHEET_H, sheet));

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/"))) {
    console.log(`Wrote ${OLD_JSON} and ${OLD_PNG}`);
    console.log(`  frames: ${Object.keys(frames).length}`);
    console.log(`  characters: ${Object.keys(animations).filter((k) => animations[k].attack).join(", ")}`);
}
