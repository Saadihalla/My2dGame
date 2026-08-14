// ======================
// LEVELS (maps, decor, palettes)
// ======================

const LEVELS = [
    {
        name: "Forest Ruins",
        spawn: { x: 100, y: 100 },
        portal: { x: 660, y: 370 },
        palette: {
            base: "#294d2c",
            grass: "#315d34",
            grassLight: "#3d6d40",
            grassDark: "#254c29",
            wall: "#363636",
            wallLight: "#505050",
            wallDark: "#202020",
            wallCrack: "#181818",
            path: "#6b5136",
            pathLight: "#806346",
            pathDark: "#59422c",
            water: "#193f52",
            waterLight: "#245b70"
        },
        tiles: [
            "################",
            "#..............#",
            "#.......###....#",
            "#.......#.#....#",
            "#..............#",
            "#..............#",
            "#..............#",
            "#..............#",
            "#..............#",
            "################"
        ],
        water: [
            { x: 400, y: 50, w: 200, h: 100 }
        ],
        trees: [
            [70, 70], [700, 70], [70, 380], [700, 380], [330, 70]
        ],
        rocks: [
            [180, 80], [650, 200], [250, 390], [580, 390]
        ],
        grass: [
            [180, 200], [220, 230], [650, 340], [330, 370], [600, 230]
        ],
        torches: [
            [150, 250], [650, 250]
        ],
        path: { y: 275 }
    },
    {
        name: "Crypt of the Pale King",
        spawn: { x: 100, y: 100 },
        portal: { x: 660, y: 370 },
        palette: {
            base: "#33383f",
            grass: "#3d444c",
            grassLight: "#4a525c",
            grassDark: "#2c3138",
            wall: "#2e2e33",
            wallLight: "#46464d",
            wallDark: "#1a1a1e",
            wallCrack: "#121216",
            path: "#4a4140",
            pathLight: "#5c5250",
            pathDark: "#3a3332",
            water: "#1d2b3a",
            waterLight: "#2c4257"
        },
        tiles: [
            "################",
            "#..............#",
            "#..##....##....#",
            "#..............#",
            "#..##....##....#",
            "#..............#",
            "#..............#",
            "#..##....##....#",
            "#..............#",
            "################"
        ],
        water: [
            { x: 150, y: 50, w: 100, h: 100 },
            { x: 550, y: 300, w: 100, h: 80 }
        ],
        trees: [
            [700, 380], [70, 380]
        ],
        rocks: [
            [400, 180], [200, 380], [600, 80], [80, 260]
        ],
        grass: [
            [320, 120], [480, 260], [300, 420], [660, 100]
        ],
        torches: [
            [70, 70], [730, 70], [70, 430], [730, 430], [250, 250], [550, 250]
        ],
        path: { y: 300 }
    },
    {
        name: "Highlands of Ember",
        spawn: { x: 100, y: 100 },
        portal: { x: 680, y: 400 },
        palette: {
            base: "#2e4030",
            grass: "#3a5238",
            grassLight: "#486444",
            grassDark: "#27382a",
            wall: "#3f3a33",
            wallLight: "#5a534a",
            wallDark: "#28241f",
            wallCrack: "#1c1915",
            path: "#5c4a36",
            pathLight: "#6e5a44",
            pathDark: "#4a3c2c",
            water: "#1f4a5a",
            waterLight: "#2d6a7d"
        },
        tiles: [
            "################",
            "#..............#",
            "#..............#",
            "#....##..##....#",
            "#..............#",
            "#....##..##....#",
            "#..............#",
            "#..............#",
            "#..............#",
            "################"
        ],
        water: [
            { x: 100, y: 60, w: 80, h: 80 },
            { x: 620, y: 60, w: 80, h: 80 }
        ],
        trees: [
            [70, 70], [730, 70], [70, 430], [730, 430], [250, 220], [550, 220]
        ],
        rocks: [
            [350, 120], [450, 120], [300, 300], [500, 300], [700, 400], [100, 400]
        ],
        grass: [
            [180, 200], [600, 240], [330, 370], [200, 320], [550, 380]
        ],
        torches: [
            [200, 150], [600, 150], [150, 350], [650, 350]
        ],
        path: { y: 275 }
    }
];

