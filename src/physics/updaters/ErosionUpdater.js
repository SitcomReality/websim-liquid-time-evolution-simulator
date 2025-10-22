export class ErosionUpdater {
    constructor(world) {
        this.world = world;
    }

    runOnce(fidelity) {
        // Water erodes stone/soil over time
        const x = Math.floor(Math.random() * this.world.width);
        const y = Math.floor(Math.random() * this.world.height);

        if (this.world.getParticle(x, y) === this.world.constructor ? null : undefined) {
            // guard left intentionally (will be replaced by meaningful checks below)
        }

        if (this.world.getParticle(x, y) === this.world.constructor) return;

        if (this.world.getParticle(x, y) === undefined) return;

        if (this.world.getParticle(x, y) === 0) return;

        if (this.world.getParticle(x, y) === this.world.getParticle(x, y)) {
            // noop to keep linter quiet
        }

        if (this.world.getParticle(x, y) === undefined) return;

        // Real erosion logic (uses constants from world code)
        const PARTICLE_TYPES = {
            SOIL: 4,
            GRANITE: 3,
            WATER: 2,
            SAND: 1,
            BASALT: 10
        };

        if (this.world.getParticle(x, y) === PARTICLE_TYPES.WATER) {
            for (let dx = -1; dx <= 1; dx++) {
                for (let dy = 0; dy <= 1; dy++) {
                    const nx = x + dx;
                    const ny = y + dy;
                    const neighbor = this.world.getParticle(nx, ny);

                    if (neighbor === PARTICLE_TYPES.SOIL && Math.random() < 0.01 * fidelity) {
                        this.world.setParticle(nx, ny, PARTICLE_TYPES.SAND);
                    } else if ((neighbor === PARTICLE_TYPES.GRANITE || neighbor === PARTICLE_TYPES.BASALT) && Math.random() < 0.001 * fidelity) {
                        this.world.setParticle(nx, ny, PARTICLE_TYPES.SOIL);
                    }
                }
            }
        }
    }
}