import { PARTICLE_TYPES } from '../../utils/Constants.js';

export class SlowProcessesUpdater {
    constructor(world) {
        this.world = world;
    }

    runOnce(deltaTime, fidelity) {
        const x = Math.floor(Math.random() * this.world.width);
        const y = Math.floor(Math.random() * this.world.height);

        const particleType = this.world.getParticle(x, y);
        const pressure = this.world.getPressure(x, y);
        const temp = this.world.getTemperature(x, y);
        
        if (particleType === PARTICLE_TYPES.PLANT) {
            // plants handled elsewhere often, but keep a slow tick here
            // delegate to plant updater if available on world/updater side
            // noop: PlantUpdater already called in regular updates
        } else if (particleType === PARTICLE_TYPES.GRANITE || particleType === PARTICLE_TYPES.BASALT) {
            // Stone weathering into soil (rare)
            const above = this.world.getParticle(x, y - 1);
            if ((above === PARTICLE_TYPES.EMPTY || above === PARTICLE_TYPES.WATER) && Math.random() < 0.0001 * fidelity) {
                this.world.setParticle(x, y, PARTICLE_TYPES.SOIL);
            }
            
            // Chemical weathering in water creates sand
            let waterNeighbors = 0;
            for (let dx = -1; dx <= 1; dx++) {
                for (let dy = -1; dy <= 1; dy++) {
                    if (this.world.getParticle(x + dx, y + dy) === PARTICLE_TYPES.WATER) waterNeighbors++;
                }
            }
            if (waterNeighbors >= 3 && Math.random() < 0.00005 * fidelity) {
                this.world.setParticle(x, y, PARTICLE_TYPES.SAND);
            }
        } else if (particleType === PARTICLE_TYPES.SOIL) {
            // Soil can compact into sand under moderate pressure
            if (pressure > 1.8 && Math.random() < 0.0001 * fidelity) {
                this.world.setParticle(x, y, PARTICLE_TYPES.SAND);
            }
        } else if (particleType === PARTICLE_TYPES.SAND) {
            // Sand exposed to organic matter can become soil
            let plantNeighbors = 0;
            for (let dx = -1; dx <= 1; dx++) {
                for (let dy = -1; dy <= 1; dy++) {
                    if (this.world.getParticle(x + dx, y + dy) === PARTICLE_TYPES.PLANT) plantNeighbors++;
                }
            }
            if (plantNeighbors >= 2 && Math.random() < 0.0002 * fidelity) {
                this.world.setParticle(x, y, PARTICLE_TYPES.SOIL);
            }
        } else if (particleType === PARTICLE_TYPES.MANTLE) {
            // Mantle can cool into basalt near the surface
            if (temp < 900 && y < this.world.height * 0.6 && Math.random() < 0.00001 * fidelity) {
                this.world.setParticle(x, y, PARTICLE_TYPES.BASALT);
                this.world.setTemperature(x, y, temp - 100);
            }
        }
    }
}