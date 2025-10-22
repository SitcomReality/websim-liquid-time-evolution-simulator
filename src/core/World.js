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
        
        // Chunk system for optimization
        this.chunkSize = 16;
        this.chunksX = Math.ceil(width / this.chunkSize);
        this.chunksY = Math.ceil(height / this.chunkSize);
        this.activeChunks = new Set();
    }
    
    initialize(config) {
        this.particles.fill(PARTICLE_TYPES.EMPTY);
        this.particleData.fill(0);
        
        // Generate terrain
        this.generateTerrain(config);
    }
    
    generateTerrain(config) {
        const { stonePercent, sandPercent, waterPercent, soilPercent } = config;
        
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
    
    setParticle(x, y, type) {
        if (!this.inBounds(x, y)) return;
        const idx = this.getIndex(x, y);
        this.particles[idx] = type;
        this.markChunkActive(x, y);
    }
    
    swapParticles(x1, y1, x2, y2) {
        if (!this.inBounds(x1, y1) || !this.inBounds(x2, y2)) return;
        const idx1 = this.getIndex(x1, y1);
        const idx2 = this.getIndex(x2, y2);
        
        const temp = this.particles[idx1];
        this.particles[idx1] = this.particles[idx2];
        this.particles[idx2] = temp;
        
        this.markChunkActive(x1, y1);
        this.markChunkActive(x2, y2);
    }
    
    markChunkActive(x, y) {
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

