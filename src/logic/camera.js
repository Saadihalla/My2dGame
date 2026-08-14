// ======================
// CAMERA (pure)
// ======================

export function createCamera() {
    return {
        x: 0,
        y: 0,
        prevX: 0,
        prevY: 0
    };
}

export function cameraUpdate(cam, target, worldW, worldH, viewW, viewH, dt, smoothing) {
    const idealX = target.x + target.width / 2 - viewW / 2;
    const idealY = target.y + target.height / 2 - viewH / 2;

    cam.prevX = cam.x;
    cam.prevY = cam.y;

    if (smoothing <= 0) {
        cam.x = idealX;
        cam.y = idealY;
    } else {
        cam.x += (idealX - cam.x) * (1 - Math.pow(smoothing, dt));
        cam.y += (idealY - cam.y) * (1 - Math.pow(smoothing, dt));
    }

    // Clamp camera to map bounds
    if (worldW <= viewW) {
        cam.x = (worldW - viewW) / 2;
    } else {
        cam.x = Math.max(0, Math.min(worldW - viewW, cam.x));
    }

    if (worldH <= viewH) {
        cam.y = (worldH - viewH) / 2;
    } else {
        cam.y = Math.max(0, Math.min(worldH - viewH, cam.y));
    }
}

export function worldToScreen(wx, wy, camX, camY) {
    return {
        x: wx - camX,
        y: wy - camY
    };
}

export function screenToWorld(sx, sy, camX, camY) {
    return {
        x: sx + camX,
        y: sy + camY
    };
}

export function viewportRect(camX, camY, viewW, viewH) {
    return {
        x: camX,
        y: camY,
        w: viewW,
        h: viewH
    };
}

export function isInView(wx, wy, ww, wh, camX, camY, viewW, viewH, margin) {
    const m = margin || 0;
    return (
        wx + ww > camX - m &&
        wx < camX + viewW + m &&
        wy + wh > camY - m &&
        wy < camY + viewH + m
    );
}
