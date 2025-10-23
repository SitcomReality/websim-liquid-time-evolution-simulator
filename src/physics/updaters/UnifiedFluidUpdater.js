import { PARTICLE_TYPES, PARTICLE_PROPERTIES } from '../../utils/Constants.js';

export class UnifiedFluidUpdater {
    constructor(world) {
        this.world = world;
    }

    update(x, y, timeScale = 1, fidelity = 1) {
        const particle = this.world.getParticle(x, y);

        // Skip empty and living particles
        if (particle === PARTICLE_TYPES.EMPTY) return;
        if (PARTICLE_PROPERTIES[particle]?.isLiving) return;

        const props = PARTICLE_PROPERTIES[particle];
        if (!props) return;

        // 1. Gravity/Density-based vertical movement
        if (!this.applyGravity(x, y, particle, props)) {
            // Only apply horizontal flow if vertical movement didn't happen
            if (Math.random() < props.flowRate * fidelity) {
                // 2. Pressure-gradient driven flow (becomes more active at higher time scales)
                this.applyFlowFromPressure(x, y, particle, props, timeScale);
        
                // 3. Viscous spreading at geological timescales
                if (Math.random() < props.flowRate * 0.1 * timeScale * fidelity) {
                    this.applyViscousFlow(x, y, particle, props, timeScale);
                }

                // 4. Low-viscosity fluid flattening
                if (props.viscosity < 0.1) {
                    this.flattenFluid(x, y, particle, props);
                }
            }
        }
    }

    applyGravity(x, y, particle, props) {
        const below = this.world.getParticle(x, y + 1);

        if (below === PARTICLE_TYPES.EMPTY) {
            // Structural integrity check for solid particles, allowing for caves.
            if (props.viscosity > 10.0) {
                // Calculate support from neighbors. More support = less chance to fall.
                // Support is weighted: 2 for horizontal, 1 for above/diagonal-up. Max support = 7.
                let support = 0;
                // Strong support from horizontal neighbors
                if (PARTICLE_PROPERTIES[this.world.getParticle(x - 1, y)]?.viscosity >= props.viscosity) support += 2;
                if (PARTICLE_PROPERTIES[this.world.getParticle(x + 1, y)]?.viscosity >= props.viscosity) support += 2;
                // Support from above (arch effect)
                if (PARTICLE_PROPERTIES[this.world.getParticle(x, y - 1)]?.viscosity >= props.viscosity) support += 1;
                // Support from diagonal-up
                if (PARTICLE_PROPERTIES[this.world.getParticle(x - 1, y - 1)]?.viscosity >= props.viscosity) support += 1;
                if (PARTICLE_PROPERTIES[this.world.getParticle(x + 1, y - 1)]?.viscosity >= props.viscosity) support += 1;
                
                // Exponential resistance calculation based on support.
                // If support is 0, fall chance is high (~0.999). If support is 7, fall chance is tiny (~0.0001).
                // R determines the exponential decay of fall chance; higher viscosity increases R.
                const R_viscosity = Math.log2(Math.max(10.01, props.viscosity) / 10.0);
                const R = 3.0 + R_viscosity; 
                
                const P_base = 0.999;
                // fallChance decreases exponentially as support increases.
                const fallChance = P_base * Math.pow(R, -support);

                if (Math.random() > fallChance) {
                    return false; // Stay put due to structural integrity
                }
            }
            
            // Free fall
            this.world.swapParticles(x, y, x, y + 1);
            this.world.setUpdated(x, y + 1);
            return true;
        }

        const belowProps = PARTICLE_PROPERTIES[below];

        // Sinking: denser particles displace lighter ones
        if (belowProps && props.density > belowProps.density) {
            // Structural integrity check for dense particles
            if (props.viscosity > 1.0) { // Check for solids
                const left = this.world.getParticle(x - 1, y);
                const right = this.world.getParticle(x + 1, y);
                const leftProps = PARTICLE_PROPERTIES[left];
                const rightProps = PARTICLE_PROPERTIES[right];
                
                let support = 0;
                if (leftProps && leftProps.viscosity >= props.viscosity) support++;
                if (rightProps && rightProps.viscosity >= props.viscosity) support++;
                
                if (support > 0 && Math.random() < 0.99) {
                     // High chance to stay put if supported
                    if (support === 2 && Math.random() < 0.999) return false;
                    return false;
                }
            }

            // The chance to push through is penalized by the current particle's viscosity
            const moveChance = 1.0 / (1.0 + props.viscosity * 10);
            if (Math.random() < moveChance) {
                this.world.swapParticles(x, y, x, y + 1);
                this.world.setUpdated(x, y + 1);
                return true;
            }
        }

        // Settle diagonally if blocked, more likely for less viscous particles
        const viscosityFactor = 1.0 - Math.min(0.95, props.viscosity / 20.0);
        if (Math.random() < viscosityFactor) {
            const dir = Math.random() > 0.5 ? 1 : -1;
            for (const d of [dir, -dir]) {
                const diagBelow = this.world.getParticle(x + d, y + 1);
                if (diagBelow === PARTICLE_TYPES.EMPTY || (PARTICLE_PROPERTIES[diagBelow]?.density ?? Infinity) < props.density) {
                    this.world.swapParticles(x, y, x + d, y + 1);
                    this.world.setUpdated(x + d, y + 1);
                    return true;
                }
            }
        }
        return false;
    }

