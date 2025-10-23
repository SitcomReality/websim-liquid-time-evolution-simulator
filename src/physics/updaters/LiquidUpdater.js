import { PARTICLE_TYPES } from '../../utils/Constants.js';

export class LiquidUpdater {
    constructor(world) {
        this.world = world;
    }

    update(x, y) {
        const below = this.world.getParticle(x, y + 1);
        
        // Fall down
        if (below === PARTICLE_TYPES.EMPTY) {
            this.world.swapParticles(x, y, x, y + 1);
            this.world.setUpdated(x, y + 1);
            return;
        }
        
        // Only spread if not settled
        const leftBelow = this.world.getParticle(x - 1, y + 1);
        const rightBelow = this.world.getParticle(x + 1, y + 1);
        
        // if (leftBelow !== PARTICLE_TYPES.EMPTY && rightBelow !== PARTICLE_TYPES.EMPTY) {
        //     // Likely settled - skip horizontal spread to save CPU
        //     return;
        // }
        
        // Spread horizontally
        const dir = Math.random() > 0.5 ? 1 : -1;
        let side = this.world.getParticle(x + dir, y);
        if (side === PARTICLE_TYPES.EMPTY) {
            this.world.swapParticles(x, y, x + dir, y);
            this.world.setUpdated(x + dir, y);
            return;
        }
        side = this.world.getParticle(x - dir, y);
        if (side === PARTICLE_TYPES.EMPTY) {
            this.world.swapParticles(x, y, x - dir, y);
            this.world.setUpdated(x - dir, y);
            return;
        }
        
        // Try diagonal
        const diagBelow = this.world.getParticle(x + dir, y + 1);
        if (diagBelow === PARTICLE_TYPES.EMPTY) {
            this.world.swapParticles(x, y, x + dir, y + 1);
            this.world.setUpdated(x + dir, y + 1);
            return;
        }
        const diagBelow2 = this.world.getParticle(x - dir, y + 1);
        if (diagBelow2 === PARTICLE_TYPES.EMPTY) {
            this.world.swapParticles(x, y, x - dir, y + 1);
            this.world.setUpdated(x - dir, y + 1);
        }
    }
}