// ======================
// AUDIO (wav samples + WebAudio synth fallback)
// ======================

// Sample pools are loaded from public/<Folder>/1.wav..N.wav at boot:
//   Hit/     -> played when the player's attack connects
//   Dash/    -> played on dash
//   Dammage/ -> played when the player takes damage (also accepts "Damage")
// If a folder is missing or empty, that action falls back to the
// synthesized sound. Sample order is a shuffle bag: a random file plays
// each time, never repeating until every file in the folder has played.

const SAMPLE_DIRS = {
    hit: ["Hit"],
    dash: ["Dash"],
    damage: ["Dammage", "Damage"]
};

const MAX_SAMPLES_PER_FOLDER = 32;

const pools: Record<string, AudioBuffer[]> = {};
const bags: Record<string, number[]> = {};
const lastIndexes: Record<string, number> = {};

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let volume = 0.5;

function createContext() {
    if (ctx) {
        return;
    }
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) {
        return;
    }
    ctx = new AudioContextClass();
    master = ctx.createGain();
    master.gain.value = volume;
    master.connect(ctx.destination);
}

// Called from settings; safe before the AudioContext exists.
export function setVolume(value: number) {
    volume = Math.max(0, Math.min(1, value));
    if (master) {
        master.gain.value = volume;
    }
}

// Creates the context lazily on the first user gesture (autoplay rules).
function ensure() {
    createContext();
    if (ctx && ctx.state === "suspended") {
        ctx.resume();
    }
}

// ------------------------------------------------------------------
// Sample loading: sequential discovery (1.wav, 2.wav, ... until 404)
// ------------------------------------------------------------------

export async function loadSfx() {
    createContext();
    if (!ctx) {
        return;
    }

    for (const kind of Object.keys(SAMPLE_DIRS)) {
        const pool = [];
        let loadedFrom = "";

        for (const dir of SAMPLE_DIRS[kind]) {
            for (let i = 1; i <= MAX_SAMPLES_PER_FOLDER; i++) {
                const url = "/" + dir + "/" + i + ".wav";

                try {
                    const res = await fetch(url);
                    if (!res.ok || res.status === 404) {
                        break;
                    }

                    const buffer = await res.arrayBuffer();
                    const audio = await ctx.decodeAudioData(buffer);
                    pool.push(audio);
                } catch {
                    // malformed file or decode error — try the next one
                }
            }

            if (pool.length > 0) {
                loadedFrom = dir;
                break;
            }
        }

        pools[kind] = pool;

        if (pool.length === 0) {
            console.warn("Audio: no samples found in " + SAMPLE_DIRS[kind].join(" or ") + " — using synth fallback");
        } else {
            console.log("Audio: loaded " + pool.length + " samples from " + loadedFrom);
            bags[kind] = shuffleBag(pool.length);
        }
    }
}

// Returns an array of indices [0..count) in shuffled order, so a full
// pass plays every sample exactly once in random order.
function shuffleBag(count: number): number[] {
    const bag = [];
    for (let i = 0; i < count; i++) {
        bag.push(i);
    }
    for (let i = bag.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [bag[i], bag[j]] = [bag[j], bag[i]];
    }
    return bag;
}

// Refills lazily when the bag runs out; a fresh shuffle is used so the
// same sample can never play twice in a row across the wrap.
function pickSampleIndex(kind: string): number {
    const pool = pools[kind];
    if (!pool || pool.length === 0) {
        return -1;
    }

    let bag = bags[kind];
    if (!bag || bag.length === 0) {
        bag = shuffleBag(pool.length);
        bags[kind] = bag;

        // Ensure immediate repeat never happens across a shuffle boundary.
        const lastIndex = lastIndexes[kind];
        if (bag.length > 1 && bag[bag.length - 1] === lastIndex) {
            [bag[0], bag[bag.length - 1]] = [bag[bag.length - 1], bag[0]];
        }
    }

    const index = bag.pop() as number;
    lastIndexes[kind] = index;
    return index;
}

// Plays a random sample from the pool. Returns true if a sample played.
function playSample(kind: string): boolean {
    if (!ctx || !master) {
        return false;
    }

    const index = pickSampleIndex(kind);
    const pool = pools[kind];

    if (index < 0 || !pool || !pool[index]) {
        return false;
    }

    const source = ctx.createBufferSource();
    source.buffer = pool[index];

    const gain = ctx.createGain();
    gain.gain.value = volume;
    source.connect(gain);
    gain.connect(master);
    source.start();

    return true;
}

