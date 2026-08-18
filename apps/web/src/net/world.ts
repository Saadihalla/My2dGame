// ======================
// NET WORLD — mirror of the authoritative game room
// Ingests Colyseus state patches, keeps a time-stamped snapshot buffer
// for interpolation, runs client prediction for the local player, and
// reconciles against server truth.
// ======================

import {
    movePlayer,
    createNetPlayer,
    PLAYER_WIDTH,
    PLAYER_HEIGHT,
    type NetInput,
    type NetPlayer
} from "@dark-fantasy/sim";
import { camera } from "../game/state";
import { cameraUpdate } from "@dark-fantasy/sim";

// Net layer must not import game/config (it touches the canvas at
// module load) — the render viewport is fixed, mirror the constants.
const VIEW_WIDTH = 800;
const VIEW_HEIGHT = 500;

const WORLD_W = 1600;
const WORLD_H = 1200;

// Render behind the latest snapshot by this much so interpolation has
// a snapshot to blend toward (20Hz patches -> 50ms + a safety margin).
const INTERPOLATION_DELAY = 0.11;
const SNAPSHOT_BUFFER = 24;
const RECONCILE_SNAP_DIST = 40;

export interface RemotePlayerView {
    id: string;
    name: string;
    x: number;
    y: number;
    prevX: number;
    prevY: number;
    hp: number;
    maxHp: number;
    direction: string;
    level: number;
    score: number;
    kills: number;
    alive: boolean;
    attackTimer: number;
    invuln: number;
    dashTimer: number;
}

export interface EnemyView {
    id: string;
    type: string;
    x: number;
    y: number;
    prevX: number;
    prevY: number;
    hp: number;
    maxHp: number;
    width: number;
    height: number;
    state: string;
    facing: string;
    flash: number;
}

export interface ProjectileView {
    x: number;
    y: number;
    size: number;
    color: string;
    damage: number;
}

export interface MatchEndInfo {
    status: string;
    wave: number;
    results: Array<{ sessionId: string; username: string; score: number; kills: number; wave: number; level: number }>;
}

interface SnapshotPlayer {
    x: number;
    y: number;
    hp: number;
    maxHp: number;
    alive: boolean;
    direction: string;
    level: number;
    score: number;
    kills: number;
    name: string;
    dashTimer: number;
    attackTimer: number;
    invuln: number;
}

interface SnapshotEnemy {
    type: string;
    x: number;
    y: number;
    hp: number;
    maxHp: number;
    width: number;
    height: number;
    state: string;
    facing: string;
    flash: number;
}

interface SnapshotProjectile {
    x: number;
    y: number;
    size: number;
    color: string;
}

interface Snapshot {
    t: number;
    players: Map<string, SnapshotPlayer>;
    enemies: Map<string, SnapshotEnemy>;
    projectiles: SnapshotProjectile[];
}

export const netWorld = {
    active: false,
    localId: "",
    players: new Map<string, RemotePlayerView>(),
    enemies: new Map<string, EnemyView>(),
    projectiles: [] as ProjectileView[],
    wave: 1,
    waveState: "break" as string,
    status: "playing" as string,
    pingMs: 0,
    ended: false,
    endInfo: null as MatchEndInfo | null,
    predicted: null as NetPlayer | null,

    // render clock in seconds, aligned to serverTime on first snapshot
    clock: 0,

    // input for the prediction step (shared queue, dash edge-detected)
    currentInput: { vx: 0, vy: 0, dash: false, attack: false } as NetInput,
    lastDash: false,

    snapshots: [] as Snapshot[],
    endLeaveTimer: 0
};

// ======================
// ACTIVATION
// ======================

export function activateNetWorld(localId: string) {
    netWorld.active = true;
    netWorld.localId = localId;
    netWorld.players.clear();
    netWorld.enemies.clear();
    netWorld.projectiles = [];
    netWorld.snapshots = [];
    netWorld.wave = 1;
    netWorld.waveState = "break";
    netWorld.status = "playing";
    netWorld.pingMs = 0;
    netWorld.ended = false;
    netWorld.endInfo = null;
    netWorld.endLeaveTimer = 0;
    netWorld.clock = 0;

    const spawnX = WORLD_W / 2;
    const spawnY = WORLD_H / 2;
    netWorld.predicted = createNetPlayer(localId, "", spawnX, spawnY);
}

export function deactivateNetWorld() {
    netWorld.active = false;
    netWorld.predicted = null;
    netWorld.players.clear();
    netWorld.enemies.clear();
    netWorld.projectiles = [];
    netWorld.snapshots = [];
    netWorld.ended = false;
    netWorld.endInfo = null;
}

