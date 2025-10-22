import { PARTICLE_TYPES, PARTICLE_PROPERTIES } from '../utils/Constants.js';

export class ParticleUpdater {
    constructor(world) {
        this.world = world;
    }
    
    updateFastProcesses(fidelity, deltaTime) {
        this.world.clearUpdated();
        
        const activeChunks = Array.from(this.world.activeChunks);
        this.world.activeChunks.clear();

        // Shuffle chunks to avoid directional bias
        for (let i = activeChunks.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [activeChunks[i], activeChunks[j]] = [activeChunks[j], activeChunks[i]];
        }
        
        for (const chunkId of activeChunks) {
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
                const xEnd = dir > 0 ? endX : -1;
                if (xEnd < -1) continue; // safety for endX=0
                
                for (let x = xStart; x !== xEnd; x += dir) {
                    if (this.world.isUpdated(x, y)) continue;

                    // Fidelity check
                    if (Math.random() > fidelity) continue;
                    
                    const particle = this.world.getParticle(x, y);
                    if (particle === PARTICLE_TYPES.EMPTY) continue;
                    
                    this.updateParticle(x, y, particle, deltaTime);
                }
            }
        }

        // Slow updates are not chunked and happen randomly across the map
        // The number of updates scales with world size and fidelity
        const slowUpdateCount = Math.ceil((this.world.size / 1000) * fidelity);
        for (let i = 0; i < slowUpdateCount; i++) {
            this.updateSlowProcesses(deltaTime);
        }
    }

    updateMediumProcesses(fidelity, deltaTime) {
        // Update all plants
        for (const idx of this.world.plantIndices) {
            if (Math.random() > fidelity) continue;
            const x = idx % this.world.width;
            const y = Math.floor(idx / this.world.width);
            this.updatePlant(x, y, deltaTime);
        }

        // Update all animals
        for (const idx of this.world.animalIndices) {
             if (Math.random() > fidelity) continue;
            const x = idx % this.world.width;
            const y = Math.floor(idx / this.world.width);
            this.updateAnimal(x, y, deltaTime);
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
            case PARTICLE_TYPES.ANIMAL:
                this.updateFallingSolid(x, y); // Animals are subject to gravity
                break;
        }
    }

    updateSlowProcesses(deltaTime) {
        // Future home for geology, etc.
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
        // Reduce jitter: check if stable before moving
        if (
            this.world.getParticle(x, y + 1) !== PARTICLE_TYPES.EMPTY &&
            this.world.getParticle(x - 1, y) !== PARTICLE_TYPES.EMPTY &&
            this.world.getParticle(x + 1, y) !== PARTICLE_TYPES.EMPTY
        ) {
            // If surrounded, small chance to check for updates anyway
            if (Math.random() > 0.1) return;
        }

        const below = this.world.getParticle(x, y + 1);
        
        // Fall down
        if (below === PARTICLE_TYPES.EMPTY) {
            this.world.swapParticles(x, y, x, y + 1);
            this.world.setUpdated(x, y + 1);
            return;
        }
        
        // Spread horizontally - check both sides to settle faster
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
        const idx = this.world.getIndex(x, y);
        const dataIdx = idx * 4;
        let energy = this.world.particleData[dataIdx];
        let type = this.world.particleData[dataIdx + 1]; // 0:seed, 1:stem
        let age = this.world.particleData[dataIdx + 2];

        const timeFactor = deltaTime / 50; // Normalize to medium update interval
        age += timeFactor;
        this.world.particleData[dataIdx + 2] = age;

        // Photosynthesis: gain energy if near the surface
        if (this.world.getParticle(x, y - 1) === PARTICLE_TYPES.EMPTY || this.world.getParticle(x, y-2) === PARTICLE_TYPES.EMPTY) {
            energy += 1 * timeFactor;
        }

        // Consume water from nearby soil/water
        for (let dy = 0; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
                if(this.world.getParticle(x + dx, y + dy) === PARTICLE_TYPES.WATER) {
                    energy += 0.5 * timeFactor;
                    if(Math.random() < 0.01 * timeFactor) this.world.setParticle(x+dx, y+dy, PARTICLE_TYPES.SOIL);
                    break;
                }
            }
        }


        if (type === 0) { // Seed
            if (energy > 5) { // Sprout
                this.world.particleData[dataIdx + 1] = 1; // Become stem
                energy = 0;
                // Grow a stem immediately above if possible
                if (this.world.getParticle(x, y - 1) === PARTICLE_TYPES.EMPTY) {
                    this.world.setParticle(x, y - 1, PARTICLE_TYPES.PLANT, [0, 1, 0, 0]);
                }
            }
        } else if (type === 1) { // Stem
            // Grow upwards
            const height = this.getPlantHeight(x, y);
            if (energy > (10 + height * 2) && this.world.getParticle(x, y - 1) === PARTICLE_TYPES.EMPTY && height < 8) {
                this.world.setParticle(x, y - 1, PARTICLE_TYPES.PLANT, [0, 1, 0, 0]);
                energy = 0;
            }
        }

        // Die of old age or if buried
        if (age > 500 || this.world.getParticle(x, y - 1) === PARTICLE_TYPES.STONE) {
            this.world.setParticle(x, y, PARTICLE_TYPES.SOIL); // turns to soil
            return;
        }

        this.world.particleData[dataIdx] = energy;
    }

    getPlantHeight(x, startY) {
        let y = startY;
        let height = 0;
        while(this.world.getParticle(x, y) === PARTICLE_TYPES.PLANT) {
            height++;
            y++;
        }
        return height;
    }

    updateAnimal(x, y, deltaTime) {
        const dataIdx = this.world.getIndex(x, y) * 4;
        let energy = this.world.particleData[dataIdx];
        let age = this.world.particleData[dataIdx + 2];

        const timeFactor = deltaTime / 50;
        age += timeFactor;
        energy -= 0.5 * timeFactor; // Metabolism

        // Wander
        if (Math.random() < 0.5) {
            const dir = Math.random() > 0.5 ? 1 : -1;
            const nx = x + dir;
            // Move if empty and supported
            if (this.world.getParticle(nx, y) === PARTICLE_TYPES.EMPTY && this.world.getParticle(nx, y+1) !== PARTICLE_TYPES.EMPTY) {
                this.world.swapParticles(x, y, nx, y);
                x = nx; // update position for rest of logic
            }
        }

        // Eat plants
        for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
                if (dx === 0 && dy === 0) continue;
                const nx = x + dx;
                const ny = y + dy;
                if (this.world.getParticle(nx, ny) === PARTICLE_TYPES.PLANT) {
                    this.world.setParticle(nx, ny, PARTICLE_TYPES.EMPTY);
                    energy += 25;
                    break;
                }
            }
        }
        
        // Reproduce
        if (energy > 200) {
            energy = 100;
            for (let dy = -1; dy <= 1; dy++) {
                for (let dx = -1; dx <= 1; dx++) {
                    const nx = x + dx;
                    const ny = y + dy;
                    if (this.world.getParticle(nx, ny) === PARTICLE_TYPES.EMPTY) {
                        this.world.setParticle(nx, ny, PARTICLE_TYPES.ANIMAL, [100, 0, 0]);
                        break;
                    }
                }
            }
        }

        // Die
        if (energy <= 0 || age > 800) {
            this.world.setParticle(x, y, PARTICLE_TYPES.SOIL);
        } else {
            this.world.particleData[dataIdx] = energy;
            this.world.particleData[dataIdx + 2] = age;
        }
    }
}