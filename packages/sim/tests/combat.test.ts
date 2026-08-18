import { describe, it, expect } from "vitest";
import {
    createNetPlayer,
    spawnNetEnemy,
    movePlayer,
    playerAttackBox,
    applyPlayerAttack,
    updateNetEnemy,
    gainPlayerXp,
    netWaveList,
    netHpScale,
    coopMaxHp,
    PLAYER_SPEED,
    DASH_SPEED,
    ATTACK_BASE_RANGE,
    ENEMY_DEFS
} from "../src/combat.js";

const OPEN = () => true;

describe("createNetPlayer", () => {
    it("spawns with the shared base stats", () => {
        const p = createNetPlayer("a", "Hero", 100, 200);
        expect(p.x).toBe(100);
        expect(p.y).toBe(200);
        expect(p.hp).toBe(100);
        expect(p.maxHp).toBe(100);
        expect(p.level).toBe(1);
        expect(p.alive).toBe(true);
        expect(p.damage).toBe(20);
    });
});

describe("movePlayer", () => {
    it("moves at PLAYER_SPEED along the input axis", () => {
        const p = createNetPlayer("a", "Hero", 0, 0);
        movePlayer(p, { vx: 1, vy: 0, dash: false, attack: false }, 1, { canMove: OPEN });
        expect(p.x).toBeCloseTo(PLAYER_SPEED);
        expect(p.direction).toBe("right");
    });

    it("normalizes diagonal movement", () => {
        const p = createNetPlayer("a", "Hero", 0, 0);
        movePlayer(p, { vx: 1, vy: 1, dash: false, attack: false }, 1, { canMove: OPEN });
        const expected = PLAYER_SPEED / Math.SQRT2;
        expect(p.x).toBeCloseTo(expected);
        expect(p.y).toBeCloseTo(expected);
    });

    it("respects the collision callback", () => {
        const p = createNetPlayer("a", "Hero", 0, 0);
        movePlayer(p, { vx: 1, vy: 0, dash: false, attack: false }, 1, {
            canMove: () => false
        });
        expect(p.x).toBe(0);
    });

    it("dashes at DASH_SPEED and applies iframes + cooldown", () => {
        const p = createNetPlayer("a", "Hero", 0, 0);
        movePlayer(p, { vx: 1, vy: 0, dash: true, attack: false }, 0.1, { canMove: OPEN });
        expect(p.x).toBeCloseTo(DASH_SPEED * 0.1);
        expect(p.invuln).toBeGreaterThan(0);
        expect(p.dashCooldown).toBeGreaterThan(0);
        expect(p.dashTimer).toBeGreaterThan(0);
    });
});

describe("playerAttackBox", () => {
    it("projects the arc in the facing direction", () => {
        const p = createNetPlayer("a", "Hero", 100, 100);
        p.direction = "right";
        const box = playerAttackBox(p);
        expect(box.x).toBe(140); // player.x + width
        expect(box.w).toBe(p.range);

        p.direction = "left";
        const lbox = playerAttackBox(p);
        expect(lbox.x + lbox.w).toBe(100);
    });
});

describe("applyPlayerAttack", () => {
    it("damages enemies inside the arc and knocks them back", () => {
        const p = createNetPlayer("a", "Hero", 0, 0);
        p.direction = "right";
        const e = spawnNetEnemy("grunt", 60, 0, 1);
        e.id = "e1";
        const { hits } = applyPlayerAttack(p, [e], () => 0.5);
        expect(hits).toEqual(["e1"]);
        expect(e.hp).toBeLessThan(e.maxHp);
        expect(e.kx).not.toBe(0);
    });

    it("spares wardens attacking from the shielded side", () => {
        const p = createNetPlayer("a", "Hero", 0, 0);
        p.direction = "right";
        const w = spawnNetEnemy("warden", 60, 0, 1);
        w.id = "e1";
        w.facing = "left"; // shield faces the player
        applyPlayerAttack(p, [w], () => 0.5);
        expect(w.hp).toBe(w.maxHp);
    });
});

