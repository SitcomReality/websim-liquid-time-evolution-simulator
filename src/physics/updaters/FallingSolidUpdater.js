import { PARTICLE_TYPES, PARTICLE_PROPERTIES } from '../../utils/Constants.js';

export class FallingSolidUpdater {
    constructor(world) {
        this.world = world;
    }

    update(x, y, timeScale = 1) {
        const particle = this.world.getParticle(x, y);
        const props = PARTICLE_PROPERTIES[particle];
        
        // Check for collapse if structure is too tall and unsupported
        if (Math.random() < 0.1) {
            const collapseHeight = this.checkColumnCollapse(x, y);
            if (collapseHeight > 0) {
                // Particle should topple
                const dir = this.findToppleDirection(x, y);
                if (dir !== 0) {
                    const nx = x + dir;
                    const target = this.world.getParticle(nx, y);
                    if (target === PARTICLE_TYPES.EMPTY || (props.density > PARTICLE_PROPERTIES[target]?.density)) {
                        this.world.swapParticles(x, y, nx, y);
                        this.world.setUpdated(nx, y);
                        return;
                    }
                }
            }
        }
        
        const below = this.world.getParticle(x, y + 1);
        const belowProps = PARTICLE_PROPERTIES[below];
        
        // Density-based sinking: heavier particles sink through lighter ones
        if (below !== PARTICLE_TYPES.EMPTY && belowProps && props.density > belowProps.density) {
            if (Math.random() < 0.3) {
                this.world.swapParticles(x, y, x, y + 1);
                this.world.setUpdated(x, y + 1);
                return;
            }
        }

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
        
        // Viscous flow: at geological timescales, even solids flow
        // Higher time scales = more fluid behavior
        const viscosity = 1.0 / (props.density || 1.0); // Inverse density as viscosity proxy
        const flowRate = Math.min(0.4, viscosity * timeScale / 100);
        if (Math.random() < flowRate) {
            const dir = Math.random() > 0.5 ? 1 : -1;
            const side = this.world.getParticle(x + dir, y);
            if (side === PARTICLE_TYPES.EMPTY || (props.density > PARTICLE_PROPERTIES[side]?.density && Math.random() < 0.5)) {
                this.world.swapParticles(x, y, x + dir, y);
                this.world.setUpdated(x + dir, y);
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
                if (Math.random() < Math.min(0.6, diff)) { 
                    this.world.swapParticles(x, y, x + windDir, y); 
                    this.world.setUpdated(x + windDir, y); 
                }
            }
        }
    }
    
    checkColumnCollapse(x, y) {
        // Check if this particle is part of a tall unsupported column
        // Returns height if should collapse, 0 otherwise
        const maxStableHeight = 8; // Columns taller than this become unstable
        
        // Count height above
        let height = 0;
        for (let dy = 0; dy >= -maxStableHeight && (y + dy) >= 0; dy--) {
            const p = this.world.getParticle(x, y + dy);
            if (p === PARTICLE_TYPES.EMPTY || p === PARTICLE_TYPES.WATER || p === PARTICLE_TYPES.STEAM) break;
            height++;
        }
        
        if (height < 5) return 0; // Too short to worry about
        
        // Check for adjacent support at this level or below
        let supportCount = 0;
        for (let dy = 0; dy <= 2; dy++) {
            const left = this.world.getParticle(x - 1, y + dy);
            const right = this.world.getParticle(x + 1, y + dy);
            if (left !== PARTICLE_TYPES.EMPTY && left !== PARTICLE_TYPES.WATER && left !== PARTICLE_TYPES.STEAM) supportCount++;
            if (right !== PARTICLE_TYPES.EMPTY && right !== PARTICLE_TYPES.WATER && right !== PARTICLE_TYPES.STEAM) supportCount++;
        }
        
        // If tall and poorly supported, should collapse
        if (height > maxStableHeight || (height > 6 && supportCount < 2)) {
            return height;
        }
        
        return 0;
    }
    
    findToppleDirection(x, y) {
        // Determine which direction the particle should topple
        const left = this.world.getParticle(x - 1, y);
        const right = this.world.getParticle(x + 1, y);
        const leftBelow = this.world.getParticle(x - 1, y + 1);
        const rightBelow = this.world.getParticle(x + 1, y + 1);
        
        // Prefer falling toward emptier space
        const leftScore = (left === PARTICLE_TYPES.EMPTY ? 2 : 0) + (leftBelow === PARTICLE_TYPES.EMPTY ? 1 : 0);
        const rightScore = (right === PARTICLE_TYPES.EMPTY ? 2 : 0) + (rightBelow === PARTICLE_TYPES.EMPTY ? 1 : 0);
        
        if (leftScore > rightScore) return -1;
        if (rightScore > leftScore) return 1;
        return Math.random() > 0.5 ? 1 : -1;
    }
}