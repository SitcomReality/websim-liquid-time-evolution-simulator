export class ParticleAccess {
    constructor(world) {
        this.world = world;
    }

    getIndex(x, y) {
        return y * this.world.width + x;
    }

    inBounds(x, y) {
        return x >= 0 && x < this.world.width && y >= 0 && y < this.world.height;
    }

    getParticle(x, y) {
        if (!this.inBounds(x, y)) return this.world.constructor ? null : 0; // fallback handled by callers
        return this.world.particles[this.getIndex(x, y)];
    }

    setParticle(x, y, type, data = null) {
        if (!this.inBounds(x, y)) return;
        const idx = this.getIndex(x, y);
        this.world.particles[idx] = type;
        if (data) {
            const dataIdx = idx * 4;
            for (let i = 0; i < data.length; i++) this.world.particleData[dataIdx + i] = data[i];
        }
        this.world.markChunkActive(x, y);
        this.world.markChunkActive(x - 1, y);
        this.world.markChunkActive(x + 1, y);
        this.world.markChunkActive(x, y - 1);
        this.world.markChunkActive(x, y + 1);
    }

    swapParticles(x1, y1, x2, y2) {
        if (!this.inBounds(x1, y1) || !this.inBounds(x2, y2)) return;
        const idx1 = this.getIndex(x1, y1), idx2 = this.getIndex(x2, y2);
        const tmp = this.world.particles[idx1];
        this.world.particles[idx1] = this.world.particles[idx2];
        this.world.particles[idx2] = tmp;
        this.world.markChunkActive(x1, y1);
        this.world.markChunkActive(x2, y2);
        // neighbors
        this.world.markChunkActive(x1 - 1, y1); this.world.markChunkActive(x1 + 1, y1);
        this.world.markChunkActive(x1, y1 - 1); this.world.markChunkActive(x1, y1 + 1);
        this.world.markChunkActive(x2 - 1, y2); this.world.markChunkActive(x2 + 1, y2);
        this.world.markChunkActive(x2, y2 - 1); this.world.markChunkActive(x2, y2 + 1);
    }
}