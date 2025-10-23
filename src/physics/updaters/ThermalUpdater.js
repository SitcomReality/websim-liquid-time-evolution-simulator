import { PARTICLE_TYPES, TEMPERATURE, THERMAL_PROPERTIES } from '../../utils/Constants.js';

export class ThermalUpdater {
    constructor(world) {
        this.world = world;
        this.diffusionRate = 0.3; // Heat diffusion coefficient
    }

    update(fidelity, deltaTime) {
        // Apply heat diffusion
        this.diffuseHeat(fidelity);
        
        // Apply phase transitions
        this.applyPhaseTransitions(fidelity);
        
        // Update pressure based on temperature
        this.updatePressure(fidelity);
    }

    diffuseHeat(fidelity) {
        // Sample-based diffusion for performance
        const sampleCount = Math.ceil((this.world.thermalSize / 20) * fidelity);
        
        for (let i = 0; i < sampleCount; i++) {
            const idx = Math.floor(Math.random() * this.world.thermalSize);
            const x = idx % this.world.thermalWidth;
            const y = Math.floor(idx / this.world.thermalWidth);
            
            const temp = this.world.temperature[idx];
            let avgTemp = temp;
            let count = 1;
            
            // Average with neighbors
            for (let dy = -1; dy <= 1; dy++) {
                for (let dx = -1; dx <= 1; dx++) {
                    if (dx === 0 && dy === 0) continue;
                    const nx = x + dx;
                    const ny = y + dy;
                    if (nx >= 0 && nx < this.world.thermalWidth && ny >= 0 && ny < this.world.thermalHeight) {
                        const nIdx = ny * this.world.thermalWidth + nx;
                        avgTemp += this.world.temperature[nIdx];
                        count++;
                    }
                }
            }
            
            avgTemp /= count;
            this.world.tempBuffer[idx] = temp + (avgTemp - temp) * this.diffusionRate;
        }
        
        // Copy buffer back (only for sampled cells)
        for (let i = 0; i < sampleCount; i++) {
            const idx = Math.floor(Math.random() * this.world.thermalSize);
            this.world.temperature[idx] = this.world.tempBuffer[idx];
        }
    }

    applyPhaseTransitions(fidelity) {
        // Sample particles for phase transitions
        const sampleCount = Math.ceil((this.world.size / 100) * fidelity);
        
        for (let i = 0; i < sampleCount; i++) {
            const x = Math.floor(Math.random() * this.world.width);
            const y = Math.floor(Math.random() * this.world.height);
            
            const particle = this.world.getParticle(x, y);
            const temp = this.world.getTemperature(x, y);
            
            this.transitionParticle(x, y, particle, temp);
        }
    }

