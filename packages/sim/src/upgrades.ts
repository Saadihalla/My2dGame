// ======================
// LEVEL-UP UPGRADES (pure)
// ======================

import type { Upgrade } from "./types.js";

export const UPGRADE_POOL: Upgrade[] = [
    { id: "damage", name: "Brawler", desc: "+6 damage" },
    { id: "range", name: "Long Reach", desc: "+10 attack range" },
    { id: "speed", name: "Swift Blade", desc: "12% faster attacks" },
    { id: "vitality", name: "Vitality", desc: "+20 max HP, heal 20" },
    { id: "boots", name: "Striders", desc: "+10% move speed" },
    { id: "reflex", name: "Quick Reflexes", desc: "15% faster dash recharge" },
    { id: "crit", name: "Keen Edge", desc: "+10% critical chance (2x damage)" },
    { id: "lifesteal", name: "Bloodthirst", desc: "Heal 5% of damage dealt" },
    { id: "cleave", name: "Cleave", desc: "Attacks sweep 50% wider" }
];

// Returns `count` distinct upgrade options from the pool (or as many
// as the pool has). `rng` is injected so tests stay deterministic.

export function rollUpgradeOptions(count: number, rng: () => number): Upgrade[] {
    const pool = UPGRADE_POOL.slice();
    const options: Upgrade[] = [];

    while (options.length < count && pool.length > 0) {
        const index = Math.floor(rng() * pool.length);
        options.push(pool.splice(index, 1)[0]);
    }

    return options;
}