// ======================
// INGEST (called on every room state change)
// ======================

export function ingestNetState(state: any) {
    if (!netWorld.active) {
        return;
    }

    const snapshot: Snapshot = {
        t: state.serverTime,
        players: new Map(),
        enemies: new Map(),
        projectiles: []
    };

    state.players.forEach((p: any, sessionId: string) => {
        const entry = {
            x: p.x, y: p.y,
            hp: p.hp, maxHp: p.maxHp,
            alive: p.alive, direction: p.direction,
            level: p.level, score: p.score, kills: p.kills,
            name: p.username,
            dashTimer: p.dashTimer, attackTimer: p.attackTimer, invuln: p.invuln
        };
        snapshot.players.set(sessionId, entry);

        if (sessionId === netWorld.localId && netWorld.predicted) {
            // Adopt authoritative fields; keep predicted position unless
            // the server disagrees beyond the snap threshold.
            const predicted = netWorld.predicted;
            const dx = p.x - predicted.x;
            const dy = p.y - predicted.y;
            if (Math.hypot(dx, dy) > RECONCILE_SNAP_DIST) {
                predicted.x = p.x;
                predicted.y = p.y;
            }
            predicted.hp = p.hp;
            predicted.maxHp = p.maxHp;
            predicted.alive = p.alive;
            predicted.direction = p.direction as NetPlayer["direction"];
            predicted.level = p.level;
            predicted.xp = p.xp;
            predicted.xpNext = p.xpNext;
            predicted.dashCooldown = p.dashCooldown;
            predicted.dashTimer = p.dashTimer;
            predicted.invuln = p.invuln;
            predicted.attackCooldown = p.attackCooldown;
            predicted.attackTimer = p.attackTimer;
            predicted.damage = p.damage;
            predicted.range = p.range;
            predicted.score = p.score;
            predicted.kills = p.kills;
        }
    });

    state.enemies.forEach((e: any, id: string) => {
        snapshot.enemies.set(id, {
            type: e.type,
            x: e.x, y: e.y,
            hp: e.hp, maxHp: e.maxHp,
            width: e.width, height: e.height,
            state: e.state, facing: e.facing, flash: e.flash
        });
    });

    state.projectiles.forEach((pr: any) => {
        snapshot.projectiles.push({ x: pr.x, y: pr.y, size: pr.size, color: pr.color });
    });

    netWorld.snapshots.push(snapshot);
    if (netWorld.snapshots.length > SNAPSHOT_BUFFER) {
        netWorld.snapshots.shift();
    }

    // Render clock alignment: keep a smooth local clock; the offset is
    // pinned on the first snapshot so interpolation is stable.
    if (netWorld.clock === 0) {
        netWorld.clock = snapshot.t / 1000;
    }

    netWorld.wave = state.wave;
    netWorld.waveState = state.waveState;
    netWorld.status = state.status;

    if (state.status === "victory" || state.status === "gameover") {
        netWorld.ended = true;
    }
}

export function ingestMatchEnd(info: MatchEndInfo) {
    netWorld.ended = true;
    netWorld.endInfo = info;
    netWorld.status = info.status;
}

// ======================
// PREDICTION (called once per fixed timestep while active)
// ======================

export function predictPlayer(dt: number, input: NetInput) {
    const predicted = netWorld.predicted;
    if (!predicted || !netWorld.active) {
        return;
    }

    netWorld.currentInput = input;

    // Dash is edge-triggered: only the first frame of a held dash flag
    // triggers a dash (the server sees the same single true).
    const dashEdge = input.dash && !netWorld.lastDash;
    netWorld.lastDash = input.dash;

    movePlayer(predicted, { ...input, dash: dashEdge }, dt, {
        canMove: (x, y, w, h) => x >= 0 && y >= 0 && x + w <= WORLD_W && y + h <= WORLD_H
    });
}

// ======================
// RENDER SAMPLING (interpolation between snapshots)
// ======================

