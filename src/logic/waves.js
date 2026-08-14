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

        const swarm = 1 + Math.floor((waveNumber - 1) * 1.1);
        for (let i = 0; i < swarm; i++) {
            list.push("swarm");
        }
    }

    if (waveNumber >= 3) {
        const casters = 1 + Math.floor((waveNumber - 2) / 2);
        for (let i = 0; i < casters; i++) {
            list.push("caster");
        }
    }

    if (waveNumber >= 4) {
        const exploders = 1 + Math.floor((waveNumber - 3) / 3);
        for (let i = 0; i < exploders; i++) {
            list.push("exploder");
        }

        const tanks = 1 + Math.floor((waveNumber - 3) / 3);
        for (let i = 0; i < tanks; i++) {
            list.push("tank");
        }
    }

    if (waveNumber >= 5) {
        const wardens = 1 + Math.floor((waveNumber - 4) / 3);
        for (let i = 0; i < wardens; i++) {
            list.push("warden");
        }
    }

    if (waveNumber % 5 === 0) {
        list.push("boss");
    }

    return list;
}