import { ChunkStability } from './ChunkStability.js';
import { WakeSystem } from './WakeSystem.js';

export class ChunkManager {
    constructor(world, config = {}) {
        this.world = world;
        this.chunkSize = config.chunkSize || 16;
        this.chunksX = Math.ceil(world.width / this.chunkSize);
        this.chunksY = Math.ceil(world.height / this.chunkSize);
        this.activeChunks = new Set();
        this.chunkSleepCounter = new Uint16Array(this.chunksX * this.chunksY);
        this.chunkSleepThreshold = 60;

        // Advanced stability and wake systems
        this.stability = new ChunkStability(world, this, config);
        this.wakeSystem = new WakeSystem(world, this, this.stability, config);
    }

    reset() {
        this.activeChunks.clear();
        this.chunkSleepCounter.fill(0);
        this.stability.chunkStates.fill(0); // All ACTIVE initially
        this.stability.stabilityScores.fill(1.0);
        this.stability.drowsySkipCounters.fill(0);
        this.stability.wokenTicks.fill(0);
    }

    markChunkActive(x, y) {
        if (!this.world.particleData) return;
        if (x < 0 || y < 0 || x >= this.world.width || y >= this.world.height) return;
        const chunkX = Math.floor(x / this.chunkSize);
        const chunkY = Math.floor(y / this.chunkSize);
        const id = chunkY * this.chunksX + chunkX;
        this.activeChunks.add(id);
        this.chunkSleepCounter[id] = 0;
    }

    updateChunkSleep() {
        // Update stability analysis periodically
        this.stability.updateStability(0.016); // Assume ~60 Hz
        
        // Update wake system
        this.wakeSystem.update(0.016);

        // Traditional sleep counter fallback for direct changes
        for (let i = 0; i < this.chunkSleepCounter.length; i++) {
            if (!this.activeChunks.has(i)) {
                this.chunkSleepCounter[i] = Math.min(this.chunkSleepCounter[i] + 1, this.chunkSleepThreshold);
            }
        }
    }

    isChunkAsleep(chunkId) {
        // A chunk is NOT asleep if it was explicitly marked active this frame
        if (this.activeChunks.has(chunkId)) return false;

        // Otherwise check stability system
        const state = this.stability.chunkStates[chunkId];
        // SLEEPING (2) and FOSSIL (3) are asleep
        if (state >= 2) return true;
        
        return false;
    }

    shouldUpdateChunk(chunkId) {
        return this.stability.shouldUpdateChunk(chunkId);
    }

    /**
     * Trigger event-based waking (earthquake, volcano, etc.)
     */
    scheduleWakeEvent(centerX, centerY, radius, intensity = 1.0) {
        this.wakeSystem.scheduleWakeEvent(centerX, centerY, radius, intensity);
    }

    /**
     * Get diagnostic stats.
     */
    getStats() {
        const stabilityStats = this.stability.getStats();
        const wakeStats = this.wakeSystem.getStats();
        return {
            chunks: stabilityStats,
            wake: wakeStats
        };
    }
}