import { PARTICLE_TYPES } from '../utils/Constants.js';

export class World {
    constructor(width, height) {
        this.width = width;
        this.height = height;
        this.size = width * height;
        
        // Use typed arrays for performance
        this.particles = new Uint8Array(this.size);
        this.particleData = new Float32Array(this.size * 4); // extra data per particle
        this.updated = new Uint8Array(this.size);
        
        // For efficient updates of special particles
        this.plantIndices = new Set();
        this.animalIndices = new Set();
        
        // Chunk system for optimization
        this.chunkSize = 16;
        this.chunksX = Math.ceil(width / this.chunkSize);
        this.chunksY = Math.ceil(height / this.chunkSize);
        this.activeChunks = new Set();
    }
    
    initialize(config) {
        this.particles.fill(PARTICLE_TYPES.EMPTY);
        this.particleData.fill(0);
        this.plantIndices.clear();
        this.animalIndices.clear();
        
        // Generate terrain
        this.generateTerrain(config);
    }
    
    generateTerrain(config) {
        const { stonePercent, sandPercent, waterPercent, soilPercent, animalCount } = config;
        
        // Create base stone layer with noise
        for (let y = Math.floor(this.height * 0.5); y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                const noise = Math.sin(x * 0.05) * 10 + Math.cos(x * 0.03) * 15;
                const threshold = this.height * 0.5 + noise;
                
                if (y > threshold) {
                    const rand = Math.random() * 100;
                    if (rand < stonePercent) {
                        this.setParticle(x, y, PARTICLE_TYPES.STONE);
                    } else if (rand < stonePercent + sandPercent) {
                        this.setParticle(x, y, PARTICLE_TYPES.SAND);
                    } else if (rand < stonePercent + sandPercent + soilPercent) {
                        this.setParticle(x, y, PARTICLE_TYPES.SOIL);
                    }
                }
            }
        }
        
        // Add water layer
        const waterLevel = Math.floor(this.height * 0.6);
        for (let y = waterLevel; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                if (this.getParticle(x, y) === PARTICLE_TYPES.EMPTY) {
                    if (Math.random() * 100 < waterPercent) {
                        this.setParticle(x, y, PARTICLE_TYPES.WATER);
                    }
                }
            }
        }

        // Add animals
        for (let i = 0; i < animalCount; i++) {
            // Find a random valid spot on the ground
            for (let tries = 0; tries < 100; tries++) {
                const x = Math.floor(Math.random() * this.width);
                const y = Math.floor(Math.random() * this.height * 0.6); // Start in upper part of world
                if (this.getParticle(x, y) === PARTICLE_TYPES.EMPTY && this.getParticle(x, y + 1) !== PARTICLE_TYPES.EMPTY) {
                    this.setParticle(x, y, PARTICLE_TYPES.ANIMAL, [100, 0, 0]); // energy, type, age
                    break;
                }
            }
        }
    }
    
    getIndex(x, y) {
        return y * this.width + x;
    }
    
    inBounds(x, y) {
        return x >= 0 && x < this.width && y >= 0 && y < this.height;
    }
    
    getParticle(x, y) {
        if (!this.inBounds(x, y)) return PARTICLE_TYPES.STONE;
        return this.particles[this.getIndex(x, y)];
    }
    
    setParticle(x, y, type, data = null) {
        if (!this.inBounds(x, y)) return;
        const idx = this.getIndex(x, y);

        // Manage special particle indices
        const oldType = this.particles[idx];
        if (oldType === PARTICLE_TYPES.PLANT) this.plantIndices.delete(idx);
        if (oldType === PARTICLE_TYPES.ANIMAL) this.animalIndices.delete(idx);

        if (type === PARTICLE_TYPES.PLANT) this.plantIndices.add(idx);
        if (type === PARTICLE_TYPES.ANIMAL) this.animalIndices.add(idx);

        this.particles[idx] = type;

        const dataIdx = idx * 4;
        if (data) {
            for (let i = 0; i < data.length; i++) {
                this.particleData[dataIdx + i] = data[i];
            }
        } else {
            // Clear data if not provided
            for (let i = 0; i < 4; i++) {
                this.particleData[dataIdx + i] = 0;
            }
        }
        
        this.markChunkActive(x, y);
        // Also activate neighbors for robust updates at chunk boundaries
        this.markChunkActive(x - 1, y);
        this.markChunkActive(x + 1, y);
        this.markChunkActive(x, y - 1);
        this.markChunkActive(x, y + 1);
    }
    
    swapParticles(x1, y1, x2, y2) {
        if (!this.inBounds(x1, y1) || !this.inBounds(x2, y2)) return;
        const idx1 = this.getIndex(x1, y1);
        const idx2 = this.getIndex(x2, y2);
        
        // Swap types
        const temp = this.particles[idx1];
        this.particles[idx1] = this.particles[idx2];
        this.particles[idx2] = temp;

        // Swap data
        const dataIdx1 = idx1 * 4;
        const dataIdx2 = idx2 * 4;
        for (let i = 0; i < 4; i++) {
            const tempData = this.particleData[dataIdx1 + i];
            this.particleData[dataIdx1 + i] = this.particleData[dataIdx2 + i];
            this.particleData[dataIdx2 + i] = tempData;
        }

        // Manage special particle indices if swapped
        if (this.plantIndices.has(idx1)) { this.plantIndices.delete(idx1); this.plantIndices.add(idx2); }
        else if (this.plantIndices.has(idx2)) { this.plantIndices.delete(idx2); this.plantIndices.add(idx1); }
        if (this.animalIndices.has(idx1)) { this.animalIndices.delete(idx1); this.animalIndices.add(idx2); }
        else if (this.animalIndices.has(idx2)) { this.animalIndices.delete(idx2); this.animalIndices.add(idx1); }
        
        this.markChunkActive(x1, y1);
        this.markChunkActive(x2, y2);
        
        // Activate neighbors of both positions
        this.markChunkActive(x1 - 1, y1);
        this.markChunkActive(x1 + 1, y1);
        this.markChunkActive(x1, y1 - 1);
        this.markChunkActive(x1, y1 + 1);
        
        this.markChunkActive(x2 - 1, y2);
        this.markChunkActive(x2 + 1, y2);
        this.markChunkActive(x2, y2 - 1);
        this.markChunkActive(x2, y2 + 1);
    }
    
    markChunkActive(x, y) {
        if (!this.inBounds(x, y)) return;
        const chunkX = Math.floor(x / this.chunkSize);
        const chunkY = Math.floor(y / this.chunkSize);
        this.activeChunks.add(chunkY * this.chunksX + chunkX);
    }
    
    clearUpdated() {
        this.updated.fill(0);
    }
    
    isUpdated(x, y) {
        return this.updated[this.getIndex(x, y)] === 1;
    }
    
    setUpdated(x, y) {
        this.updated[this.getIndex(x, y)] = 1;
    }
}