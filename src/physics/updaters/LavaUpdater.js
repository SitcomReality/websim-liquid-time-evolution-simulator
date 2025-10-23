import { PARTICLE_TYPES } from '../../utils/Constants.js';

export class LavaUpdater {
    constructor(world, fluidUpdater) {
        this.world = world;
        this.fluidUpdater = fluidUpdater;
    }

    update(x, y) {
        // Use fluid physics for movement
        this.fluidUpdater.update(x, y, 1, 1);
        
        // Reduce self-heating to avoid runaway; slight stochastic heat retention
        const currentTemp = this.world.getTemperature(x, y);
        if (currentTemp < 1200) {
            if (Math.random() < 0.2) this.world.setTemperature(x, y, currentTemp + 5);
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
                    this.world.setTemperature(x, y, currentTemp - 10);
                } else if (neighbor === PARTICLE_TYPES.WATER) {
                    if (Math.random() < 0.1) {
                        this.world.setParticle(nx, ny, PARTICLE_TYPES.STEAM);
                    }
                    this.world.setTemperature(nx, ny, 120);
                }
            }
        }
        
        // Pressure-driven lateral flow to vent and spread (helps cooling/solidifying)
        const pl = this.world.getPressure(x - 1, y);
        const pr = this.world.getPressure(x + 1, y);
        const dir = pl > pr ? 1 : (pl < pr ? -1 : (Math.random() > 0.5 ? 1 : -1));
        const side = this.world.getParticle(x + dir, y);
        if ((side === PARTICLE_TYPES.EMPTY || side === PARTICLE_TYPES.WATER) && Math.random() < 0.6) {
            this.world.swapParticles(x, y, x + dir, y);
            this.world.setUpdated(x + dir, y);
            return;
        }
    }
}