// ------------------------------------------------------------------
// One-off synthesized sounds (fallbacks + non-sample effects)
// ------------------------------------------------------------------

export const AudioFX = {
    setVolume: setVolume,

    ensure: ensure,

    tone: function (freq: number, duration: number, type: OscillatorType, vol: number, slideTo?: number, delay?: number) {
        createContext();
        if (!ctx || !master) {
            return;
        }
        const start = ctx.currentTime + (delay || 0);
        const oscillator = ctx.createOscillator();
        const gain = ctx.createGain();

        oscillator.type = type;
        oscillator.frequency.setValueAtTime(freq, start);
        if (slideTo) {
            oscillator.frequency.exponentialRampToValueAtTime(slideTo, start + duration);
        }

        gain.gain.setValueAtTime(vol, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + duration);

        oscillator.connect(gain);
        gain.connect(master);
        oscillator.start(start);
        oscillator.stop(start + duration + 0.02);
    },

    noise: function (duration: number, vol: number, frequency: number) {
        createContext();
        if (!ctx || !master) {
            return;
        }
        const start = ctx.currentTime;
        const length = Math.max(1, Math.floor(ctx.sampleRate * duration));
        const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
        const data = buffer.getChannelData(0);

        for (let i = 0; i < length; i++) {
            data[i] = (Math.random() * 2 - 1) * (1 - i / length);
        }

        const source = ctx.createBufferSource();
        source.buffer = buffer;

        const filter = ctx.createBiquadFilter();
        filter.type = "bandpass";
        filter.frequency.value = frequency;
        filter.Q.value = 1.2;

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(vol, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + duration);

        source.connect(filter);
        filter.connect(gain);
        gain.connect(master);
        source.start(start);
    },

    // ---- Actions wired to the sample folders ----

    hit: function () {
        ensure();
        if (playSample("hit")) {
            return;
        }
        this.tone(200, 0.1, "square", 0.25, 80);
        this.noise(0.08, 0.25, 900);
    },

    swing: function () {
        ensure();
        this.noise(0.12, 0.3, 1600);
    },

    dash: function () {
        ensure();
        if (playSample("dash")) {
            return;
        }
        this.noise(0.18, 0.3, 2200);
        this.tone(420, 0.16, "sine", 0.18, 950);
    },

    hurt: function () {
        ensure();
        if (playSample("damage")) {
            return;
        }
        this.tone(150, 0.22, "sawtooth", 0.3, 55);
    },

    kill: function () {
        ensure();
        this.tone(320, 0.6, "sawtooth", 0.3, 35);
        this.noise(0.4, 0.3, 500);
    },

    cast: function () {
        ensure();
        this.tone(300, 0.25, "sawtooth", 0.2, 700);
    },

    explode: function () {
        ensure();
        this.noise(0.5, 0.5, 300);
        this.tone(90, 0.4, "square", 0.3, 40);
    },

    block: function () {
        ensure();
        this.tone(700, 0.08, "square", 0.22, 500);
        this.noise(0.05, 0.2, 2000);
    },

    pickup: function () {
        ensure();
        this.tone(660, 0.12, "square", 0.2, 990);
    },

    levelUp: function () {
        ensure();
        const notes = [392, 523, 659, 784];
        for (let i = 0; i < notes.length; i++) {
            this.tone(notes[i], 0.22, "square", 0.18, null, i * 0.09);
        }
    },

    wave: function () {
        ensure();
        this.tone(110, 0.5, "sawtooth", 0.25, 165);
    },

    clear: function () {
        ensure();
        this.tone(523, 0.15, "triangle", 0.25, 659);
        this.tone(659, 0.25, "triangle", 0.25, null, 0.12);
    },

    boss: function () {
        ensure();
        this.tone(70, 1.1, "sawtooth", 0.35, 45);
        this.noise(0.8, 0.2, 250);
    },

    portal: function () {
        ensure();
        this.tone(880, 0.5, "sine", 0.25, 1320);
        this.tone(1100, 0.6, "sine", 0.15, null, 0.15);
    },

    fanfare: function () {
        ensure();
        const notes = [523, 659, 784, 1047, 784, 1047, 1319];
        for (let i = 0; i < notes.length; i++) {
            this.tone(notes[i], 0.4, "square", 0.16, null, i * 0.16);
        }
    }
};

window.addEventListener("keydown", function () {
    AudioFX.ensure();
}, { once: true });

window.addEventListener("pointerdown", function () {
    AudioFX.ensure();
}, { once: true });