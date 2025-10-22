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
        
        // Chance to condense back to water
        if (Math.random() < 0.001) {
            this.world.setParticle(x, y, PARTICLE_TYPES.WATER);
        }
    }
}

