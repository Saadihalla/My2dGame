// ======================
// THEME (dark-fantasy visual language + persisted settings)
// ======================

export const COLORS = {
    panel: "#1c1c22",
    panelLight: "#26262f",
    border: "#ffd75a",
    text: "#e6e6e6",
    dim: "#9aa",
    gold: "#ffd75a",
    red: "#ff5a5a",
    green: "#7dff8a",
    blue: "#4a9fe8"
};

// ======================
// SETTINGS (persisted in localStorage)
// ======================

const SETTINGS_KEY = "darkFantasySettings";

export const Settings = {
    volume: 0.5,
    shake: true,
    reducedMotion: false,

    load: function () {
        try {
            const raw = localStorage.getItem(SETTINGS_KEY);
            if (raw) {
                const saved = JSON.parse(raw);
                if (typeof saved.volume === "number") {
                    this.volume = saved.volume;
                }
                if (typeof saved.shake === "boolean") {
                    this.shake = saved.shake;
                }
                if (typeof saved.reducedMotion === "boolean") {
                    this.reducedMotion = saved.reducedMotion;
                }
            }
        } catch {
            // storage unavailable — keep defaults
        }
    },

    save: function () {
        try {
            localStorage.setItem(
                SETTINGS_KEY,
                JSON.stringify({
                    volume: this.volume,
                    shake: this.shake,
                    reducedMotion: this.reducedMotion
                })
            );
        } catch {
            // storage unavailable — ignore
        }
    }
};

Settings.load();

// ======================
// PIXEL FONT
// ======================

export function setFont(ctx, size, bold) {
    ctx.font = (bold ? "bold " : "") + size + "px 'Press Start 2P', monospace";
}

// Centers text if align is "center" (canvas default is left).
export function drawText(ctx, text, x, y, size, color, align) {
    setFont(ctx, size, false);
    ctx.textAlign = align || "left";
    ctx.fillStyle = color || COLORS.text;
    ctx.fillText(text, x, y);
}

// ======================
// PANEL (9-slice style frame)
// ======================

const CORNER = 6;

export function drawPanel(ctx, x, y, w, h, fill) {
    ctx.fillStyle = fill || COLORS.panel;
    ctx.fillRect(x + CORNER, y, w - CORNER * 2, h);
    ctx.fillRect(x, y + CORNER, w, h - CORNER * 2);

    // Border
    ctx.strokeStyle = COLORS.border;
    ctx.lineWidth = 1;

    ctx.beginPath();
    ctx.moveTo(x + CORNER, y);
    ctx.lineTo(x + w - CORNER, y);
    ctx.lineTo(x + w, y + CORNER);
    ctx.lineTo(x + w, y + h - CORNER);
    ctx.lineTo(x + w - CORNER, y + h);
    ctx.lineTo(x + CORNER, y + h);
    ctx.lineTo(x, y + h - CORNER);
    ctx.lineTo(x, y + CORNER);
    ctx.closePath();
    ctx.stroke();

    // Inner gold glints on the top edge
    ctx.fillStyle = "rgba(255, 215, 90, 0.25)";
    ctx.fillRect(x + CORNER + 2, y + 1, w - CORNER * 2 - 4, 1);
}

// ======================
// GRADIENT BAR
// ======================

export function drawGradientBar(ctx, x, y, w, h, ratio, from, to, back) {
    ratio = Math.max(0, Math.min(1, ratio));

    ctx.fillStyle = back || "rgba(0, 0, 0, 0.5)";
    ctx.fillRect(x, y, w, h);

    if (ratio > 0) {
        const gradient = ctx.createLinearGradient(x, y, x, y + h);
        gradient.addColorStop(0, from);
        gradient.addColorStop(1, to);
        ctx.fillStyle = gradient;
        ctx.fillRect(x, y, w * ratio, h);
    }

    ctx.strokeStyle = "rgba(255, 255, 255, 0.6)";
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
}

// ======================
// ICONS (pixel glyphs drawn with rects)
// ======================

export function drawIcon(ctx, kind, x, y, size, color) {
    const c = color || COLORS.gold;
    ctx.fillStyle = c;
    const s = Math.max(4, Math.floor(size / 3));

    if (kind === "sword") {
        // blade
        ctx.fillRect(x + s * 2, y, s, s * 3);
        ctx.fillRect(x + s, y + s * 2, s * 4, s);
        // hilt
        ctx.fillRect(x + s, y + s * 3, s * 4, s);
    } else if (kind === "potion") {
        ctx.fillStyle = COLORS.red;
        ctx.fillRect(x + s, y + s * 2, s * 3, s * 3);
        ctx.fillRect(x + s * 2, y + s * 3, s, s * 3);
        ctx.fillStyle = c;
        ctx.fillRect(x + s * 2, y + s, s, s * 2);
        ctx.fillRect(x + s * 2, y, s * 2, s);
    } else if (kind === "dash") {
        ctx.fillRect(x, y, s * 5, s);
        ctx.fillRect(x + s, y + s, s * 3, s);
        ctx.fillRect(x + s * 2, y + s * 2, s, s * 2);
    } else if (kind === "upgrade") {
        ctx.fillRect(x + s * 2, y, s, s * 5);
        ctx.fillRect(x, y + s * 2, s * 5, s);
    } else if (kind === "heart") {
        ctx.fillStyle = COLORS.red;
        ctx.fillRect(x + s, y + s, s, s);
        ctx.fillRect(x + s * 3, y + s, s, s);
        ctx.fillRect(x, y + s * 2, s * 5, s * 2);
        ctx.fillRect(x + s, y + s * 4, s * 3, s);
    } else if (kind === "skull") {
        ctx.fillStyle = COLORS.dim;
        ctx.fillRect(x + s, y, s * 3, s * 4);
        ctx.fillRect(x, y + s * 2, s * 5, s * 3);
        ctx.fillStyle = "#0a0a0a";
        ctx.fillRect(x + s, y + s, s, s);
        ctx.fillRect(x + s * 3, y + s, s, s);
        ctx.fillRect(x + s * 2, y + s * 3, s, s);
    } else if (kind === "boss") {
        ctx.fillStyle = COLORS.gold;
        ctx.fillRect(x + s, y, s * 3, s);
        ctx.fillRect(x + s * 2, y - s, s, s);
        ctx.fillStyle = c;
        ctx.fillRect(x + s, y + s, s * 3, s * 4);
        ctx.fillRect(x + s, y + s * 4, s, s * 2);
        ctx.fillRect(x + s * 3, y + s * 4, s, s * 2);
    }
}
