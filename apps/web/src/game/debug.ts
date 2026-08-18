// ======================
// GAME DEBUG API (window.__game)
// Dev-only surface that lets AI agents (and humans) observe, drive, and
// assert EVERYTHING in the canvas game: state snapshots, mutations,
// input synthesis, canvas-button clicks, and event watchers.
//
// Enabled in dev builds OR when the page has ?debug=1. Never affects
// the authoritative game server (online authority stays server-side).
// ======================

import {
    gameState,
    wave,
    waveState,
    waveTimer,
    stats,
    setGameState,
    setWave,
    setWaveState,
    setWaveTimer,
    STATE_EVENT
} from "./state";
import { player, enemies, loot, projectiles, spawnEnemy, setDebugFreezeEnemies } from "./entities";
import { getUiButtons } from "./ui";
import { Settings } from "./theme";
import { keys, triggerDash, setAttacking } from "./input";
import { currentLevel } from "./levels";
import { netWorld } from "../net/world";
import {
    startLocalGame,
    restartGame,
    goTitle,
    togglePause,
    onPlayerDeath,
    victory,
    advanceLevel,
    openLevelUpChoice,
    chooseUpgrade,
    openSettings,
    closeSettings
} from "./flow";

export const GAME_EVENT = "df:game";

const ENABLED = import.meta.env.DEV || new URLSearchParams(window.location.search).has("debug");

// ======================
// STATE SNAPSHOT
// ======================

function snapshot(): Record<string, unknown> {
    const byType: Record<string, number> = {};
    for (const e of enemies) {
        byType[e.type] = (byType[e.type] || 0) + 1;
    }

    return {
        state: gameState,
        wave: {
            number: wave,
            state: waveState,
            timer: waveTimer
        },
        stats: { ...stats },
        player: {
            x: player.x,
            y: player.y,
            health: player.health,
            maxHealth: player.maxHealth,
            direction: player.direction,
            level: player.level,
            xp: player.xp,
            xpNext: player.xpNext,
            damage: player.damage,
            range: player.range,
            invuln: player.invuln,
            dashTimer: player.dashTimer,
            dashCooldown: player.dashCooldown,
            pendingLevels: player.pendingLevels,
            pickedUpgrades: player.pickedUpgrades || []
        },
        enemies: {
            count: enemies.length,
            byType,
            list: enemies.slice(0, 25).map(e => ({
                type: e.type,
                x: Math.round(e.x),
                y: Math.round(e.y),
                hp: Math.round(e.health),
                maxHp: e.maxHealth,
                state: e.state
            }))
        },
        loot: loot.length,
        projectiles: projectiles.length,
        settings: {
            volume: Settings.volume,
            shake: Settings.shake,
            reducedMotion: Settings.reducedMotion
        },
        level: currentLevel
            ? { name: currentLevel.name, cols: currentLevel.cols, rows: currentLevel.rows, portal: currentLevel.portal }
            : null,
        net: {
            active: netWorld.active,
            status: netWorld.status,
            wave: netWorld.wave,
            players: netWorld.players.size,
            enemies: netWorld.enemies.size,
            pingMs: Math.round(netWorld.pingMs),
            ended: netWorld.ended,
            localId: netWorld.localId
        }
    };
}

function notify() {
    window.dispatchEvent(new CustomEvent(GAME_EVENT, { detail: snapshot() }));
}

// ======================
// CONTROL
// ======================

let godModeTimer: number | null = null;

