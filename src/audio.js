// ======================
// AUDIO (WebAudio synth)
// ======================

export const AudioFX = {
    ctx: null,
    master: null,

    ensure: function () {
        if (!this.ctx) {
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            if (!AudioContextClass) {
                return;
            }
            this.ctx = new AudioContextClass();
            this.master = this.ctx.createGain();
            this.master.gain.value = 0.5;
            this.master.connect(this.ctx.destination);
        }
        if (this.ctx.state === "suspended") {
            this.ctx.resume();
        }
    },

    tone: function (freq, duration, type, volume, slideTo, delay) {
        if (!this.ctx) {
            return;
        }
        const start = this.ctx.currentTime + (delay || 0);
        const oscillator = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        oscillator.type = type;
        oscillator.frequency.setValueAtTime(freq, start);
        if (slideTo) {
            oscillator.frequency.exponentialRampToValueAtTime(slideTo, start + duration);
        }

        gain.gain.setValueAtTime(volume, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + duration);

        oscillator.connect(gain);
        gain.connect(this.master);
        oscillator.start(start);
        oscillator.stop(start + duration + 0.02);
    },

    noise: function (duration, volume, frequency) {
        if (!this.ctx) {
            return;
        }
        const start = this.ctx.currentTime;
        const length = Math.max(1, Math.floor(this.ctx.sampleRate * duration));
        const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);

        for (let i = 0; i < length; i++) {
            data[i] = (Math.random() * 2 - 1) * (1 - i / length);
        }

        const source = this.ctx.createBufferSource();
        source.buffer = buffer;

        const filter = this.ctx.createBiquadFilter();
        filter.type = "bandpass";
        filter.frequency.value = frequency;
        filter.Q.value = 1.2;

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(volume, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + duration);

        source.connect(filter);
        filter.connect(gain);
        gain.connect(this.master);
        source.start(start);
    },

    swing: function () {
        this.ensure();
        this.noise(0.12, 0.3, 1600);
    },

    dash: function () {
        this.ensure();
        this.noise(0.18, 0.3, 2200);
        this.tone(420, 0.16, "sine", 0.18, 950);
    },

    hit: function () {
        this.ensure();
        this.tone(200, 0.1, "square", 0.25, 80);
        this.noise(0.08, 0.25, 900);
    },

    hurt: function () {
        this.ensure();
        this.tone(150, 0.22, "sawtooth", 0.3, 55);
    },

    kill: function () {
        this.ensure();
        this.tone(320, 0.6, "sawtooth", 0.3, 35);
        this.noise(0.4, 0.3, 500);
    },

    pickup: function () {
        this.ensure();
        this.tone(660, 0.12, "square", 0.2, 990);
    },

    levelUp: function () {
        this.ensure();
        const notes = [392, 523, 659, 784];
        for (let i = 0; i < notes.length; i++) {
            this.tone(notes[i], 0.22, "square", 0.18, null, i * 0.09);
        }
    },

    wave: function () {
        this.ensure();
        this.tone(110, 0.5, "sawtooth", 0.25, 165);
    },

    clear: function () {
        this.ensure();
        this.tone(523, 0.15, "triangle", 0.25, 659);
        this.tone(659, 0.25, "triangle", 0.25, null, 0.12);
    },

    boss: function () {
        this.ensure();
        this.tone(70, 1.1, "sawtooth", 0.35, 45);
        this.noise(0.8, 0.2, 250);
    },

    portal: function () {
        this.ensure();
        this.tone(880, 0.5, "sine", 0.25, 1320);
        this.tone(1100, 0.6, "sine", 0.15, null, 0.15);
    },

    fanfare: function () {
        this.ensure();
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