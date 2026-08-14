// ======================
// COLLISION (pure)
// ======================

export function aabb(a, b) {
    return (
        a.x < b.x + b.w &&
        a.x + a.w > b.x &&
        a.y < b.y + b.h &&
        a.y + a.h > b.y
    );
}

export function isColliding(x, y, width, height, map, solids, tileSize) {
    const size = tileSize || 50;

    const left = Math.floor(x / size);
    const right = Math.floor((x + width - 1) / size);
    const top = Math.floor(y / size);
    const bottom = Math.floor((y + height - 1) / size);

    for (let row = top; row <= bottom; row++) {
        for (let column = left; column <= right; column++) {
            if (
                row < 0 ||
                row >= map.length ||
                column < 0 ||
                column >= map[row].length
            ) {
                return true;
            }

            if (map[row][column] === 1) {
                return true;
            }
        }
    }

    for (const object of solids) {
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