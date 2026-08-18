import { Room, Client } from "@colyseus/core";
import { GameState, PlayerState, EnemyState, ProjectileState } from "./schema/GameState.js";
import {
    createNetPlayer,
    spawnNetEnemy,
    movePlayer,
    applyPlayerAttack,
    updateNetEnemy,
    updateNetProjectiles,
    netProjectileFrom,
    netWaveList,
    netHpScale,
    coopMaxHp,
    PLAYER_WIDTH,
    PLAYER_HEIGHT,
    ATTACK_DURATION,
    ATTACK_COOLDOWN,
    PLAYER_IFRAMES,
    gainPlayerXp,
    WAVE_VICTORY,
    type NetInput,
    type NetPlayer,
    type NetEnemy,
    type NetProjectile
} from "@dark-fantasy/sim";

const WORLD_W = 1600;
const WORLD_H = 1200;
const WAVE_BREAK_TIME = 3;
const WAVE_CLEAR_TIME = 2.5;
const SPAWN_INSET = 200;

interface JoinOptions {
    username?: string;
}

interface PlayerStats {
    sessionId: string;
    username: string;
    score: number;
    kills: number;
    survived: number;
    damageDealt: number;
    wave: number;
    level: number;
}

// Authoritative co-op match room. Runs the shared sim combat rules at
// 60Hz and streams delta-encoded state at ~20Hz. The browser mirrors
// this state for prediction + interpolation.
export class GameRoom extends Room<GameState> {
    maxClients = 4;

    private inputs = new Map<string, NetInput>();
    private players = new Map<string, NetPlayer>();
    private enemies = new Map<string, NetEnemy>();
    private projectiles: NetProjectile[] = [];
    private damageDealt = new Map<string, number>();
    private lastHurt = new Map<string, number>();
    private simTime = 0;
    private wave = 1;
    private waveState: "break" | "active" | "clear" = "break";
    private waveTimer = WAVE_BREAK_TIME;
    private ended = false;

    // Small co-op regen: after 3s without taking a hit the player
    // recovers 3hp/s. Keeps a group alive between waves without
    // removing the threat of being swarmed.
    private static readonly REGEN_DELAY = 3;
    private static readonly REGEN_RATE = 3;

    onCreate() {
        this.setState(new GameState());
        this.state.status = "playing";

        this.onMessage("input", (client, input: NetInput) => {
            if (input && typeof input.vx === "number" && typeof input.vy === "number") {
                this.inputs.set(client.sessionId, {
                    vx: Math.max(-1, Math.min(1, input.vx)),
                    vy: Math.max(-1, Math.min(1, input.vy)),
                    dash: !!input.dash,
                    attack: !!input.attack
                });
            }
        });

        // Round-trip latency probe: echo the client timestamp back.
        this.onMessage("ping", (client, timestamp: number) => {
            client.send("pong", timestamp);
        });

        this.setSimulationInterval(dt => this.tick(dt / 1000), 16.6);
        this.setPatchRate(50);
    }

    onJoin(client: Client, options?: JoinOptions) {
        const player = createNetPlayer(
            client.sessionId,
            options?.username || `Hero_${client.sessionId.slice(0, 4)}`,
            WORLD_W / 2 + (Math.random() - 0.5) * 200,
            WORLD_H / 2 + (Math.random() - 0.5) * 200,
            coopMaxHp(this.players.size + 1)
        );

        this.players.set(client.sessionId, player);
        this.syncPlayer(client.sessionId);
    }

    onLeave(client: Client) {
        // Keep the seat for a brief reconnection window.
        if (!this.ended) {
            this.allowReconnection(client, 15);
        }

        this.inputs.delete(client.sessionId);

        if (this.ended) {
            this.players.delete(client.sessionId);
        }
    }

    private canMove(x: number, y: number, w: number, h: number): boolean {
        return x >= 0 && y >= 0 && x + w <= WORLD_W && y + h <= WORLD_H;
    }

