import { PARTICLE_TYPES } from '../../utils/Constants.js';

export class SteamUpdater {
    constructor(world) {
        this.world = world;
    }

    update(x, y) {
        // Rise up
        const above = this.world.getParticle(x, y - 1);
        if (above === PARTICLE_TYPES.EMPTY) {
            this.world.swapParticles(x, y, x, y - 1);
            this.world.setUpdated(x, y - 1);
            return;
        }
        
        // Spread horizontally - check both sides
        const dir = Math.random() > 0.5 ? 1 : -1;
        let side = this.world.getParticle(x + dir, y);
        if (side === PARTICLE_TYPES.EMPTY) {
            // Pressure-driven drift (wind from high -> low)
            const pl = this.world.getPressure(x - 1, y), pr = this.world.getPressure(x + 1, y);
            const windDir = (pl > pr) ? 1 : (pl < pr) ? -1 : dir;
            if (this.world.getParticle(x + windDir, y) === PARTICLE_TYPES.EMPTY && Math.random() < 0.6) {
                this.world.swapParticles(x, y, x + windDir, y);
                this.world.setUpdated(x + windDir, y);
                return;
            }
        }
        side = this.world.getParticle(x - dir, y);
        if (side === PARTICLE_TYPES.EMPTY) {
            this.world.swapParticles(x, y, x - dir, y);
            this.world.setUpdated(x - dir, y);
        }
        
        // Humidity-driven cloud formation (cool + crowded -> cloud)
        const temp = this.world.getTemperature(x, y);
        let steamNeighbors = 0;
        for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
            if (dx*dx + dy*dy > 8) continue;
            if (this.world.getParticle(x + dx, y + dy) === PARTICLE_TYPES.STEAM) steamNeighbors++;
        }
        const altitude = y / this.world.height;
        const coolEnough = temp < 35 || altitude < 0.25;
        const crowded = steamNeighbors >= 10;
        if ((coolEnough && crowded) && Math.random() < 0.05) {
            this.world.setParticle(x, y, PARTICLE_TYPES.CLOUD, [1, 0, 0, 0]);
            return;
        }
        // Rare direct condensation to water (weak baseline)
        if (temp < 25 && Math.random() < 0.0005) {
            this.world.setParticle(x, y, PARTICLE_TYPES.WATER);
        }
    }
}