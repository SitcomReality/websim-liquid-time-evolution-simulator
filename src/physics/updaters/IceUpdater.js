import { PARTICLE_TYPES } from '../../utils/Constants.js';

export class IceUpdater {
    constructor(world) {
        this.world = world;
    }

    update(x, y) {
        // Fall through air
        const below = this.world.getParticle(x, y + 1);
        if (below === PARTICLE_TYPES.EMPTY) {
            this.world.swapParticles(x, y, x, y + 1);
            this.world.setUpdated(x, y + 1);
            return;
        }
        // Float in water
        if (below === PARTICLE_TYPES.WATER) {
            const above = this.world.getParticle(x, y - 1);
            if (above === PARTICLE_TYPES.EMPTY || above === PARTICLE_TYPES.WATER) {
                this.world.swapParticles(x, y, x, y - 1);
                this.world.setUpdated(x, y - 1);
            }
        }
        // Melting handled by ThermalUpdater.
    }
}