// ======================
// DASH DIRECTION (pure)
// ======================

// Resolves the dash direction from the held movement keys, falling
// back to the player's facing direction when nothing is held.
// Returns a normalized {dx, dy} vector, or null when only a facing
// fallback exists (caller must provide one).

export function dashDirection(heldDx, heldDy, facing) {
    let dx = heldDx;
    let dy = heldDy;

    if (dx === 0 && dy === 0) {
        if (facing === "left") {
            dx = -1;
        } else if (facing === "up") {
            dy = -1;
        } else if (facing === "down") {
            dy = 1;
        } else {
            dx = 1;
        }
    }

    const length = Math.hypot(dx, dy);

    if (length === 0) {
        return null;
    }

    return { dx: dx / length, dy: dy / length };
}