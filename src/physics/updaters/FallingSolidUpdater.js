import { PARTICLE_TYPES } from '../../utils/Constants.js';

export class FallingSolidUpdater {
    constructor(world) {
        this.world = world;
    }

    update(x, y) {
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
        // Wind/pressure-driven tumble to topple columns
        const pl = this.world.getPressure(x - 1, y), pr = this.world.getPressure(x + 1, y);
        const windDir = (pl > pr) ? 1 : (pl < pr) ? -1 : 0;
        if (windDir) {
            const side = this.world.getParticle(x + windDir, y);
            const sideBelow = this.world.getParticle(x + windDir, y + 1);
            const diff = Math.abs(pl - pr);
            if (side === PARTICLE_TYPES.EMPTY && (sideBelow === PARTICLE_TYPES.EMPTY || Math.random() < diff)) {
                if (Math.random() < Math.min(0.6, diff)) { this.world.swapParticles(x, y, x + windDir, y); this.world.setUpdated(x + windDir, y); }
            }
        }
    }
}