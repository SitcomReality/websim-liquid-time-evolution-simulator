import { PARTICLE_TYPES, PARTICLE_PROPERTIES } from '../../utils/Constants.js';

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
        
        // Viscous creep: even solid rock flows slowly at geological timescales
        this.applyViscousCreep(deltaTime, fidelity);
    }
    
    applyViscousCreep(deltaTime, fidelity) {
        // Make deep/pressurized stone flow like a very viscous fluid
        const sampleCount = Math.ceil(10 * fidelity);
        
        for (let i = 0; i < sampleCount; i++) {
            const x = Math.floor(Math.random() * this.world.width);
            const y = Math.floor(this.world.height * 0.5 + Math.random() * this.world.height * 0.4);
            
            const particle = this.world.getParticle(x, y);
            if (particle !== PARTICLE_TYPES.GRANITE && particle !== PARTICLE_TYPES.BASALT && particle !== PARTICLE_TYPES.MANTLE) continue;
            
            const pressure = this.world.getPressure(x, y);
            const temp = this.world.getTemperature(x, y);
            
            // High pressure + high temp = more fluid behavior
            const fluidityFactor = (pressure - 1.0) * (temp / 1000);
            if (fluidityFactor > 0.5 && Math.random() < fluidityFactor * 0.1) {
                // Flow toward lower pressure
                const pl = this.world.getPressure(x - 1, y);
                const pr = this.world.getPressure(x + 1, y);
                const dir = pl > pr ? 1 : -1;
                
                const nx = x + dir;
                const neighbor = this.world.getParticle(nx, y);
                const neighborProps = PARTICLE_PROPERTIES[neighbor];
                const currentProps = PARTICLE_PROPERTIES[particle];
                
                if (neighbor === PARTICLE_TYPES.EMPTY || (neighborProps && currentProps.density > neighborProps.density)) {
                    this.world.swapParticles(x, y, nx, y);
                }
            }
            
            // Pressure-induced phase transitions for cycling
            // Extreme pressure can cause spontaneous melting
            if (pressure > 4.0 && temp > 700 && Math.random() < 0.0001) {
                if (particle === PARTICLE_TYPES.GRANITE || particle === PARTICLE_TYPES.BASALT) {
                    this.world.setParticle(x, y, PARTICLE_TYPES.LAVA);
                    this.world.setTemperature(x, y, temp + 100);
                }
            }
            
            // Pressure relief causes decompression melting (like at mid-ocean ridges)
            if (pressure < 1.5 && temp > 900 && Math.random() < 0.0005) {
                if (particle === PARTICLE_TYPES.MANTLE || particle === PARTICLE_TYPES.BASALT) {
                    this.world.setParticle(x, y, PARTICLE_TYPES.LAVA);
                    this.world.setTemperature(x, y, temp + 50);
                }
            }
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
            const pressure = this.world.getPressure(x, y);
            
            // If hot enough and under pressure, melt mantle/granite to create a lava plume
            if (this.world.getParticle(x, y) === PARTICLE_TYPES.MANTLE && temp > 1400 && pressure > 2.0) {
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
            
            // Cooling and subduction: surface basalt in cold zones can sink and metamorphose
            const surfaceY = Math.floor(this.world.height * 0.3);
            const surfaceX = Math.floor(Math.random() * this.world.width);
            const surfaceTemp = this.world.getTemperature(surfaceX, surfaceY);
            const surfaceParticle = this.world.getParticle(surfaceX, surfaceY);
            
            if (surfaceParticle === PARTICLE_TYPES.BASALT && surfaceTemp < 100 && Math.random() < 0.01) {
                // Cold basalt becomes denser and can sink (subduction simulation)
                const below = this.world.getParticle(surfaceX, surfaceY + 1);
                if (below === PARTICLE_TYPES.WATER || below === PARTICLE_TYPES.SOIL) {
                    this.world.swapParticles(surfaceX, surfaceY, surfaceX, surfaceY + 1);
                }
            }
        }
    }
}