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
            
            // High pressure + high temp in deep granite can cause uplift
            if (particle === PARTICLE_TYPES.GRANITE && pressure > 2.0 && temp > 800) {
                // Try to move upward
                if (this.world.getParticle(x, y - 1) !== PARTICLE_TYPES.GRANITE) {
                    this.world.swapParticles(x, y, x, y - 1);
                }
                
                // Add more heat - tectonic friction
                this.world.setTemperature(x, y, temp + 10);
            }
        }
    }

    formVolcanoes(fidelity) {
        // Look for hot spots in the mantle and create magma chambers/eruptions
        for (let i = 0; i < Math.ceil(3 * fidelity); i++) {
            const x = Math.floor(Math.random() * this.world.width);
            const y = Math.floor(this.world.height * 0.7 + Math.random() * this.world.height * 0.1);
            
            const temp = this.world.getTemperature(x, y);
            
            // If hot enough, melt mantle/granite to create a lava plume
            if (this.world.getParticle(x, y) === PARTICLE_TYPES.MANTLE && temp > 1400) {
                // Erupt upwards, melting through the crust
                for (let dy = 0; dy < this.world.height * 0.4; dy++) {
                    const ny = y - dy;
                    const nx = x + Math.floor((Math.random() - 0.5) * dy * 0.2); // Wobbly path

                    if (!this.world.inBounds(nx, ny)) break;
                    
                    const particleAbove = this.world.getParticle(nx, ny);
                    if (particleAbove === PARTICLE_TYPES.GRANITE || particleAbove === PARTICLE_TYPES.BASALT) {
                        if (Math.random() < 0.8) { // High chance to melt through
                            this.world.setParticle(nx, ny, PARTICLE_TYPES.LAVA);
                            this.world.setTemperature(nx, ny, 1300 + Math.random() * 200);
                        } else {
                            break; // Fissure blocked
                        }
                    } else if (particleAbove === PARTICLE_TYPES.BEDROCK) {
                        break; // Can't melt bedrock
                    }
                }
            }
        }
    }
}