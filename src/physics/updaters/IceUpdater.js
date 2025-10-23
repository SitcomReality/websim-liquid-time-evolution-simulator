import { PARTICLE_TYPES, PARTICLE_PROPERTIES } from '../../utils/Constants.js';

export class IceUpdater {
    constructor(world) {
        this.world = world;
    }

    update(x, y) {
        const below = this.world.getParticle(x, y + 1);
        
        // Fall through air
        if (below === PARTICLE_TYPES.EMPTY) {
            this.world.swapParticles(x, y, x, y + 1);
            this.world.setUpdated(x, y + 1);
            return;
        }
        
        // Float on water and drift with it
        if (below === PARTICLE_TYPES.WATER) {
            const above = this.world.getParticle(x, y - 1);
            if (above === PARTICLE_TYPES.EMPTY || above === PARTICLE_TYPES.WATER) {
                this.world.swapParticles(x, y, x, y - 1);
                this.world.setUpdated(x, y - 1);
                return;
            }
            
            // Drift horizontally on water surface
            if (Math.random() < 0.4) {
                const dir = Math.random() > 0.5 ? 1 : -1;
                const side = this.world.getParticle(x + dir, y);
                const sideBelow = this.world.getParticle(x + dir, y + 1);
                
                if (side === PARTICLE_TYPES.EMPTY && sideBelow === PARTICLE_TYPES.WATER) {
                    this.world.swapParticles(x, y, x + dir, y);
                    this.world.setUpdated(x + dir, y);
                    return;
                }
            }
        }
        
        // Apply pressure-driven drift even on solid surfaces
        const pl = this.world.getPressure(x - 1, y);
        const pr = this.world.getPressure(x + 1, y);
        if (Math.abs(pl - pr) > 0.15 && Math.random() < 0.2) {
            const windDir = pl > pr ? 1 : -1;
            const side = this.world.getParticle(x + windDir, y);
            if (side === PARTICLE_TYPES.EMPTY || side === PARTICLE_TYPES.WATER) {
                this.world.swapParticles(x, y, x + windDir, y);
                this.world.setUpdated(x + windDir, y);
            }
        }
        
        // Melting handled by ThermalUpdater.
    }
}