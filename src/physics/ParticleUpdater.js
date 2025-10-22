import { PARTICLE_TYPES, PARTICLE_PROPERTIES } from '../utils/Constants.js';

export class ParticleUpdater {
    constructor(world) {
        this.world = world;
        this.erosionAccumulator = 0;
        this.weatheringAccumulator = 0;
    }
    
    update(fidelity, deltaTime) {
        this.world.clearUpdated();
        
        const activeChunks = Array.from(this.world.activeChunks);
        this.world.activeChunks.clear();

        // Skip sleeping chunks for fast physics
        const awakeChunks = activeChunks.filter(id => !this.world.isChunkAsleep(id));
        
        // Shuffle chunks to avoid directional bias
        for (let i = awakeChunks.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [awakeChunks[i], awakeChunks[j]] = [awakeChunks[j], awakeChunks[i]];
        }
        
        for (const chunkId of awakeChunks) {
            const chunkX = chunkId % this.world.chunksX;
            const chunkY = Math.floor(chunkId / this.world.chunksX);

            const startX = chunkX * this.world.chunkSize;
            const startY = chunkY * this.world.chunkSize;
            const endX = Math.min(startX + this.world.chunkSize, this.world.width);
            const endY = Math.min(startY + this.world.chunkSize, this.world.height);
            
            // Update from bottom to top for falling particles
            for (let y = endY - 1; y >= startY; y--) {
                const dir = Math.random() > 0.5 ? 1 : -1;
                const xStart = dir > 0 ? startX : endX - 1;
                const xEnd = dir > 0 ? endX : startX - 1;
                
                for (let x = xStart; dir > 0 ? x < xEnd : x > xEnd; x += dir) {
                    if (this.world.isUpdated(x, y)) continue;

                    // Fidelity check - skip some particles for performance
                    if (Math.random() > fidelity) continue;
                    
                    const particle = this.world.getParticle(x, y);
                    if (particle === PARTICLE_TYPES.EMPTY) continue;
                    
                    this.updateParticle(x, y, particle, deltaTime);
                }
            }
        }
        
        this.world.updateChunkSleep();

        // Geological processes scale with time
        this.erosionAccumulator += deltaTime;
        this.weatheringAccumulator += deltaTime;
        
        // Run erosion periodically (scales with simulation time)
        if (this.erosionAccumulator > 100) {
            const erosionCount = Math.ceil((this.world.size / 5000) * fidelity);
            for (let i = 0; i < erosionCount; i++) {
                this.updateErosion();
            }
            this.erosionAccumulator = 0;
        }
        
        // Run weathering/slow processes
        if (this.weatheringAccumulator > 50) {
            const slowUpdateCount = Math.ceil((this.world.size / 2000) * fidelity);
            for (let i = 0; i < slowUpdateCount; i++) {
                this.updateSlowProcesses(deltaTime);
            }
            this.weatheringAccumulator = 0;
        }
    }
    
    updateParticle(x, y, type, deltaTime) {
        switch(type) {
            case PARTICLE_TYPES.SAND:
                this.updateFallingSolid(x, y);
                break;
            case PARTICLE_TYPES.WATER:
                this.updateLiquid(x, y);
                break;
            case PARTICLE_TYPES.LAVA:
                this.updateLava(x, y);
                break;
            case PARTICLE_TYPES.STEAM:
                this.updateSteam(x, y);
                break;
            case PARTICLE_TYPES.SOIL:
                this.updateSoil(x, y);
                break;
        }
    }

    updateSlowProcesses(deltaTime) {
        const x = Math.floor(Math.random() * this.world.width);
        const y = Math.floor(Math.random() * this.world.height);

        const particleType = this.world.getParticle(x, y);
        
        if (particleType === PARTICLE_TYPES.PLANT) {
            this.updatePlant(x, y, deltaTime);
        } else if (particleType === PARTICLE_TYPES.STONE) {
            // Stone weathering into soil
            const above = this.world.getParticle(x, y - 1);
            if ((above === PARTICLE_TYPES.EMPTY || above === PARTICLE_TYPES.WATER) && Math.random() < 0.0001) {
                this.world.setParticle(x, y, PARTICLE_TYPES.SOIL);
            }
        }
    }
    