const control = {
    setState(next: string) {
        setGameState(next as Parameters<typeof setGameState>[0]);
        notify();
    },

    setHp(value: number) {
        player.health = Math.max(0, Math.min(player.maxHealth, value));
        notify();
    },

    setMaxHp(value: number) {
        player.maxHealth = Math.max(1, value);
        player.health = Math.min(player.health, player.maxHealth);
        notify();
    },

    heal() {
        player.health = player.maxHealth;
        notify();
    },

    damage(amount: number) {
        player.health = Math.max(0, player.health - amount);
        if (player.health <= 0) {
            onPlayerDeath();
        }
        notify();
    },

    setXp(value: number) {
        player.xp = Math.max(0, value);
        notify();
    },

    setLevel(value: number) {
        player.level = Math.max(1, value);
        player.xpNext = 40 + player.level * 25;
        notify();
    },

    addXp(amount: number) {
        player.xp += amount;
        notify();
    },

    teleport(x: number, y: number) {
        player.x = x;
        player.y = y;
        player.prevX = x;
        player.prevY = y;
        notify();
    },

    spawnEnemy(type: string, x?: number, y?: number, hpScale?: number) {
        const ex = x ?? player.x + 120;
        const ey = y ?? player.y;
        spawnEnemy(type, ex, ey, hpScale || 1);
        notify();
    },

    killAllEnemies() {
        for (const e of enemies) {
            e.health = 0;
            e.deadTimer = 0;
        }
        notify();
    },

    setWave(number: number) {
        setWave(Math.max(1, number));
        setWaveState("break");
        setWaveTimer(0.05);
        notify();
    },

    setWaveState(next: string) {
        setWaveState(next);
        notify();
    },

    godMode(on: boolean) {
        if (on && godModeTimer === null) {
            player.invuln = 99999;
            godModeTimer = window.setInterval(() => {
                if (player.invuln < 60) {
                    player.invuln = 99999;
                }
            }, 1000);
        } else if (!on && godModeTimer !== null) {
            window.clearInterval(godModeTimer);
            godModeTimer = null;
            player.invuln = 0;
        }
        notify();
    },

    freezeEnemies(on: boolean) {
        setDebugFreezeEnemies(on);
        notify();
    },

    victory() {
        victory();
        notify();
    },

    gameOver() {
        player.health = 0;
        onPlayerDeath();
        notify();
    },

    start() {
        startLocalGame();
        notify();
    },

    restart() {
        restartGame();
        notify();
    },

    title() {
        goTitle();
        notify();
    },

    pause() {
        if (gameState === "playing") {
            togglePause();
            notify();
        }
    },

    resume() {
        if (gameState === "paused") {
            togglePause();
            notify();
        }
    },

    advanceLevel() {
        advanceLevel();
        notify();
    },

    openUpgrades() {
        openLevelUpChoice();
        notify();
    },

    chooseUpgrade(index: number) {
        chooseUpgrade(index);
        notify();
    },

    addLoot(kind: string, x?: number, y?: number) {
        loot.push({
            kind,
            x: x ?? player.x + player.width / 2,
            y: y ?? player.y + player.height / 2
        });
        notify();
    },

    setVolume(value: number) {
        Settings.volume = Math.max(0, Math.min(1, value));
        notify();
    },

    setShake(on: boolean) {
        Settings.shake = on;
        notify();
    },

    setReducedMotion(on: boolean) {
        Settings.reducedMotion = on;
        notify();
    },

    openSettings() {
        openSettings();
        notify();
    },

    closeSettings() {
        closeSettings();
        notify();
    }
};

// ======================
// INPUT SYNTHESIS
// Drives the SAME input pipeline the real keyboard/mobile handlers use
// (keys / attacking / dashRequested), so prediction and the net sender
// see synthesized input exactly like real input.
// ======================

const input = {
    keyDown(key: string) {
        keys[key] = true;
        notify();
    },

    keyUp(key: string) {
        keys[key] = false;
        notify();
    },

    async press(key: string, ms: number) {
        input.keyDown(key);
        await new Promise(resolve => setTimeout(resolve, ms));
        input.keyUp(key);
    },

    attack(hold: boolean) {
        setAttacking(hold);
        notify();
    },

    dash() {
        triggerDash();
        notify();
    },

    move(vx: number, vy: number) {
        keys["a"] = vx < 0;
        keys["d"] = vx > 0;
        keys["w"] = vy < 0;
        keys["s"] = vy > 0;
        notify();
    },

    clear() {
        for (const key of Object.keys(keys)) {
            keys[key] = false;
        }
        setAttacking(false);
        notify();
    }
};

// ======================
// UI BUTTONS (canvas click surface)
// ======================

const ui = {
    buttons() {
        return getUiButtons().map(b => ({
            label: b.label,
            kind: b.kind,
            key: b.key,
            x: b.x,
            y: b.y,
            w: b.w,
            h: b.h
        }));
    },

    clickButton(label: string): boolean {
        const button = getUiButtons().find(b => b.label === label);
        if (!button) {
            return false;
        }
        button.action();
        notify();
        return true;
    },

    clickAt(x: number, y: number): boolean {
        const button = getUiButtons().find(
            b => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h
        );
        if (!button) {
            return false;
        }
        button.action();
        notify();
        return true;
    }
};

// ======================
// WAITERS / EVENTS
// ======================

function wait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function when(predicate: (state: Record<string, unknown>) => boolean, timeoutMs = 5000): Promise<boolean> {
    const deadline = Date.now() + timeoutMs;
    while (!predicate(snapshot())) {
        if (Date.now() > deadline) {
            return false;
        }
        await wait(100);
    }
    return true;
}

// ======================
// ATTACH
// ======================

export function initGameDebug() {
    if (!ENABLED || (window as unknown as Record<string, unknown>).__game) {
        return;
    }

    const api = { version: 1, snapshot, state: snapshot, control, input, ui, wait, when };

    (window as unknown as Record<string, unknown>).__game = api;

    // Forward normal gameplay state changes to df:game listeners too.
    window.addEventListener(STATE_EVENT, notify);

    console.info("[debug] window.__game ready — agents: state() / control.* / input.* / ui.clickButton(...) / when(...)");
}
