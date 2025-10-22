import { PARTICLE_TYPES, TEMPERATURE } from '../utils/Constants.js';

export class World {
    constructor(width, height) {
        this.width = width;
        this.height = height;
        this.size = width * height;
        
        // Use typed arrays for performance
        this.particles = new Uint8Array(this.size);
        this.particleData = new Float32Array(this.size * 4);
        this.updated = new Uint8Array(this.size);
        
        // Thermodynamics - use lower resolution for performance
        this.thermalResolution = 4; // 1 thermal cell per 4x4 pixels
        this.thermalWidth = Math.ceil(width / this.thermalResolution);
        this.thermalHeight = Math.ceil(height / this.thermalResolution);
        this.thermalSize = this.thermalWidth * this.thermalHeight;
        
        this.temperature = new Float32Array(this.thermalSize);
        this.pressure = new Float32Array(this.thermalSize);
        this.tempBuffer = new Float32Array(this.thermalSize); // For diffusion
        
        // Initialize to ambient temperature
        this.temperature.fill(TEMPERATURE.AMBIENT);
        this.pressure.fill(1.0); // 1 atm
        
        // Chunk system for optimization
        this.chunkSize = 16;
        this.chunksX = Math.ceil(width / this.chunkSize);
        this.chunksY = Math.ceil(height / this.chunkSize);
        this.activeChunks = new Set();
        
        // Track chunk activity to skip sleeping chunks
        this.chunkSleepCounter = new Uint16Array(this.chunksX * this.chunksY);
        this.chunkSleepThreshold = 60; // Frames of no activity before sleep
    }
    
    initialize(config) {
        this.particles.fill(PARTICLE_TYPES.EMPTY);
        this.particleData.fill(0);
        this.temperature.fill(TEMPERATURE.AMBIENT);
        this.pressure.fill(1.0);
        
        // Generate terrain
        this.generateTerrain(config);
    }
    
    generateTerrain(config) {
        const { stonePercent, sandPercent, waterPercent, soilPercent } = config;
        
        // Bedrock layer at the very bottom
        for (let y = this.height - 10; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                this.setParticle(x, y, PARTICLE_TYPES.BEDROCK);
            }
        }
        
        // Mantle layer
        const mantleLayerStart = Math.floor(this.height * 0.8);
        for (let y = mantleLayerStart; y < this.height - 10; y++) {
            for (let x = 0; x < this.width; x++) {
                this.setParticle(x, y, PARTICLE_TYPES.MANTLE);
            }
        }
        
        // Granite crust
        const crustLayerStart = Math.floor(this.height * 0.5);
        for (let y = crustLayerStart; y < mantleLayerStart; y++) {
            for (let x = 0; x < this.width; x++) {
                this.setParticle(x, y, PARTICLE_TYPES.GRANITE);
            }
        }
        
        // Add some variation to crust layer top with larger noise
        for (let x = 0; x < this.width; x++) {
            const noise = Math.sin(x * 0.02) * 20 + Math.cos(x * 0.015) * 15;
            const topY = Math.floor(crustLayerStart + noise);
            for (let y = crustLayerStart; y < topY && y < this.height; y++) {
                this.setParticle(x, y, PARTICLE_TYPES.EMPTY);
            }
             for (let y = topY; y < mantleLayerStart && y < topY + 5; y++) {
                if (this.getParticle(x, y) === PARTICLE_TYPES.GRANITE) {
                    this.setParticle(x, y, PARTICLE_TYPES.SOIL);
                }
            }
        }
        
        // Add sand in some areas
        for (let x = 0; x < this.width; x++) {
            if (Math.sin(x * 0.01) > 0.3) {
                const sandDepth = Math.floor(Math.random() * 10 + 5);
                const startY = crustLayerStart - sandDepth;
                for (let y = startY; y < crustLayerStart && y >= 0; y++) {
                    if (this.getParticle(x, y) === PARTICLE_TYPES.EMPTY) {
                        this.setParticle(x, y, PARTICLE_TYPES.SAND);
                    }
                }
            }
        }
        