    private tick(dt: number) {
        if (this.ended || this.players.size === 0) {
            return;
        }

        this.simTime += dt;
        this.state.serverTime = Math.round(this.simTime * 1000);

        const living = Array.from(this.players.values()).filter(p => p.alive);

        // ---- Player input -> movement + attack ----
        for (const [sessionId, player] of this.players) {
            if (!player.alive) {
                continue;
            }

            const input = this.inputs.get(sessionId) || { vx: 0, vy: 0, dash: false, attack: false };

            movePlayer(player, input, dt, {
                canMove: this.canMove.bind(this)
            });

            if (input.attack && player.attackCooldown <= 0) {
                player.attackTimer = ATTACK_DURATION;
                player.attackCooldown = ATTACK_COOLDOWN;

                const { hits, damage } = applyPlayerAttack(player, Array.from(this.enemies.values()), Math.random);
                this.damageDealt.set(sessionId, (this.damageDealt.get(sessionId) || 0) + damage);

                for (const id of hits) {
                    const e = this.enemies.get(id);
                    if (e && e.hp <= 0) {
                        this.killEnemy(e, player);
                    }
                }
            }
        }

        // ---- Wave state machine ----
        this.updateWaves(dt);

        // ---- Enemies (shared AI rules) ----
        for (const enemy of this.enemies.values()) {
            if (enemy.hp <= 0) {
                continue;
            }

            const events = updateNetEnemy(enemy, {
                canMove: this.canMove.bind(this),
                targets: living,
                rng: Math.random
            }, dt);

            for (const event of events) {
                if (event.kind === "projectile") {
                    const source = this.enemies.get(event.enemyId);
                    const target = this.players.get(event.targetId);
                    if (source && target && target.alive) {
                        this.projectiles.push(netProjectileFrom(source, target.x + PLAYER_WIDTH / 2, target.y + PLAYER_HEIGHT / 2));
                    }
                } else if (event.kind === "explode") {
                    const source = this.enemies.get(event.enemyId);
                    const target = this.players.get(event.targetId);
                    if (source) {
                        const blast = source.blastRadius + 20;
                        const dist = Math.hypot(
                            (target ? target.x + PLAYER_WIDTH / 2 : source.x) - (source.x + source.width / 2),
                            (target ? target.y + PLAYER_HEIGHT / 2 : source.y) - (source.y + source.height / 2)
                        );
                        if (target && dist < blast) {
                            this.hurtPlayer(target, source.damage);
                        }
                        source.hp = 0;
                        if (target) {
                            this.killEnemy(source, target);
                        } else {
                            this.enemies.delete(source.id);
                        }
                    }
                } else {
                    const target = this.players.get(event.targetId);
                    if (target && target.alive) {
                        this.hurtPlayer(target, event.damage);
                    }
                }
            }
        }

        // ---- Projectiles ----
        const hits = updateNetProjectiles(this.projectiles, Array.from(this.players.values()), dt, this.canMove.bind(this));
        for (const hit of hits) {
            const target = this.players.get(hit.targetId);
            if (target && target.alive) {
                this.hurtPlayer(target, hit.damage);
            }
        }

        // ---- End conditions ----
        if (this.players.size > 0 && !Array.from(this.players.values()).some(p => p.alive)) {
            this.endMatch("gameover");
        }

        // ---- Mirror authoritative state to the schema ----
        this.syncAll();
    }

    private updateWaves(dt: number) {
        this.state.wave = this.wave;
        this.state.waveState = this.waveState;
        this.state.waveTimer = this.waveTimer;

        if (this.waveState === "break") {
            this.waveTimer -= dt;
            if (this.waveTimer <= 0) {
                this.spawnWave();
            }
        } else if (this.waveState === "active") {
const living = Array.from(this.players.values()).filter(p => p.alive);

        // ---- Co-op regen window ----
        for (const player of this.players.values()) {
            const sinceHurt = this.simTime - (this.lastHurt.get(player.id) || 0);
            if (player.alive && player.hp > 0 && player.hp < player.maxHp && sinceHurt >= GameRoom.REGEN_DELAY) {
                player.hp = Math.min(player.maxHp, player.hp + GameRoom.REGEN_RATE * dt);
            }
        }
            const anyAlive = Array.from(this.enemies.values()).some(e => e.hp > 0);
            if (living.length > 0 && !anyAlive) {
                for (const p of living) {
                    p.score += 150 * this.wave;
                }
                this.waveState = "clear";
                this.waveTimer = WAVE_CLEAR_TIME;
            }
        } else if (this.waveState === "clear") {
            this.waveTimer -= dt;
            if (this.waveTimer <= 0) {
                if (this.wave >= WAVE_VICTORY) {
                    this.endMatch("victory");
                    return;
                }
                this.wave++;
                this.waveState = "break";
                this.waveTimer = WAVE_BREAK_TIME;
            }
        }
    }

    private spawnWave() {
        const playerCount = Math.max(1, Array.from(this.players.values()).filter(p => p.alive).length);
        const list = netWaveList(this.wave, playerCount);
        const hpScale = netHpScale(this.wave, playerCount);

        for (const type of list) {
            const enemy = spawnNetEnemy(type, 0, 0, hpScale);
            const spawn = this.pickSpawn();
            enemy.x = spawn.x;
            enemy.y = spawn.y;
            enemy.id = `e_${this.simTime.toFixed(3)}_${Math.floor(Math.random() * 1e6)}`;
            this.enemies.set(enemy.id, enemy);
        }

        this.waveState = "active";
        this.waveTimer = 0;
    }

    private pickSpawn(): { x: number; y: number } {
        for (let attempt = 0; attempt < 40; attempt++) {
            const x = SPAWN_INSET + Math.random() * (WORLD_W - SPAWN_INSET * 2);
            const y = SPAWN_INSET + Math.random() * (WORLD_H - SPAWN_INSET * 2);
            const nearPlayer = Array.from(this.players.values()).some(p =>
                p.alive && Math.hypot(p.x - x, p.y - y) < 260
            );
            if (!nearPlayer) {
                return { x, y };
            }
        }
        return { x: SPAWN_INSET + Math.random() * (WORLD_W - SPAWN_INSET * 2), y: SPAWN_INSET + Math.random() * (WORLD_H - SPAWN_INSET * 2) };
    }

