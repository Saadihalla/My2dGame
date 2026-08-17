// ======================
// SHARED SIMULATION TYPES
// ======================

export interface Vec2 {
    x: number;
    y: number;
}

export interface Rect {
    x: number;
    y: number;
    w: number;
    h: number;
}

export interface CameraState {
    x: number;
    y: number;
    prevX: number;
    prevY: number;
}

// Direction vector produced by dashDirection (kept as dx/dy for
// compatibility with the original game code).
export interface Dir2 {
    dx: number;
    dy: number;
}

// Anything the camera can follow: a world-space position plus a size.
export interface CameraTarget {
    x: number;
    y: number;
    width: number;
    height: number;
}

export type Direction = "left" | "right" | "up" | "down";

export interface Palette {
    base: string;
    grass: string;
    grassLight: string;
    grassDark: string;
    wall: string;
    wallLight: string;
    wallDark: string;
    wallCrack: string;
    path: string;
    pathLight: string;
    pathDark: string;
    water: string;
    waterLight: string;
}

export interface LevelDef {
    name: string;
    cols: number;
    rows: number;
    spawn: Vec2;
    portal: Vec2;
    palette: Palette;
    tiles: string[];
    water: Rect[];
    trees: Array<[number, number]>;
    rocks: Array<[number, number]>;
    grass: Array<[number, number]>;
    torches: Array<[number, number]>;
    path: { y: number };
}

// Tile grid as compiled from a LevelDef (1 = solid wall, 0 = open).
export type GridMap = number[][];

// ======================
// SPRITE SHEET
// ======================

export interface FrameRect {
    x: number;
    y: number;
    w: number;
    h: number;
}

export interface SheetFrame {
    frame: FrameRect;
    anchor?: Vec2;
    scale?: number;
}

export interface SheetAnim {
    frames: string[];
    frameRate?: number;
    loop?: boolean;
}

export interface SpriteSheetDef {
    frames: Record<string, SheetFrame>;
    animations: Record<string, Record<string, SheetAnim>>;
    meta?: {
        size?: {
            w: number;
            h: number;
        };
    };
}

// ======================
// UPGRADES
// ======================

export interface Upgrade {
    id: string;
    name: string;
    desc: string;
}

// ======================
// ENEMY AI
// ======================

export type EnemyState = "chase" | "windup" | "strike" | "recover" | "retreat";

export interface AIDecisionContext {
    stateTimerDone: boolean;
    inRange: boolean;
    cooldownReady: boolean;
    type: string;
    hpRatio: number;
    retreatRoll: number;
    dist: number;
    timers: {
        windup: number;
        strike: number;
        recover: number;
        cooldown: number;
    };
}

export interface AIDecision {
    state?: EnemyState;
    timer?: number;
    cooldown?: number;
}

// ======================
// SPAWNING
// ======================

export interface SpawnOptions {
    bounds?: Rect;
    minPlayerDist?: number;
    minSep?: number;
    maxAttempts?: number;
    tileSize?: number;
}

// ======================
// TWEEN
// ======================

export type EasingFn = (t: number) => number;

export interface TweenState {
    t: number;
    from: number;
    to: number;
    duration: number;
    curve?: EasingFn;
}