let levelIndex = 0;
let currentLevel = null;
let currentMap = [];
let solidObjects = [];
let currentTorches = [];

function buildLevel(index) {
    levelIndex = index;
    currentLevel = LEVELS[index];

    currentMap = [];
    for (const line of currentLevel.tiles) {
        const row = [];
        for (const ch of line) {
            row.push(ch === "#" ? 1 : 0);
        }
        currentMap.push(row);
    }

    solidObjects = [];
    currentTorches = [];

    for (const water of currentLevel.water) {
        solidObjects.push(water);
    }

    for (const tree of currentLevel.trees) {
        solidObjects.push({ x: tree[0] - 10, y: tree[1] - 16, w: 38, h: 52 });
    }

    for (const rock of currentLevel.rocks) {
        solidObjects.push({ x: rock[0] - 3, y: rock[1] - 3, w: 32, h: 20 });
    }

    for (const torch of currentLevel.torches) {
        currentTorches.push({ x: torch[0], y: torch[1] });
    }
}

// ======================
// COLLISION
// ======================

function aabb(a, b) {
    return (
        a.x < b.x + b.w &&
        a.x + a.w > b.x &&
        a.y < b.y + b.h &&
        a.y + a.h > b.y
    );
}

function isColliding(x, y, width, height) {
    const left = Math.floor(x / TILE);
    const right = Math.floor((x + width - 1) / TILE);
    const top = Math.floor(y / TILE);
    const bottom = Math.floor((y + height - 1) / TILE);

    for (let row = top; row <= bottom; row++) {
        for (let column = left; column <= right; column++) {
            if (
                row < 0 ||
                row >= currentMap.length ||
                column < 0 ||
                column >= currentMap[row].length
            ) {
                return true;
            }

            if (currentMap[row][column] === 1) {
                return true;
            }
        }
    }

    for (const object of solidObjects) {
        if (
            x < object.x + object.w &&
            x + width > object.x &&
            y < object.y + object.h &&
            y + height > object.y
        ) {
            return true;
        }
    }

    return false;
}

// ======================
// DRAW MAP
// ======================

function drawGrassTile(x, y, p) {
    ctx.fillStyle = p.grass;
    ctx.fillRect(x, y, TILE, TILE);

    ctx.fillStyle = p.grassLight;

    ctx.fillRect(x + 7, y + 9, 3, 3);
    ctx.fillRect(x + 31, y + 13, 2, 3);
    ctx.fillRect(x + 18, y + 34, 3, 2);
    ctx.fillRect(x + 40, y + 27, 2, 3);

    ctx.fillStyle = p.grassDark;

    ctx.fillRect(x + 12, y + 25, 2, 5);
    ctx.fillRect(x + 34, y + 39, 3, 2);
}

function drawStoneTile(x, y, p) {
    ctx.fillStyle = p.wall;
    ctx.fillRect(x, y, TILE, TILE);

    ctx.fillStyle = p.wallLight;
    ctx.fillRect(x + 2, y + 2, TILE - 4, 7);

    ctx.fillStyle = p.wallDark;
    ctx.fillRect(x + 2, y + 41, TILE - 4, 7);

    ctx.fillStyle = p.wallCrack;

    ctx.fillRect(x + 8, y + 19, 13, 2);
    ctx.fillRect(x + 18, y + 20, 2, 9);
    ctx.fillRect(x + 32, y + 13, 9, 2);
    ctx.fillRect(x + 34, y + 14, 2, 7);
}

function drawTree(x, y) {
    ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
    ctx.fillRect(x - 15, y + 30, 45, 10);

    ctx.fillStyle = "#4b3020";
    ctx.fillRect(x, y, 15, 35);

    ctx.fillStyle = "#163d20";
    ctx.fillRect(x - 15, y - 15, 45, 25);
    ctx.fillRect(x - 8, y - 25, 30, 20);

    ctx.fillStyle = "#285b2d";
    ctx.fillRect(x - 8, y - 18, 25, 12);
    ctx.fillRect(x - 3, y - 28, 18, 12);
}

function drawRock(x, y) {
    ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
    ctx.fillRect(x - 5, y + 12, 35, 8);

    ctx.fillStyle = "#555";
    ctx.fillRect(x, y, 30, 15);
    ctx.fillRect(x + 5, y - 5, 20, 20);

    ctx.fillStyle = "#707070";
    ctx.fillRect(x + 7, y - 2, 10, 5);
}

