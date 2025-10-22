import { PARTICLE_TYPES } from '../../utils/Constants.js';

export class SoilUpdater {
    constructor(world) {
        this.world = world;
    }

    update(x, y) {
        // Soil can slowly fall if unsupported
        const below = this.world.getParticle(x, y + 1);
        if (below === PARTICLE_TYPES.EMPTY || below === PARTICLE_TYPES.WATER) {
            if (Math.random() < 0.01) { // Reduced chance to give more structure
                this.world.swapParticles(x, y, x, y + 1);
                this.world.setUpdated(x, y + 1);
            }
        }
    }
}

