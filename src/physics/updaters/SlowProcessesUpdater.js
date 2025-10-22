import { PARTICLE_TYPES } from '../../utils/Constants.js';

export class SlowProcessesUpdater {
    constructor(world) {
        this.world = world;
    }

    runOnce(deltaTime, fidelity) {
        const x = Math.floor(Math.random() * this.world.width);
        const y = Math.floor(Math.random() * this.world.height);

        const particleType = this.world.getParticle(x, y);
        
        if (particleType === PARTICLE_TYPES.PLANT) {
            // plants handled elsewhere often, but keep a slow tick here
            // delegate to plant updater if available on world/updater side
            // noop: PlantUpdater already called in regular updates
        } else if (particleType === PARTICLE_TYPES.STONE) {
            // Stone weathering into soil (rare)
            const above = this.world.getParticle(x, y - 1);
            if ((above === PARTICLE_TYPES.EMPTY || above === PARTICLE_TYPES.WATER) && Math.random() < 0.0001 * fidelity) {
                this.world.setParticle(x, y, PARTICLE_TYPES.SOIL);
            }
        }
    }
}