    applyFlowFromPressure(x, y, particle, props, timeScale) {
        const pl = this.world.getPressure(x - 1, y);
        const pr = this.world.getPressure(x + 1, y);
        const pressureDiff = Math.abs(pl - pr);

        if (pressureDiff < 0.05) return;

        const windDir = pl > pr ? 1 : -1;
        const target = this.world.getParticle(x + windDir, y);
        const targetProps = PARTICLE_PROPERTIES[target];

        // Flow toward lower pressure if target is lighter or empty
        if (target === PARTICLE_TYPES.EMPTY || (targetProps && props.density >= targetProps.density)) {
            const flowChance = Math.min(0.9, props.flowRate * pressureDiff * 0.5);
            if (Math.random() < flowChance) {
                this.world.swapParticles(x, y, x + windDir, y);
                this.world.setUpdated(x + windDir, y);
            }
        }
    }

    applyViscousFlow(x, y, particle, props, timeScale) {
        // At high time scales, even viscous materials flow
        // Viscosity inverse-affects flow probability
        const viscosityFactor = 1.0 / (1.0 + props.viscosity);
        const flowChance = viscosityFactor * props.flowRate * 0.05;

        if (Math.random() < flowChance) {
            const dir = Math.random() > 0.5 ? 1 : -1;
            const side = this.world.getParticle(x + dir, y);
            const sideProps = PARTICLE_PROPERTIES[side];

            // Only flow into empty space or less dense materials
            if (side === PARTICLE_TYPES.EMPTY || (sideProps && props.density > sideProps.density)) {
                this.world.swapParticles(x, y, x + dir, y);
                this.world.setUpdated(x + dir, y);
            }
        }
    }

    flattenFluid(x, y, particle, props) {
        // Specifically for low-viscosity fluids to spread out horizontally.
        // This is applied when vertical/diagonal movement is blocked (particle is supported).
        const dir = Math.random() > 0.5 ? 1 : -1;
        
        for (const d of [dir, -dir]) {
            const nx = x + d;
            const side = this.world.getParticle(nx, y);
            
            // Allow flow into adjacent empty space to level out the surface, 
            // regardless of what lies below (which gravity checks handle later).
            if (side === PARTICLE_TYPES.EMPTY) {
                if (Math.random() < 0.95) { // Very high chance to spread horizontally for low viscosity fluids
                    this.world.swapParticles(x, y, nx, y);
                    this.world.setUpdated(nx, y);
                    return; // Return after one move
                }
            }
        }
    }
}