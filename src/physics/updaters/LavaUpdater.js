import { PARTICLE_TYPES } from '../../utils/Constants.js';

export class LavaUpdater {
    constructor(world, liquidUpdater) {
        this.world = world;
        this.liquidUpdater = liquidUpdater;
    }

    update(x, y) {
        // behave like liquid
        this.liquidUpdater.update(x, y);
        
        // Heat surroundings
        const currentTemp = this.world.getTemperature(x, y);
        if (currentTemp < 1200) {
            this.world.setTemperature(x, y, currentTemp + 20);
        }
        
        // Convert adjacent ice to water and heat transfer
        for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
                if (dx === 0 && dy === 0) continue;
                const nx = x + dx;
                const ny = y + dy;
                const neighbor = this.world.getParticle(nx, ny);
                
                if (neighbor === PARTICLE_TYPES.ICE) {
                    this.world.setParticle(nx, ny, PARTICLE_TYPES.WATER);
                    this.world.setTemperature(nx, ny, 50);
                    // Cool the lava slightly
                    this.world.setTemperature(x, y, currentTemp - 10);
                } else if (neighbor === PARTICLE_TYPES.WATER) {
                    // Boil water
                    if (Math.random() < 0.1) {
                        this.world.setParticle(nx, ny, PARTICLE_TYPES.STEAM);
                    }
                    this.world.setTemperature(nx, ny, 120);
                }
            }
        }
    }
}