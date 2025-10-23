import { PARTICLE_TYPES } from '../../utils/Constants.js';

export class FallingSolidUpdater {
    constructor(world) {
        this.world = world;
        this.toppleHeightThreshold = 8; // height at which unsupported columns tend to topple
        this.toppleUnsupportedConsecutive = 6; // how many consecutive unsupported levels needed
    }

    update(x, y) {
        const below = this.world.getParticle(x, y + 1);

        if (below === PARTICLE_TYPES.EMPTY || below === PARTICLE_TYPES.WATER) {
            this.world.swapParticles(x, y, x, y + 1);
            this.world.setUpdated(x, y + 1);
            return;
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
                return;
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

        // New: Topple tall unsupported columns
        // Measure contiguous column height upwards from this cell
        let height = 0;
        for (let yy = y; yy >= 0 && this.world.getParticle(x, yy) !== PARTICLE_TYPES.EMPTY && height <= this.toppleHeightThreshold + 4; yy--) {
            height++;
        }

        if (height >= this.toppleHeightThreshold) {
            // Count consecutive unsupported levels (both neighbors empty) starting at this y and going up
            let unsupported = 0;
            for (let yy = y; yy > y - Math.min(height, this.toppleUnsupportedConsecutive + 4) && yy >= 0; yy--) {
                const left = this.world.getParticle(x - 1, yy);
                const right = this.world.getParticle(x + 1, yy);
                if ((left === PARTICLE_TYPES.EMPTY || left === undefined) && (right === PARTICLE_TYPES.EMPTY || right === undefined)) {
                    unsupported++;
                } else {
                    unsupported = 0; // reset when a supported level is found
                }
                if (unsupported >= this.toppleUnsupportedConsecutive) break;
            }

            if (unsupported >= this.toppleUnsupportedConsecutive) {
                // Higher columns topple more often; probability grows with height above threshold
                const excess = Math.min(height - this.toppleHeightThreshold, 10);
                const prob = 0.12 + (excess * 0.06); // base 12% + extra per excess
                if (Math.random() < prob) {
                    // Attempt to move this particle sideways (prefer downward if possible)
                    const tryDirs = [1, -1];
                    for (const sd of tryDirs) {
                        // Prefer moving down-diagonal if available
                        if (this.world.getParticle(x + sd, y + 1) === PARTICLE_TYPES.EMPTY) {
                            this.world.swapParticles(x, y, x + sd, y + 1);
                            this.world.setUpdated(x + sd, y + 1);
                            return;
                        } else if (this.world.getParticle(x + sd, y) === PARTICLE_TYPES.EMPTY) {
                            this.world.swapParticles(x, y, x + sd, y);
                            this.world.setUpdated(x + sd, y);
                            return;
                        }
                    }
                    // If sides blocked, nudge particle one step horizontally if possible
                    const sd = Math.random() > 0.5 ? 1 : -1;
                    if (this.world.getParticle(x + sd, y) === PARTICLE_TYPES.EMPTY) {
                        this.world.swapParticles(x, y, x + sd, y);
                        this.world.setUpdated(x + sd, y);
                    }
                }
            }
        }
    }
}