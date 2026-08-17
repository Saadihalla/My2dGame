// ======================
// LOOT ROLLS (pure)
// ======================

export type LootKind = "potion" | "upgrade";

export function rollLoot(type: string, roll: number): LootKind[] {
    if (type === "boss") {
        return ["potion", "upgrade"];
    }

    if (type === "tank" && roll < 0.18) {
        return ["upgrade"];
    }

    if (roll < 0.08) {
        return ["upgrade"];
    }

    if (roll < 0.28) {
        return ["potion"];
    }

    return [];
}