export function renderTick(dt: number) {
    netWorld.clock += dt;

    const target = netWorld.clock - INTERPOLATION_DELAY;
    const samples = sampleAt(target);

    // Rebuild render views from the sampled snapshot
    netWorld.players.clear();
    netWorld.enemies.clear();
    netWorld.projectiles = [];

    for (const [id, s] of samples.players) {
        netWorld.players.set(id, {
            id,
            name: s.name,
            x: s.x,
            y: s.y,
            prevX: s.x,
            prevY: s.y,
            hp: s.hp,
            maxHp: s.maxHp,
            direction: s.direction,
            level: s.level,
            score: s.score,
            kills: s.kills,
            alive: s.alive,
            attackTimer: s.attackTimer,
            invuln: s.invuln,
            dashTimer: s.dashTimer
        });
    }

    for (const [id, s] of samples.enemies) {
        netWorld.enemies.set(id, {
            id,
            type: s.type,
            x: s.x,
            y: s.y,
            prevX: s.x,
            prevY: s.y,
            hp: s.hp,
            maxHp: s.maxHp,
            width: s.width,
            height: s.height,
            state: s.state,
            facing: s.facing,
            flash: s.flash
        });
    }

    for (const p of samples.projectiles) {
        netWorld.projectiles.push({ x: p.x, y: p.y, size: p.size, color: p.color, damage: 0 });
    }
    // Camera follows the predicted local player
    const predicted = netWorld.predicted;
    const focus = predicted
        ? { x: predicted.x, y: predicted.y, width: PLAYER_WIDTH, height: PLAYER_HEIGHT }
        : { x: WORLD_W / 2, y: WORLD_H / 2, width: PLAYER_WIDTH, height: PLAYER_HEIGHT };
    cameraUpdate(camera, focus, WORLD_W, WORLD_H, VIEW_WIDTH, VIEW_HEIGHT, dt, 0.08);
}

interface SampledWorld {
    players: Map<string, SnapshotPlayer>;
    enemies: Map<string, SnapshotEnemy>;
    projectiles: SnapshotProjectile[];
}

function sampleAt(targetT: number): SampledWorld {
    const snaps = netWorld.snapshots;
    const out: SampledWorld = { players: new Map(), enemies: new Map(), projectiles: [] };

    if (snaps.length === 0) {
        return out;
    }

    // The render clock runs in seconds; snapshot timestamps are ms.
    const targetMs = targetT * 1000;

    // Find the pair bracketing targetMs
    let s0 = snaps[0];
    let s1: Snapshot | null = null;

    for (let i = 0; i < snaps.length; i++) {
        if (snaps[i].t <= targetMs) {
            s0 = snaps[i];
        } else {
            s1 = snaps[i];
            break;
        }
    }

    // Fall back when the buffer is empty on one side
    if (!s1) {
        s1 = s0;
    }

    const t0 = s0.t;
    const t1 = s1.t;
    const span = Math.max(1, t1 - t0);
    const a = Math.max(0, Math.min(1, (targetMs - t0) / span));

    // Players: interpolate positions between snapshots
    for (const [id, p0] of s0.players) {
        const p1 = s1.players.get(id);
        out.players.set(id, {
            x: p0.x + (p1 ? (p1.x - p0.x) * a : 0),
            y: p0.y + (p1 ? (p1.y - p0.y) * a : 0),
            hp: p0.hp,
            maxHp: p0.maxHp,
            alive: p0.alive,
            direction: p0.direction,
            level: p0.level,
            score: p0.score,
            kills: p0.kills,
            name: p0.name,
            dashTimer: p0.dashTimer,
            attackTimer: p0.attackTimer,
            invuln: p0.invuln
        });
    }

    // New players (only in s1)
    for (const [id, p1] of s1.players) {
        if (!s0.players.has(id)) {
            out.players.set(id, { ...p1 });
        }
    }

    // Enemies
    for (const [id, e0] of s0.enemies) {
        const e1 = s1.enemies.get(id);
        out.enemies.set(id, {
            type: e0.type,
            x: e0.x + (e1 ? (e1.x - e0.x) * a : 0),
            y: e0.y + (e1 ? (e1.y - e0.y) * a : 0),
            hp: e0.hp,
            maxHp: e0.maxHp,
            width: e0.width,
            height: e0.height,
            state: e0.state,
            facing: e0.facing,
            flash: e0.flash
        });
    }

    for (const [id, e1] of s1.enemies) {
        if (!s0.enemies.has(id)) {
            out.enemies.set(id, { ...e1 });
        }
    }

    // Projectiles: interpolate by velocity if available in both
    out.projectiles = s1.projectiles.slice();

    return out;
}

// ======================
// MISC
// ======================

export function netBoundary(): { w: number; h: number } {
    return { w: WORLD_W, h: WORLD_H };
}

export function isNetActive(): boolean {
    return netWorld.active;
}

// Dev handle for E2E tooling: exposes the live net world so tests can
// assert on predicted positions, ping, wave, and match state.
if (import.meta.env.DEV) {
    (window as any).__net = { netWorld, sampleAt };
}