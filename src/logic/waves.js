// ======================
// WAVE COMPOSITION (pure)
// ======================

export function waveEnemyList(waveNumber) {
    const list = [];

    const grunts = 2 + Math.floor(waveNumber * 1.2);
    for (let i = 0; i < grunts; i++) {
        list.push("grunt");
    }

    if (waveNumber >= 2) {
        const fasts = 1 + Math.floor((waveNumber - 1) / 2);
        for (let i = 0; i < fasts; i++) {
            list.push("fast");
        }
    }

    if (waveNumber >= 4) {
        const tanks = 1 + Math.floor((waveNumber - 3) / 3);
        for (let i = 0; i < tanks; i++) {
            list.push("tank");
        }
    }

    if (waveNumber % 5 === 0) {
        list.push("boss");
    }

    return list;
}