describe("updateNetEnemy", () => {
    it("chases the nearest living player", () => {
        const p = createNetPlayer("a", "Hero", 200, 0);
        const e = spawnNetEnemy("grunt", 0, 0, 1);
        e.id = "e1";
        const before = e.x;
        const events = updateNetEnemy(e, { canMove: OPEN, targets: [p] }, 0.1);
        expect(e.x).toBeGreaterThan(before);
        expect(events).toEqual([]); // far away: just moving
    });

    it("strikes when in range with cooldown ready", () => {
        const p = createNetPlayer("a", "Hero", 60, 0);
        const e = spawnNetEnemy("grunt", 0, 0, 1);
        e.id = "e1";
        // nudge into strike range so the AI resolves to a strike fast
        const events: Array<ReturnType<typeof updateNetEnemy>[number]> = [];
        for (let i = 0; i < 60 && events.length === 0; i++) {
            const ev = updateNetEnemy(e, { canMove: OPEN, targets: [p], rng: () => 0.9 }, 0.1);
            events.push(...ev);
        }
        expect(events.some(ev => ev.kind === "strike")).toBe(true);
    });

    it("casters fire projectiles", () => {
        const p = createNetPlayer("a", "Hero", 200, 0);
        const e = spawnNetEnemy("caster", 0, 0, 1);
        e.id = "e1";
        let event: ReturnType<typeof updateNetEnemy>[number] | null = null;
        for (let i = 0; i < 80 && !event; i++) {
            const ev = updateNetEnemy(e, { canMove: OPEN, targets: [p], rng: () => 0.9 }, 0.1);
            event = ev.find(x => x.kind === "projectile") || null;
        }
        expect(event).not.toBeNull();
        expect(event!.kind).toBe("projectile");
    });
});

describe("gainPlayerXp", () => {
    it("levels up, heals, and scales damage/range", () => {
        const p = createNetPlayer("a", "Hero", 0, 0);
        p.hp = 50;
        const levels = gainPlayerXp(p, 100);
        expect(levels).toBe(1);
        expect(p.level).toBe(2);
        expect(p.damage).toBe(22);
        expect(p.range).toBe(ATTACK_BASE_RANGE + 3);
        expect(p.hp).toBe(75); // healed by LEVEL_HEAL
    });
});

describe("wave scaling", () => {
    it("single player uses the base composition", () => {
        expect(netWaveList(1, 1)).toEqual(expect.arrayContaining(["grunt"]));
        expect(netWaveList(1, 1).length).toBeLessThanOrEqual(netWaveList(1, 4).length);
    });

    it("extra players add a sub-linear share (0.4 per extra player)", () => {
        const base = netWaveList(2, 1).length;
        const two = netWaveList(2, 2).length;
        const expected = base + Math.round(base * 0.4);
        expect(two).toBe(expected);
    });

    it("co-op grants bonus max HP per extra player", () => {
        expect(coopMaxHp(1)).toBe(100);
        expect(coopMaxHp(2)).toBe(125);
        expect(coopMaxHp(4)).toBe(175);
    });

    it("boss waves keep exactly one boss regardless of player count", () => {
        for (const count of [1, 2, 3, 4]) {
            const list = netWaveList(5, count);
            expect(list.filter(t => t === "boss").length).toBe(1);
        }
    });

    it("hp scale grows with wave and player count", () => {
        expect(netHpScale(1, 1)).toBe(1);
        expect(netHpScale(5, 1)).toBeCloseTo(1.48);
        expect(netHpScale(5, 4)).toBeGreaterThan(netHpScale(5, 1));
    });

    it("enemy defs cover every wave-1..10 composition", () => {
        for (let wave = 1; wave <= 10; wave++) {
            for (const type of netWaveList(wave, 4)) {
                expect(ENEMY_DEFS[type]).toBeDefined();
            }
        }
    });
});