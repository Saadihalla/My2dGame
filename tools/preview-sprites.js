// Quick visual QA: prints ASCII previews of the new characters' frames
// and validates every frame rect against the sheet bounds.
import { readFileSync } from "node:fs";
import { decodePng } from "./generate-sprites.js";

const def = JSON.parse(readFileSync("public/assets/spritesheet.json", "utf8"));
const sheet = decodePng("public/assets/spritesheet.png");

// 1. validate bounds (mirrors src/assets.js validateSheet)
let ok = true;
for (const [name, f] of Object.entries(def.frames)) {
    const r = f.frame;
    if (r.x < 0 || r.y < 0 || r.x + r.w > sheet.width || r.y + r.h > sheet.height) {
        console.error("OUT OF BOUNDS:", name, JSON.stringify(r));
        ok = false;
    }
}
console.log(ok ? "All frame rects in bounds." : "Frame bounds FAILED.");

// 2. ASCII preview of idle/attack/death for each new character
function ascii(name) {
    const f = def.frames[name].frame;
    const out = [];
    const sx = Math.max(1, Math.floor(f.w / 48));
    const sy = Math.max(1, Math.floor(f.h / 24));
    for (let y = 0; y < f.h; y += sy) {
        let row = "";
        for (let x = 0; x < f.w; x += sx) {
            const i = ((f.y + y) * sheet.width + (f.x + x)) * 4;
            row += sheet.pixels[i + 3] > 128 ? "#" : " ";
        }
        out.push(row.replace(/\s+$/, ""));
    }
    return out.join("\n");
}

for (const key of ["grunt", "fast", "swarm", "tank", "boss"]) {
    console.log(`\n=== ${key} idle ===`);
    console.log(ascii(`${key}_idle_0`));
    console.log(`\n=== ${key} attack_1 ===`);
    console.log(ascii(`${key}_attack_1`));
    console.log(`\n=== ${key} death ===`);
    console.log(ascii(`${key}_death_0`));
}
