import { PARTICLE_TYPES } from '../../utils/Constants.js';

export class LavaUpdater {
    constructor(world, liquidUpdater) {
        this.world = world;
        this.liquidUpdater = liquidUpdater;
    }

    update(x, y) {
        // behave like liquid
        this.liquidUpdater.update(x, y);
        
        // Convert adjacent ice to water
        for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
                if (dx === 0 && dy === 0) continue;
                const nx = x + dx;
                const ny = y + dy;
                if (this.world.getParticle(nx, ny) === PARTICLE_TYPES.ICE) {
                    this.world.setParticle(nx, ny, PARTICLE_TYPES.WATER);
                }
            }
        }
    }
}

