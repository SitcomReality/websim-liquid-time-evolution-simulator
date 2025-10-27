import { PARTICLE_TYPES } from '../../utils/Constants.js';

export class CloudUpdater {
    constructor(world) {
        this.world = world;
    }

    update(x, y, deltaTime = 16) {
        const idx = this.world.getIndex(x, y) * 4;
        let mass = this.world.particleData[idx] || 1;
        const temp = this.world.getTemperature(x, y);

        // Drift with pressure winds
        const pl = this.world.getPressure(x - 1, y);
        const pr = this.world.getPressure(x + 1, y);
        const windDir = (pl > pr) ? 1 : (pl < pr) ? -1 : (Math.random() > 0.5 ? 1 : -1);
        
        if (this.world.getParticle(x + windDir, y) === PARTICLE_TYPES.EMPTY && Math.random() < 0.6) {
            this.world.swapParticles(x, y, x + windDir, y);
            this.world.setUpdated(x + windDir, y);
            return;
        }

        // Accrete nearby steam
        for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
                if (dx === 0 && dy === 0) continue;
                const nx = x + dx;
                const ny = y + dy;
                if (this.world.getParticle(nx, ny) === PARTICLE_TYPES.STEAM && Math.random() < 0.2) {
                    this.world.setParticle(nx, ny, PARTICLE_TYPES.CLOUD, [0.5, 0, 0, 0]);
                    mass += 0.5;
                }
            }
        }

        // Merge with neighboring clouds
        const mx = x + (Math.random() < 0.5 ? -1 : 1);
        if (this.world.getParticle(mx, y) === PARTICLE_TYPES.CLOUD && Math.random() < 0.3) {
            const mIdx = this.world.getIndex(mx, y) * 4;
            mass += (this.world.particleData[mIdx] || 1);
            this.world.setParticle(mx, y, PARTICLE_TYPES.EMPTY);
        }

        // Precipitation when massive and cool
        const precipThreshold = 5;
        // As clouds grow, they darken and become storm-prone; larger mass -> heavier precipitation
        if (mass >= precipThreshold) {
            const freezing = temp <= 0;
            // stormIntensity scales with mass: small showers -> heavy storms
            const stormIntensity = Math.min(1.0, (mass - precipThreshold) / (precipThreshold * 3) + 0.25);
            const drops = Math.ceil(2 + stormIntensity * 10);
            for (let d = 0; d < drops; d++) {
                const dx = (Math.random() < 0.6 ? windDir : (Math.random() < 0.5 ? -windDir : 0));
                const tx = x + (Math.random() * 3 - 1) | 0 + dx;
                const ty = y + 1 + (Math.random() * 2 | 0);
                if (!this.world.inBounds(tx, ty)) continue;
                if (this.world.getParticle(tx, ty) === PARTICLE_TYPES.EMPTY || Math.random() < 0.4) {
                    this.world.setParticle(tx, ty, freezing ? PARTICLE_TYPES.ICE : PARTICLE_TYPES.WATER);
                    const tBelow = this.world.getTemperature(tx, ty);
                    this.world.setTemperature(tx, ty, tBelow - (freezing ? 8 : 5));
                }
            }
            // Heavy storms dissipate large fraction of the cloud mass and can trigger neighboring cloud collapse
            const bleed = 1 + Math.floor(stormIntensity * 6);
            mass = Math.max(1, mass - bleed);
            if (stormIntensity > 0.8) {
                // Severe storm: collapse some neighboring cloud cells into precipitation immediately
                for (let ry = -2; ry <= 2; ry++) for (let rx = -3; rx <= 3; rx++) {
                    const nx = x + rx, ny = y + ry;
                    if (!this.world.inBounds(nx, ny)) continue;
                    if (this.world.getParticle(nx, ny) === PARTICLE_TYPES.CLOUD && Math.random() < 0.45) {
                        this.world.setParticle(nx, ny, (this.world.getTemperature(nx, ny) <= 0) ? PARTICLE_TYPES.ICE : PARTICLE_TYPES.WATER);
                        this.world.setTemperature(nx, ny, this.world.getTemperature(nx, ny) - 6);
                    }
                }
            }
        }

        // Evaporate in warm air
        if (temp > 40 && Math.random() < 0.02) {
            this.world.setParticle(x, y, PARTICLE_TYPES.STEAM);
            return;
        }

        this.world.particleData[idx] = mass;
    }
}