    transitionParticle(x, y, particle, temp) {
        const pressure = this.world.getPressure(x, y);
        
        switch (particle) {
            case PARTICLE_TYPES.ICE:
                if (temp > TEMPERATURE.ICE_POINT) {
                    this.world.setParticle(x, y, PARTICLE_TYPES.WATER);
                    // Absorb latent heat of fusion, cooling the spot significantly.
                    const newTemp = this.world.getTemperature(x, y) - 80;
                    this.world.setTemperature(x, y, newTemp);
                }
                break;
            
            case PARTICLE_TYPES.WATER:
                if (temp < TEMPERATURE.ICE_POINT) {
                    this.world.setParticle(x, y, PARTICLE_TYPES.ICE);
                    this.world.setTemperature(x, y, TEMPERATURE.ICE_POINT);
                } else if (temp > TEMPERATURE.WATER_BOILING) {
                    // Evaporate only if exposed to air; scale rate with excess heat
                    if (this.world.getParticle(x, y - 1) === PARTICLE_TYPES.EMPTY && Math.random() < Math.min(0.5, (temp - TEMPERATURE.WATER_BOILING) / 400)) {
                        this.world.setParticle(x, y, PARTICLE_TYPES.STEAM);
                    }
                } else if (temp > 60) {
                    // Gentle surface evaporation below boiling
                    if (this.world.getParticle(x, y - 1) === PARTICLE_TYPES.EMPTY && Math.random() < 0.002) {
                        this.world.setParticle(x, y, PARTICLE_TYPES.STEAM);
                    }
                }
                break;
            
            case PARTICLE_TYPES.STEAM:
                // Let SteamUpdater/cloud logic govern most condensation; keep a tiny baseline
                if (temp < 10 && Math.random() < 0.0005) {
                    this.world.setParticle(x, y, PARTICLE_TYPES.WATER);
                }
                break;
            
            case PARTICLE_TYPES.GRANITE:
                // Pressure raises melting point: negative feedback against runaway melting
                const effectiveGraniteMelting = TEMPERATURE.GRANITE_MELTING + Math.max(0, (pressure - 1.0)) * 120;
                if (temp > effectiveGraniteMelting) {
                    this.world.setParticle(x, y, PARTICLE_TYPES.LAVA);
                    // Latent heat absorption: melting consumes heat
                    this.world.setTemperature(x, y, temp - 100);
                }
                break;
            
            case PARTICLE_TYPES.BASALT:
                // Basalt can melt into lava (easier than granite)
                if (temp > TEMPERATURE.BASALT_MELTING) {
                    this.world.setParticle(x, y, PARTICLE_TYPES.LAVA);
                    this.world.setTemperature(x, y, temp + 30);
                }
                // Basalt metamorphoses into granite under high pressure and moderate heat
                else if (pressure > 2.5 && temp > TEMPERATURE.BASALT_METAMORPHISM && temp < 900 && Math.random() < 0.0005) {
                    this.world.setParticle(x, y, PARTICLE_TYPES.GRANITE);
                    // Metamorphism absorbs some heat
                    this.world.setTemperature(x, y, temp - 30);
                }
                break;
            
            case PARTICLE_TYPES.LAVA:
                // Self-cooling: faster if exposed to non-lava; slow radiative cooling even when buried
                let exposure = 0;
                for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
                    if (dx === 0 && dy === 0) continue;
                    const n = this.world.getParticle(x + dx, y + dy);
                    if (n !== PARTICLE_TYPES.LAVA && n !== PARTICLE_TYPES.BEDROCK) exposure++;
                }
                const cool = (exposure >= 3 ? 6 : 2) + 0.5; // surface vs buried + radiative
                this.world.setTemperature(x, y, temp - cool);
                
                // Lava heats surroundings (reduced to curb runaway)
                for (let dy = -1; dy <= 1; dy++) {
                    for (let dx = -1; dx <= 1; dx++) {
                        if (dx === 0 && dy === 0) continue;
                        const nx = x + dx, ny = y + dy;
                        if (this.world.inBounds(nx, ny)) {
                            const neighborTemp = this.world.getTemperature(nx, ny);
                            this.world.setTemperature(nx, ny, neighborTemp + 2);
                        }
                    }
                }
                break;
            
            case PARTICLE_TYPES.SOIL:
                // Soil lithifies into basalt under high pressure and moderate heat (sedimentary -> metamorphic)
                if (pressure > 3.0 && temp > TEMPERATURE.SOIL_LITHIFICATION && temp < 900 && Math.random() < 0.0002) {
                    this.world.setParticle(x, y, PARTICLE_TYPES.BASALT);
                    // Lithification releases heat from compression
                    this.world.setTemperature(x, y, temp + 20);
                }
                break;
            
            case PARTICLE_TYPES.SAND:
                // Sand lithifies into granite under extreme pressure (sandstone formation)
                if (pressure > 3.5 && temp > TEMPERATURE.SAND_LITHIFICATION && temp < 1000 && Math.random() < 0.0001) {
                    this.world.setParticle(x, y, PARTICLE_TYPES.GRANITE);
                    this.world.setTemperature(x, y, temp + 15);
                }
                break;
        }
    }

    updatePressure(fidelity) {
        // Simple pressure model: P = ρRT (ideal gas approximation)
        // Higher temperature = higher pressure
        const sampleCount = Math.ceil((this.world.thermalSize / 50) * fidelity);
        
        for (let i = 0; i < sampleCount; i++) {
            const idx = Math.floor(Math.random() * this.world.thermalSize);
            const temp = this.world.temperature[idx];
            
            // Convert temp to Kelvin and calculate relative pressure
            const tempK = temp + 273.15;
            const basePressure = 1.0; // 1 atm at ambient
            const pressure = basePressure * (tempK / (TEMPERATURE.AMBIENT + 273.15));
            
            this.world.pressure[idx] = Math.max(0.1, Math.min(pressure, 10.0));
        }
    }
}