// ======================
// TWEEN (pure easing/tween helpers)
// ======================

export function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

export function lerp(a, b, t) {
    return a + (b - a) * t;
}

// Normalizes elapsed time against a duration into 0..1, clamped.
export function tweenProgress(elapsed, duration) {
    if (duration <= 0) {
        return 1;
    }
    return clamp(elapsed / duration, 0, 1);
}

// Standard easing curves. All take t in [0, 1] and return eased t.

export function easeIn(t) {
    return t * t;
}

export function easeOut(t) {
    return 1 - (1 - t) * (1 - t);
}

export function easeInOut(t) {
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

export function easeOutBack(t) {
    if (t <= 0) {
        return 0;
    }
    if (t >= 1) {
        return 1;
    }
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

export function easeOutElastic(t) {
    if (t === 0 || t === 1) {
        return t;
    }
    const c4 = (2 * Math.PI) / 3;
    return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
}

export function easeOutBounce(t) {
    const n1 = 7.5625;
    const d1 = 2.75;
    if (t < 1 / d1) {
        return n1 * t * t;
    }
    if (t < 2 / d1) {
        t -= 1.5 / d1;
        return n1 * t * t + 0.75;
    }
    if (t < 2.5 / d1) {
        t -= 2.25 / d1;
        return n1 * t * t + 0.9375;
    }
    t -= 2.625 / d1;
    return n1 * t * t + 0.984375;
}

// One-shot tween state machine: tween({ t: 0, from, to, duration }, dt)
// advances t and returns the interpolated value via the supplied curve.
export function tween(state, dt) {
    state.t += dt;
    const p = tweenProgress(state.t, state.duration);
    const curve = state.curve || easeOut;
    return lerp(state.from, state.to, curve(p));
}
