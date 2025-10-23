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
        if (mass >= precipThreshold) {
            const freezing = temp <= 0;
            for (let drops = 0; drops < 3; drops++) {
                const dx = windDir * (Math.random() < 0.6 ? 1 : 0);
                if (this.world.getParticle(x + dx, y + 1) === PARTICLE_TYPES.EMPTY) {
                    this.world.setParticle(x + dx, y + 1, freezing ? PARTICLE_TYPES.ICE : PARTICLE_TYPES.WATER);
                    const tBelow = this.world.getTemperature(x + dx, y + 1);
                    this.world.setTemperature(x + dx, y + 1, tBelow - (freezing ? 8 : 5));
                }
            }
            mass = Math.max(1, mass - 2.0);
        }

        // Evaporate in warm air
        if (temp > 40 && Math.random() < 0.02) {
            this.world.setParticle(x, y, PARTICLE_TYPES.STEAM);
            return;
        }

        this.world.particleData[idx] = mass;
    }
}