    updateErosion() {
        // Water erodes stone/soil over time
        const x = Math.floor(Math.random() * this.world.width);
        const y = Math.floor(Math.random() * this.world.height);
        
        if (this.world.getParticle(x, y) === PARTICLE_TYPES.WATER) {
            // Check for erodible material below or beside
            for (let dx = -1; dx <= 1; dx++) {
                for (let dy = 0; dy <= 1; dy++) {
                    const nx = x + dx;
                    const ny = y + dy;
                    const neighbor = this.world.getParticle(nx, ny);
                    
                    if (neighbor === PARTICLE_TYPES.SOIL && Math.random() < 0.01) {
                        this.world.setParticle(nx, ny, PARTICLE_TYPES.SAND);
                    } else if (neighbor === PARTICLE_TYPES.STONE && Math.random() < 0.001) {
                        this.world.setParticle(nx, ny, PARTICLE_TYPES.SOIL);
                    }
                }
            }
        }
    }
    
    updateFallingSolid(x, y) {
        const below = this.world.getParticle(x, y + 1);
        
        if (below === PARTICLE_TYPES.EMPTY || below === PARTICLE_TYPES.WATER) {
            this.world.swapParticles(x, y, x, y + 1);
            this.world.setUpdated(x, y + 1);
        } else {
            // Try diagonal movement, check both sides to prevent bias
            const dir = Math.random() > 0.5 ? 1 : -1;
            let diagBelow = this.world.getParticle(x + dir, y + 1);
            if (diagBelow === PARTICLE_TYPES.EMPTY || diagBelow === PARTICLE_TYPES.WATER) {
                this.world.swapParticles(x, y, x + dir, y + 1);
                this.world.setUpdated(x + dir, y + 1);
                return;
            }
            diagBelow = this.world.getParticle(x - dir, y + 1);
            if (diagBelow === PARTICLE_TYPES.EMPTY || diagBelow === PARTICLE_TYPES.WATER) {
                this.world.swapParticles(x, y, x - dir, y + 1);
                this.world.setUpdated(x - dir, y + 1);
            }
        }
    }
    
    updateLiquid(x, y) {
        const below = this.world.getParticle(x, y + 1);
        
        // Fall down
        if (below === PARTICLE_TYPES.EMPTY) {
            this.world.swapParticles(x, y, x, y + 1);
            this.world.setUpdated(x, y + 1);
            return;
        }
        
        // Only spread if not settled
        const leftBelow = this.world.getParticle(x - 1, y + 1);
        const rightBelow = this.world.getParticle(x + 1, y + 1);
        
        if (leftBelow !== PARTICLE_TYPES.EMPTY && rightBelow !== PARTICLE_TYPES.EMPTY) {
            // Likely settled - skip horizontal spread to save CPU
            return;
        }
        
        // Spread horizontally
        const dir = Math.random() > 0.5 ? 1 : -1;
        let side = this.world.getParticle(x + dir, y);
        if (side === PARTICLE_TYPES.EMPTY) {
            this.world.swapParticles(x, y, x + dir, y);
            this.world.setUpdated(x + dir, y);
            return;
        }
        side = this.world.getParticle(x - dir, y);
        if (side === PARTICLE_TYPES.EMPTY) {
            this.world.swapParticles(x, y, x - dir, y);
            this.world.setUpdated(x - dir, y);
            return;
        }
        
        // Try diagonal
        const diagBelow = this.world.getParticle(x + dir, y + 1);
        if (diagBelow === PARTICLE_TYPES.EMPTY) {
            this.world.swapParticles(x, y, x + dir, y + 1);
            this.world.setUpdated(x + dir, y + 1);
        }
    }
    
