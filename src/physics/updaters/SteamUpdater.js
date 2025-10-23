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
            this.world.swapParticles(x, y, x + dir, y);
            this.world.setUpdated(x + dir, y);
            return;
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
        const crowded = steamNeighbors >= 8;
        if ((coolEnough && crowded) || (coolEnough && Math.random() < 0.002)) {
            // Condense into cloud with small initial mass stored in data[0]
            this.world.setParticle(x, y, PARTICLE_TYPES.CLOUD, [1, 0, 0, 0]);
            return;
        }
        // Rare direct condensation to water (weak baseline)
        if (temp < 25 && Math.random() < 0.0005) {
            this.world.setParticle(x, y, PARTICLE_TYPES.WATER);
        }
    }
}