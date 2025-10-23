import { PARTICLE_TYPES, PARTICLE_PROPERTIES } from '../../utils/Constants.js';

export class IceUpdater {
    constructor(world) {
        this.world = world;
    }

    update(x, y) {
        const props = PARTICLE_PROPERTIES[PARTICLE_TYPES.ICE];
        const below = this.world.getParticle(x, y + 1);
        
        // Fall through air and low-density particles
        if (below === PARTICLE_TYPES.EMPTY || below === PARTICLE_TYPES.STEAM || below === PARTICLE_TYPES.CLOUD) {
            this.world.swapParticles(x, y, x, y + 1);
            this.world.setUpdated(x, y + 1);
            return;
        }
        
        const belowProps = PARTICLE_PROPERTIES[below];
        
        // Sink through lighter particles
        if (belowProps && props.density > belowProps.density && Math.random() < 0.3) {
            this.world.swapParticles(x, y, x, y + 1);
            this.world.setUpdated(x, y + 1);
            return;
        }
        
        // Float on water
        if (below === PARTICLE_TYPES.WATER) {
            const above = this.world.getParticle(x, y - 1);
            const aboveProps = PARTICLE_PROPERTIES[above];
            if ((above === PARTICLE_TYPES.EMPTY || (aboveProps && props.density < aboveProps.density)) && Math.random() < 0.2) {
                this.world.swapParticles(x, y, x, y - 1);
                this.world.setUpdated(x, y - 1);
                return;
            }
            
            // Drift horizontally on water with pressure
            if (Math.random() < 0.3) {
                const pl = this.world.getPressure(x - 1, y);
                const pr = this.world.getPressure(x + 1, y);
                const windDir = (pl > pr) ? 1 : (pl < pr) ? -1 : (Math.random() > 0.5 ? 1 : -1);
                const side = this.world.getParticle(x + windDir, y);
                const sideBelow = this.world.getParticle(x + windDir, y + 1);
                
                if ((side === PARTICLE_TYPES.EMPTY || (PARTICLE_PROPERTIES[side]?.density ?? 0) < props.density) && 
                    (sideBelow === PARTICLE_TYPES.WATER || sideBelow === PARTICLE_TYPES.EMPTY)) {
                    this.world.swapParticles(x, y, x + windDir, y);
                    this.world.setUpdated(x + windDir, y);
                }
            }
        }
    }
}