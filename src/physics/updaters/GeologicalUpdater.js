import { PARTICLE_TYPES } from '../../utils/Constants.js';

export class GeologicalUpdater {
    constructor(world) {
        this.world = world;
        this.tectonicForceAccumulator = 0;
    }

    update(deltaTime, fidelity) {
        this.tectonicForceAccumulator += deltaTime;
        
        // Tectonic movement happens at geological timescales
        if (this.tectonicForceAccumulator > 1000) {
            this.applyTectonicForces(fidelity);
            this.formVolcanoes(fidelity);
            this.tectonicForceAccumulator = 0;
        }
    }

    applyTectonicForces(fidelity) {
        // Simulate tectonic plate movement by applying pressure to deep stone
        const forceCount = Math.ceil(5 * fidelity);
        
        for (let i = 0; i < forceCount; i++) {
            const x = Math.floor(Math.random() * this.world.width);
            const y = Math.floor(this.world.height * 0.7 + Math.random() * this.world.height * 0.2);
            
            const particle = this.world.getParticle(x, y);
            const pressure = this.world.getPressure(x, y);
            const temp = this.world.getTemperature(x, y);
            
            // High pressure + high temp in deep stone can cause uplift
            if (particle === PARTICLE_TYPES.STONE && pressure > 2.0 && temp > 800) {
                // Try to move upward
                if (this.world.getParticle(x, y - 1) !== PARTICLE_TYPES.STONE) {
                    this.world.swapParticles(x, y, x, y - 1);
                }
                
                // Add more heat - tectonic friction
                this.world.setTemperature(x, y, temp + 10);
            }
        }
    }

    formVolcanoes(fidelity) {
        // Look for hot spots deep underground and create magma chambers
        for (let i = 0; i < Math.ceil(3 * fidelity); i++) {
            const x = Math.floor(Math.random() * this.world.width);
            const y = Math.floor(this.world.height * 0.8);
            
            const temp = this.world.getTemperature(x, y);
            
            // If hot enough, melt stone to create lava
            if (temp > 1200) {
                for (let dy = 0; dy < 10; dy++) {
                    for (let dx = -2; dx <= 2; dx++) {
                        const nx = x + dx;
                        const ny = y - dy;
                        
                        if (this.world.getParticle(nx, ny) === PARTICLE_TYPES.STONE) {
                            if (Math.random() < 0.3) {
                                this.world.setParticle(nx, ny, PARTICLE_TYPES.LAVA);
                                this.world.setTemperature(nx, ny, 1300);
                            }
                        }
                    }
                }
            }
        }
    }
}