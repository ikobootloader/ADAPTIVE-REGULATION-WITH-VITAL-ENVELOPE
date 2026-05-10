/**
 * ARVE CLOCK MANAGER
 *
 * Horloge interne phi(t) et arousal alpha(t).
 */
class ARVEClockManager {
    constructor(config) {
        this.config = config;
        this.phase = 0;
    }

    tick() {
        const drift = Number.isFinite(this.config.clockDrift) ? this.config.clockDrift : 0.05;
        const noiseAmp = Number.isFinite(this.config.clockNoise) ? this.config.clockNoise : 0.005;
        const noise = (Math.random() * 2 - 1) * noiseAmp;
        const twoPi = Math.PI * 2;
        this.phase = (this.phase + drift + noise) % twoPi;
        if (this.phase < 0) {
            this.phase += twoPi;
        }
    }

    getArousal() {
        const base = (1 + Math.sin(this.phase)) / 2;
        const min = Number.isFinite(this.config.arousalMin) ? this.config.arousalMin : 0.2;
        const max = Number.isFinite(this.config.arousalMax) ? this.config.arousalMax : 0.9;
        return min + ((max - min) * base);
    }

    getPhase() {
        return this.phase;
    }
}

if (typeof window !== 'undefined') {
    window.ARVEClockManager = ARVEClockManager;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ARVEClockManager };
}
