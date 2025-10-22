import { PARTICLE_TYPES, PARTICLE_PROPERTIES } from '../utils/Constants.js';

export class ParticleUpdater {
    constructor(world) {
        this.world = world;
    }
    
    update() {
        this.world.clearUpdated();
        
        // Update from bottom to top for falling particles
        for (let y = this.world.height - 2; y >= 0; y--) {
            // Randomize x direction each frame
            const dir = Math.random() > 0.5 ? 1 : -1;
            const startX = dir > 0 ? 0 : this.world.width - 1;
            const endX = dir > 0 ? this.world.width : -1;
            
            for (let x = startX; x !== endX; x += dir) {
                if (this.world.isUpdated(x, y)) continue;
                
                const particle = this.world.getParticle(x, y);
                if (particle === PARTICLE_TYPES.EMPTY) continue;
                
                this.updateParticle(x, y, particle);
            }
        }
    }
    
    updateParticle(x, y, type) {
        switch(type) {
            case PARTICLE_TYPES.SAND:
                this.updateFallingSolid(x, y);
                break;
            case PARTICLE_TYPES.WATER:
                this.updateLiquid(x, y);
                break;
            case PARTICLE_TYPES.LAVA:
                this.updateLava(x, y);
                break;
            case PARTICLE_TYPES.STEAM:
                this.updateSteam(x, y);
                break;
            case PARTICLE_TYPES.SOIL:
                this.updateSoil(x, y);
                break;
        }
    }
    
    updateFallingSolid(x, y) {
        const below = this.world.getParticle(x, y + 1);
        
        if (below === PARTICLE_TYPES.EMPTY || below === PARTICLE_TYPES.WATER) {
            this.world.swapParticles(x, y, x, y + 1);
            this.world.setUpdated(x, y + 1);
        } else {
            // Try diagonal movement
            const dir = Math.random() > 0.5 ? 1 : -1;
            const diagBelow = this.world.getParticle(x + dir, y + 1);
            if (diagBelow === PARTICLE_TYPES.EMPTY || diagBelow === PARTICLE_TYPES.WATER) {
                this.world.swapParticles(x, y, x + dir, y + 1);
                this.world.setUpdated(x + dir, y + 1);
            }
        }
    }
    
    updateLiquid(x, y) {
        const below = this.world.getParticle(x, y + 1);
        
        // Fall down
        if (below === PARTICLE_TYPES.EMPTY) {
            this.world.swapParticles(x, y, x, y + 1);
            this.world.setUpdated(x, y + 1);
            return;
        }
        
        // Spread horizontally
        const dir = Math.random() > 0.5 ? 1 : -1;
        const side = this.world.getParticle(x + dir, y);
        if (side === PARTICLE_TYPES.EMPTY) {
            this.world.swapParticles(x, y, x + dir, y);
            this.world.setUpdated(x + dir, y);
            return;
        }
        
        // Try diagonal
        const diagBelow = this.world.getParticle(x + dir, y + 1);
        if (diagBelow === PARTICLE_TYPES.EMPTY) {
            this.world.swapParticles(x, y, x + dir, y + 1);
            this.world.setUpdated(x + dir, y + 1);
        }
    }
    
    updateLava(x, y) {
        // Lava behaves like liquid but can melt things
        this.updateLiquid(x, y);
        
        // Convert adjacent ice to water
        for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
                if (dx === 0 && dy === 0) continue;
                const nx = x + dx;
                const ny = y + dy;
                if (this.world.getParticle(nx, ny) === PARTICLE_TYPES.ICE) {
                    this.world.setParticle(nx, ny, PARTICLE_TYPES.WATER);
                }
            }
        }
    }
    
    updateSteam(x, y) {
        // Rise up
        const above = this.world.getParticle(x, y - 1);
        if (above === PARTICLE_TYPES.EMPTY) {
            this.world.swapParticles(x, y, x, y - 1);
            this.world.setUpdated(x, y - 1);
            return;
        }
        
        // Spread horizontally
        const dir = Math.random() > 0.5 ? 1 : -1;
        const side = this.world.getParticle(x + dir, y);
        if (side === PARTICLE_TYPES.EMPTY) {
            this.world.swapParticles(x, y, x + dir, y);
            this.world.setUpdated(x + dir, y);
        }
        
        // Chance to condense back to water
        if (Math.random() < 0.001) {
            this.world.setParticle(x, y, PARTICLE_TYPES.WATER);
        }
    }
    
    updateSoil(x, y) {
        // Soil can slowly fall if unsupported
        const below = this.world.getParticle(x, y + 1);
        if (below === PARTICLE_TYPES.EMPTY || below === PARTICLE_TYPES.WATER) {
            if (Math.random() < 0.1) {
                this.world.swapParticles(x, y, x, y + 1);
                this.world.setUpdated(x, y + 1);
            }
        }
    }
}