    private hurtPlayer(p: NetPlayer, amount: number) {
        if (!p.alive || p.invuln > 0) {
            return;
        }
        p.hp -= amount;
        p.invuln = PLAYER_IFRAMES;
        this.lastHurt.set(p.id, this.simTime);
        if (p.hp <= 0) {
            p.hp = 0;
            p.alive = false;
        }
    }

    private killEnemy(e: NetEnemy, killer: NetPlayer) {
        killer.score += this.enemyScore(e.type);
        killer.kills++;
        this.gainXP(killer, this.enemyXp(e.type));
        this.enemies.delete(e.id);
    }

    private enemyScore(type: string): number {
        const scores: Record<string, number> = { grunt: 100, fast: 150, tank: 300, swarm: 60, caster: 200, exploder: 150, warden: 250, boss: 1000 };
        return scores[type] || 100;
    }

    private enemyXp(type: string): number {
        const xp: Record<string, number> = { grunt: 20, fast: 25, tank: 60, swarm: 10, caster: 35, exploder: 30, warden: 50, boss: 150 };
        return xp[type] || 20;
    }

    private gainXP(p: NetPlayer, amount: number) {
        gainPlayerXp(p, amount);
    }

    private endMatch(status: "victory" | "gameover") {
        if (this.ended) {
            return;
        }
        this.ended = true;
        this.state.status = status;

        const results: PlayerStats[] = Array.from(this.players.values()).map(p => ({
            sessionId: p.id,
            username: p.name,
            score: p.score,
            kills: p.kills,
            survived: Math.round(this.simTime),
            damageDealt: Math.round(this.damageDealt.get(p.id) || 0),
            wave: this.wave,
            level: p.level
        }));

        this.broadcast("matchEnd", { status, wave: this.wave, results });
    }

    // ---- Schema mirror ----
    private syncAll() {
        for (const player of this.players.values()) {
            this.syncPlayer(player.id);
        }
        for (const [id, enemy] of this.enemies) {
            this.syncEnemy(id, enemy);
        }
        this.syncProjectiles();
    }

    private syncPlayer(sessionId: string) {
        const p = this.players.get(sessionId);
        if (!p) {
            this.state.players.delete(sessionId);
            return;
        }

        let state = this.state.players.get(sessionId);
        if (!state) {
            state = new PlayerState();
            state.sessionId = sessionId;
            this.state.players.set(sessionId, state);
        }

        state.username = p.name;
        state.x = p.x;
        state.y = p.y;
        state.hp = p.hp;
        state.maxHp = p.maxHp;
        state.direction = p.direction;
        state.level = p.level;
        state.xp = p.xp;
        state.xpNext = p.xpNext;
        state.invuln = p.invuln;
        state.dashTimer = p.dashTimer;
        state.dashCooldown = p.dashCooldown;
        state.dashDX = p.dashDX;
        state.dashDY = p.dashDY;
        state.attackTimer = p.attackTimer;
        state.attackCooldown = p.attackCooldown;
        state.damage = p.damage;
        state.range = p.range;
        state.alive = p.alive;
        state.score = p.score;
        state.kills = p.kills;
    }

    private syncEnemy(id: string, e: NetEnemy) {
        if (e.hp <= 0) {
            this.state.enemies.delete(id);
            return;
        }

        let state = this.state.enemies.get(id);
        if (!state) {
            state = new EnemyState();
            state.id = id;
            this.state.enemies.set(id, state);
        }

        state.type = e.type;
        state.x = e.x;
        state.y = e.y;
        state.hp = e.hp;
        state.maxHp = e.maxHp;
        state.width = e.width;
        state.height = e.height;
        state.state = e.state;
        state.facing = e.facing;
        state.stateTimer = e.stateTimer;
        state.cooldown = e.cooldown;
        state.flash = e.flash;
        state.kx = e.kx;
        state.ky = e.ky;
    }

    private syncProjectiles() {
        const seen = new Set<string>();
        let index = 0;

        for (const p of this.projectiles) {
            const id = `p_${index++}`;
            seen.add(id);
            let state = this.state.projectiles.get(id);
            if (!state) {
                state = new ProjectileState();
                state.id = id;
                this.state.projectiles.set(id, state);
            }
            state.x = p.x;
            state.y = p.y;
            state.vx = p.vx;
            state.vy = p.vy;
            state.size = p.size;
            state.damage = p.damage;
            state.life = p.life;
            state.color = p.color;
        }

        for (const id of Array.from(this.state.projectiles.keys())) {
            if (!seen.has(id)) {
                this.state.projectiles.delete(id);
            }
        }
    }
}