    updateLava(x, y) {
        // Lava behaves like liquid but can melt things
        this.updateLiquid(x, y);
        
        // Convert adjacent ice to water
        for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
                if (dx === 0 && dy === 0) continue;
                const nx = x + dx;
                const ny = y + dy;
                if (this.world.getParticle(nx, ny) === PARTICLE_TYPES.ICE) {
                    this.world.setParticle(nx, ny, PARTICLE_TYPES.WATER);
                }
            }
        }
    }
    
    updateSteam(x, y) {
        // Rise up
        const above = this.world.getParticle(x, y - 1);
        if (above === PARTICLE_TYPES.EMPTY) {
            this.world.swapParticles(x, y, x, y - 1);
            this.world.setUpdated(x, y - 1);
            return;
        }
        
        // Spread horizontally - check both sides
        const dir = Math.random() > 0.5 ? 1 : -1;
        let side = this.world.getParticle(x + dir, y);
        if (side === PARTICLE_TYPES.EMPTY) {
            this.world.swapParticles(x, y, x + dir, y);
            this.world.setUpdated(x + dir, y);
            return;
        }
        side = this.world.getParticle(x - dir, y);
        if (side === PARTICLE_TYPES.EMPTY) {
            this.world.swapParticles(x, y, x - dir, y);
            this.world.setUpdated(x - dir, y);
        }
        
        // Chance to condense back to water
        if (Math.random() < 0.001) {
            this.world.setParticle(x, y, PARTICLE_TYPES.WATER);
        }
    }
    
    updateSoil(x, y) {
        // Soil can slowly fall if unsupported
        const below = this.world.getParticle(x, y + 1);
        if (below === PARTICLE_TYPES.EMPTY || below === PARTICLE_TYPES.WATER) {
            if (Math.random() < 0.01) { // Reduced chance to give more structure
                this.world.swapParticles(x, y, x, y + 1);
                this.world.setUpdated(x, y + 1);
            }
        }
    }

    updatePlant(x, y, deltaTime) {
        const idx = this.world.getIndex(x, y) * 4;
        let energy = this.world.particleData[idx];
        let type = this.world.particleData[idx + 1];
        let age = this.world.particleData[idx + 2];

        // Scale growth by actual simulation time
        const timeFactor = deltaTime / 16;
        age += timeFactor;
        this.world.particleData[idx + 2] = age;

        // Photosynthesis
        if (this.world.getParticle(x, y - 1) === PARTICLE_TYPES.EMPTY) {
            energy += 0.5 * timeFactor; // Faster energy gain
        }

        // Water absorption from nearby
        for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
                if (this.world.getParticle(x + dx, y + dy) === PARTICLE_TYPES.WATER) {
                    energy += 0.2 * timeFactor;
                    if (Math.random() < 0.02 * timeFactor) {
                        this.world.setParticle(x + dx, y + dy, PARTICLE_TYPES.EMPTY);
                    }
                    break;
                }
            }
        }

        if (type === 0) { // Seed
            if (energy > 3) {
                this.world.particleData[idx + 1] = 1;
                energy = 0;
                if (this.world.getParticle(x, y - 1) === PARTICLE_TYPES.EMPTY) {
                    this.world.setParticle(x, y - 1, PARTICLE_TYPES.PLANT, [0, 1, 0, 0]);
                }
            }
        } else if (type === 1) { // Stem
            // Grow upwards
            if (energy > 5 && this.world.getParticle(x, y - 1) === PARTICLE_TYPES.EMPTY) {
                this.world.setParticle(x, y - 1, PARTICLE_TYPES.PLANT, [0, 1, 0, 0]);
                energy = 0;
            }
            
            // Spread seeds
            if (age > 200 && Math.random() < 0.001 * timeFactor) {
                for (let dx = -10; dx <= 10; dx++) {
                    const nx = x + dx;
                    const ny = y + Math.floor(Math.random() * 5);
                    if (this.world.getParticle(nx, ny) === PARTICLE_TYPES.SOIL) {
                        this.world.setParticle(nx, ny, PARTICLE_TYPES.PLANT, [0, 0, 0, 0]);
                    }
                }
            }
        }

        // Death
        if (age > 500 || this.world.getParticle(x, y - 1) === PARTICLE_TYPES.STONE) {
            this.world.setParticle(x, y, PARTICLE_TYPES.SOIL);
            return;
        }

        this.world.particleData[idx] = energy;
    }
}