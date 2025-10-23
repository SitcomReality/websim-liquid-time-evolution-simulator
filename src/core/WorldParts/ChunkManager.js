export class ChunkManager {
    constructor(world) {
        this.world = world;
        this.chunkSize = 16;
        this.chunksX = Math.ceil(world.width / this.chunkSize);
        this.chunksY = Math.ceil(world.height / this.chunkSize);
        this.activeChunks = new Set();
        this.chunkSleepCounter = new Uint16Array(this.chunksX * this.chunksY);
        this.chunkSleepThreshold = 60;
    }

    reset() {
        this.activeChunks.clear();
        this.chunkSleepCounter.fill(0);
    }

    markChunkActive(x, y) {
        if (!this.world.particleData) return; // guard during init
        if (x < 0 || y < 0 || x >= this.world.width || y >= this.world.height) return;
        const chunkX = Math.floor(x / this.chunkSize);
        const chunkY = Math.floor(y / this.chunkSize);
        const id = chunkY * this.chunksX + chunkX;
        this.activeChunks.add(id);
        this.chunkSleepCounter[id] = 0;
    }

    updateChunkSleep() {
        for (let i = 0; i < this.chunkSleepCounter.length; i++) {
            if (!this.activeChunks.has(i)) {
                this.chunkSleepCounter[i] = Math.min(this.chunkSleepCounter[i] + 1, this.chunkSleepThreshold);
            }
        }
    }

    isChunkAsleep(chunkId) {
        return this.chunkSleepCounter[chunkId] >= this.chunkSleepThreshold;
    }
}