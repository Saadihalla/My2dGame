import { Schema, MapSchema, type } from "@colyseus/schema";

export class PlayerState extends Schema {
    @type("string") sessionId: string = "";
    @type("string") username: string = "Hero";
    @type("number") x: number = 400;
    @type("number") y: number = 300;
    @type("number") hp: number = 100;
    @type("number") maxHp: number = 100;
    @type("string") direction: string = "right";
    @type("number") level: number = 1;
    @type("number") xp: number = 0;
    @type("number") xpNext: number = 40;
    @type("number") invuln: number = 0;
    @type("number") dashTimer: number = 0;
    @type("number") dashCooldown: number = 0;
    @type("number") dashDX: number = 1;
    @type("number") dashDY: number = 0;
    @type("number") attackTimer: number = 0;
    @type("number") attackCooldown: number = 0;
    @type("number") damage: number = 20;
    @type("number") range: number = 30;
    @type("boolean") alive: boolean = true;
    @type("number") score: number = 0;
    @type("number") kills: number = 0;
}

export class EnemyState extends Schema {
    @type("string") id: string = "";
    @type("string") type: string = "grunt";
    @type("number") x: number = 0;
    @type("number") y: number = 0;
    @type("number") hp: number = 100;
    @type("number") maxHp: number = 100;
    @type("number") width: number = 40;
    @type("number") height: number = 40;
    @type("string") state: string = "chase";
    @type("string") facing: string = "left";
    @type("number") stateTimer: number = 0;
    @type("number") cooldown: number = 0;
    @type("number") flash: number = 0;
    @type("number") kx: number = 0;
    @type("number") ky: number = 0;
}

export class ProjectileState extends Schema {
    @type("string") id: string = "";
    @type("number") x: number = 0;
    @type("number") y: number = 0;
    @type("number") vx: number = 0;
    @type("number") vy: number = 0;
    @type("number") size: number = 7;
    @type("number") damage: number = 12;
    @type("number") life: number = 4;
    @type("string") color: string = "#c07bff";
}

export class GameState extends Schema {
    @type({ map: PlayerState }) players = new MapSchema<PlayerState>();
    @type({ map: EnemyState }) enemies = new MapSchema<EnemyState>();
    @type({ map: ProjectileState }) projectiles = new MapSchema<ProjectileState>();
    @type("number") wave: number = 1;
    @type("number") waveTimer: number = 0;
    @type("string") waveState: string = "break"; // "break" | "active" | "clear"
    @type("string") status: string = "playing"; // "playing" | "victory" | "gameover"
    @type("number") serverTime: number = 0;
}