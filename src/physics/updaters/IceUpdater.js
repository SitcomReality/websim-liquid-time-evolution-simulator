import { PARTICLE_TYPES } from '../../utils/Constants.js';

export class IceUpdater {
    constructor(world) {
        this.world = world;
    }

    update(x, y) {
        // Ice is a solid, but less dense than water. It should float.
        const below = this.world.getParticle(x, y + 1);
        if (below === PARTICLE_TYPES.WATER) {
            // Try to float up if there's water or empty space above
            const above = this.world.getParticle(x, y - 1);
            if (above === PARTICLE_TYPES.EMPTY || above === PARTICLE_TYPES.WATER) {
                this.world.swapParticles(x, y, x, y - 1);
                this.world.setUpdated(x, y - 1);
                return;
            }
        }

        // Ice should not fall through air. It maintains its structure.
        // Melting is handled by the ThermalUpdater.
    }
}