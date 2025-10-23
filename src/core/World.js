import { Thermodynamics } from './WorldParts/Thermodynamics.js';
import { AirflowManager } from './WorldParts/AirflowManager.js';
import { ChunkManager } from './WorldParts/ChunkManager.js';
import { ParticleAccess } from './WorldParts/ParticleAccess.js';
import { generateScenarioTerrain } from './terrain/Scenario.js';
import { PARTICLE_TYPES, TEMPERATURE } from '../utils/Constants.js';

export class World {
    constructor(width, height) {
        this.width = width;
        this.height = height;
        this.size = width * height;

        // Core storage
        this.particles = new Uint8Array(this.size);
        this.particleData = new Float32Array(this.size * 4);
        this.updated = new Uint8Array(this.size);

        // Delegate subsystems
        this.particleAccess = new ParticleAccess(this);
        this.chunkManager = new ChunkManager(this);
        this.thermo = new Thermodynamics(this);
        this.airflow = new AirflowManager(this);

        // Expose commonly used helpers for backwards compatibility
        this.thermalResolution = this.thermo.thermalResolution;
        this.thermalWidth = this.thermo.thermalWidth;
        this.thermalHeight = this.thermo.thermalHeight;
        this.thermalSize = this.thermo.thermalSize;
        this.temperature = this.thermo.temperature;
        this.pressure = this.thermo.pressure;
        this.tempBuffer = this.thermo.tempBuffer;

        // Expose commonly used airflow helpers for convenience
        this.windResolution = this.airflow.windResolution;
        this.windWidth = this.airflow.windWidth;
        this.windHeight = this.airflow.windHeight;
        this.windSize = this.airflow.windSize;

        // Chunk config
        this.chunkSize = this.chunkManager.chunkSize;
        this.chunksX = this.chunkManager.chunksX;
        this.chunksY = this.chunkManager.chunksY;
        this.activeChunks = this.chunkManager.activeChunks;
        this.chunkSleepCounter = this.chunkManager.chunkSleepCounter;
        this.chunkSleepThreshold = this.chunkManager.chunkSleepThreshold;
    }

    initialize(config) {
        this.particles.fill(PARTICLE_TYPES.EMPTY);
        this.particleData.fill(0);
        this.thermo.reset();
        this.airflow.reset();
        this.chunkManager.reset();
        // Use existing terrain generator (scenario)
        generateScenarioTerrain(this, config);
    }

    // --- Forward key APIs to particleAccess / thermo / chunkManager ---
    getThermalIndex(x, y) { return this.thermo.getThermalIndex(x, y); }
    getTemperature(x, y) { return this.thermo.getTemperature(x, y); }
    setTemperature(x, y, t) { this.thermo.setTemperature(x, y, t); }
    getPressure(x, y) { return this.thermo.getPressure(x, y); }
    setPressure(x, y, p) { this.thermo.setPressure(x, y, p); }

    getIndex(x, y) { return this.particleAccess.getIndex(x, y); }
    inBounds(x, y) { return this.particleAccess.inBounds(x, y); }
    getParticle(x, y) { return this.particleAccess.getParticle(x, y); }
    setParticle(x, y, type, data = null) { return this.particleAccess.setParticle(x, y, type, data); }
    swapParticles(x1, y1, x2, y2) { return this.particleAccess.swapParticles(x1, y1, x2, y2); }

    markChunkActive(x, y) { return this.chunkManager.markChunkActive(x, y); }
    updateChunkSleep() { return this.chunkManager.updateChunkSleep(); }
    isChunkAsleep(id) { return this.chunkManager.isChunkAsleep(id); }

    countParticles(type) {
        let count = 0;
        for (let i = 0; i < this.size; i++) if (this.particles[i] === type) count++;
        return count;
    }

    clearUpdated() { this.updated.fill(0); }
    isUpdated(x, y) { return this.updated[this.getIndex(x, y)] === 1; }
    setUpdated(x, y) { this.updated[this.getIndex(x, y)] = 1; }

    // Airflow helpers
    getWind(x, y) { return this.airflow.getWind(x, y); }
    setWind(x, y, vx, vy) { return this.airflow.setWind(x, y, vx, vy); }
}