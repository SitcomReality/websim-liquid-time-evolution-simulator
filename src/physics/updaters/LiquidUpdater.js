import { PARTICLE_TYPES, PARTICLE_PROPERTIES } from '../../utils/Constants.js';

export class LiquidUpdater {
    constructor(world) {
        this.world = world;
    }

    update(x, y) {
        const particle = this.world.getParticle(x, y);
        const props = PARTICLE_PROPERTIES[particle];
        const below = this.world.getParticle(x, y + 1);
        const belowProps = PARTICLE_PROPERTIES[below];
        
        // Density-based rising: lighter particles rise through heavier ones
        if (below !== PARTICLE_TYPES.EMPTY && belowProps && props.density < belowProps.density) {
            if (Math.random() < 0.2) {
                // Try to rise
                const above = this.world.getParticle(x, y - 1);
                const aboveProps = PARTICLE_PROPERTIES[above];
                if (above === PARTICLE_TYPES.EMPTY || (aboveProps && props.density < aboveProps.density)) {
                    this.world.swapParticles(x, y, x, y - 1);
                    this.world.setUpdated(x, y - 1);
                    return;
                }
            }
        }
        
        // Wind-driven lateral drift (pressure pushes toward lower pressure)
        const pl = this.world.getPressure(x - 1, y), pr = this.world.getPressure(x + 1, y);
        const windDir = (pl > pr) ? 1 : (pl < pr) ? -1 : 0;
        if (windDir && this.world.getParticle(x + windDir, y) === PARTICLE_TYPES.EMPTY && Math.random() < Math.min(0.5, Math.abs(pl - pr))) {
            this.world.swapParticles(x, y, x + windDir, y); 
            this.world.setUpdated(x + windDir, y); 
            return;
        }
        
        // Fall down
        if (below === PARTICLE_TYPES.EMPTY) {
            this.world.swapParticles(x, y, x, y + 1);
            this.world.setUpdated(x, y + 1);
            return;
        }
        
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