function drawGrass(x, y) {
    ctx.fillStyle = "#4c7c45";

    ctx.fillRect(x, y, 3, 10);
    ctx.fillRect(x + 5, y - 4, 3, 14);
    ctx.fillRect(x + 10, y + 2, 3, 8);
}

function drawTorch(x, y, time) {
    ctx.fillStyle = "#4a2d1c";
    ctx.fillRect(x, y, 6, 30);

    const flicker = Math.sin(time * 13 + x) * 2.5;

    ctx.fillStyle = "#ff9d22";
    ctx.fillRect(x - 4, y - 12 - flicker * 0.4, 14, 14 + flicker);

    ctx.fillStyle = "#ffe36b";
    ctx.fillRect(x - 1, y - 9 - flicker * 0.4, 8, 9 + flicker);
}

function drawMap(time) {
    const p = currentLevel.palette;

    ctx.fillStyle = p.base;
    ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);

    for (let row = 0; row < currentMap.length; row++) {
        for (let column = 0; column < currentMap[row].length; column++) {
            const x = column * TILE;
            const y = row * TILE;

            if (currentMap[row][column] === 0) {
                drawGrassTile(x, y, p);
            } else {
                drawStoneTile(x, y, p);
            }
        }
    }

    // Dirt path

    if (currentLevel.path) {
        const py = currentLevel.path.y;

        ctx.fillStyle = p.path;
        ctx.fillRect(50, py, 700, 45);

        ctx.fillStyle = p.pathLight;
        ctx.fillRect(50, py + 7, 700, 30);

        ctx.fillStyle = p.pathDark;

        ctx.fillRect(120, py + 15, 15, 4);
        ctx.fillRect(240, py + 25, 9, 3);
        ctx.fillRect(390, py + 11, 13, 4);
        ctx.fillRect(520, py + 27, 18, 3);
        ctx.fillRect(650, py + 16, 10, 4);

        // Redraw walls under the path so they stay visible

        const startRow = Math.floor(py / TILE);
        const endRow = Math.floor((py + 45) / TILE);

        for (let row = startRow; row <= endRow; row++) {
            for (let column = 1; column <= 14; column++) {
                if (currentMap[row][column] === 1) {
                    drawStoneTile(column * TILE, row * TILE, p);
                }
            }
        }
    }

    // Water

    for (const water of currentLevel.water) {
        ctx.fillStyle = p.water;
        ctx.fillRect(water.x, water.y, water.w, water.h);

        ctx.fillStyle = p.waterLight;

        for (let y = water.y + 10; y < water.y + water.h - 5; y += 20) {
            ctx.fillRect(water.x + 10, y, water.w * 0.22, 3);
            ctx.fillRect(water.x + water.w * 0.45, y + 7, water.w * 0.27, 3);
            ctx.fillRect(water.x + water.w * 0.78, y, water.w * 0.12, 3);
        }
    }

    // Trees / rocks / grass tufts

    for (const tree of currentLevel.trees) {
        drawTree(tree[0], tree[1]);
    }

    for (const rock of currentLevel.rocks) {
        drawRock(rock[0], rock[1]);
    }

    for (const grass of currentLevel.grass) {
        drawGrass(grass[0], grass[1]);
    }

    // Torches

    for (const torch of currentLevel.torches) {
        drawTorch(torch[0], torch[1], time);
    }
}

// ======================
// TORCH LIGHT
// ======================

function drawTorchLights(time) {
    ctx.globalCompositeOperation = "lighter";

    for (const torch of currentTorches) {
        const flicker = Math.sin(time * 9 + torch.x) * 10;
        const radius = 120 + flicker;
        const gx = torch.x + 3;
        const gy = torch.y - 5;

        const gradient = ctx.createRadialGradient(gx, gy, 5, gx, gy, radius);

        gradient.addColorStop(0, "rgba(255, 150, 50, 0.30)");
        gradient.addColorStop(1, "rgba(255, 150, 50, 0)");

        ctx.fillStyle = gradient;
        ctx.fillRect(gx - radius, gy - radius, radius * 2, radius * 2);
    }

    ctx.globalCompositeOperation = "source-over";
}