        // Add water in coherent pools
        const waterLevel = Math.floor(this.height * 0.4);
        let inWater = false;
        for (let x = 0; x < this.width; x++) {
            // Create larger bodies of water
            if (Math.random() < 0.05) inWater = !inWater;
            
            if (inWater) {
                for (let y = waterLevel; y < this.height; y++) {
                    if (this.getParticle(x, y) === PARTICLE_TYPES.EMPTY) {
                        this.setParticle(x, y, PARTICLE_TYPES.WATER);
                    } else if (this.getParticle(x,y) !== PARTICLE_TYPES.WATER) {
                        break;
                    }
                }
            }
        }
        
        // Initialize temperature gradient
        for (let y = 0; y < this.height; y++) {
            const depthRatio = y / this.height;
            // Temp increases with depth, from ambient at surface to very hot in mantle
            const temp = TEMPERATURE.AMBIENT + depthRatio * depthRatio * 1800;
             for (let x = 0; x < this.width; x++) {
                const currentTemp = this.getTemperature(x, y);
                if (temp > currentTemp) {
                    this.setTemperature(x, y, temp);
                }
            }
        }
        
        // Plant some seeds in soil
        for (let x = 0; x < this.width; x += 20) {
            for (let y = 0; y < this.height - 1; y++) {
                if (this.getParticle(x, y) === PARTICLE_TYPES.SOIL && 
                    this.getParticle(x, y - 1) === PARTICLE_TYPES.EMPTY) {
                    if (Math.random() < 0.3) {
                        this.setParticle(x, y, PARTICLE_TYPES.PLANT, [0, 0, 0, 0]);
                    }
                }
            }
        }
    }
    
    getThermalIndex(x, y) {
        const tx = Math.floor(x / this.thermalResolution);
        const ty = Math.floor(y / this.thermalResolution);
        return ty * this.thermalWidth + tx;
    }
    
    getTemperature(x, y) {
        if (!this.inBounds(x, y)) return TEMPERATURE.AMBIENT;
        return this.temperature[this.getThermalIndex(x, y)];
    }
    
    setTemperature(x, y, temp) {
        if (!this.inBounds(x, y)) return;
        this.temperature[this.getThermalIndex(x, y)] = temp;
    }
    
    getPressure(x, y) {
        if (!this.inBounds(x, y)) return 1.0;
        return this.pressure[this.getThermalIndex(x, y)];
    }
    
    setPressure(x, y, press) {
        if (!this.inBounds(x, y)) return;
        this.pressure[this.getThermalIndex(x, y)] = press;
    }
    
    getIndex(x, y) {
        return y * this.width + x;
    }
    
    inBounds(x, y) {
        return x >= 0 && x < this.width && y >= 0 && y < this.height;
    }
    
    getParticle(x, y) {
        if (!this.inBounds(x, y)) return PARTICLE_TYPES.BEDROCK;
        return this.particles[this.getIndex(x, y)];
    }
    
    setParticle(x, y, type, data = null) {
        if (!this.inBounds(x, y)) return;
        const idx = this.getIndex(x, y);
        this.particles[idx] = type;

        if (data) {
            const dataIdx = idx * 4;
            for (let i = 0; i < data.length; i++) {
                this.particleData[dataIdx + i] = data[i];
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
        
        const temp = this.particles[idx1];
        this.particles[idx1] = this.particles[idx2];
        this.particles[idx2] = temp;
        
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
        const chunkId = chunkY * this.chunksX + chunkX;
        this.activeChunks.add(chunkId);
        this.chunkSleepCounter[chunkId] = 0; // Reset sleep counter
    }
    
    updateChunkSleep() {
        // Increment sleep counters for inactive chunks
        for (let i = 0; i < this.chunkSleepCounter.length; i++) {
            if (!this.activeChunks.has(i)) {
                this.chunkSleepCounter[i] = Math.min(
                    this.chunkSleepCounter[i] + 1,
                    this.chunkSleepThreshold
                );
            }
        }
    }
    
    isChunkAsleep(chunkId) {
        return this.chunkSleepCounter[chunkId] >= this.chunkSleepThreshold;
    }
    
    countParticles(type) {
        let count = 0;
        for (let i = 0; i < this.size; i++) {
            if (this.particles[i] === type) count++;
        }
        return count;
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