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
        this.applyGravity(x, y, particle, props);

        // 2. Pressure-gradient driven flow (becomes more active at higher time scales)
        if (Math.random() < props.flowRate * fidelity) {
            this.applyFlowFromPressure(x, y, particle, props, timeScale);
        }

        // 3. Viscous spreading at geological timescales
        if (Math.random() < props.flowRate * 0.1 * timeScale * fidelity) {
            this.applyViscousFlow(x, y, particle, props, timeScale);
        }
    }

    applyGravity(x, y, particle, props) {
        const below = this.world.getParticle(x, y + 1);

        if (below === PARTICLE_TYPES.EMPTY) {
            // Free fall
            this.world.swapParticles(x, y, x, y + 1);
            this.world.setUpdated(x, y + 1);
            return;
        }

        const belowProps = PARTICLE_PROPERTIES[below];

        // Sinking: denser particles displace lighter ones
        if (belowProps && props.density > belowProps.density) {
            if (Math.random() < Math.min(0.8, (props.density - belowProps.density) * 0.3)) {
                this.world.swapParticles(x, y, x, y + 1);
                this.world.setUpdated(x, y + 1);
                return;
            }
        }

        // Floating: lighter particles rise through heavier ones
        if (belowProps && props.density < belowProps.density) {
            const above = this.world.getParticle(x, y - 1);
            const aboveProps = PARTICLE_PROPERTIES[above];
            if ((above === PARTICLE_TYPES.EMPTY || aboveProps?.density > props.density) && Math.random() < 0.15) {
                this.world.swapParticles(x, y, x, y - 1);
                this.world.setUpdated(x, y - 1);
                return;
            }
        }

        // Settle diagonally if blocked
        const dir = Math.random() > 0.5 ? 1 : -1;
        for (const d of [dir, -dir]) {
            const diagBelow = this.world.getParticle(x + d, y + 1);
            if (diagBelow === PARTICLE_TYPES.EMPTY || (PARTICLE_PROPERTIES[diagBelow]?.density ?? 0) < props.density) {
                this.world.swapParticles(x, y, x + d, y + 1);
                this.world.setUpdated(x + d, y + 1);
                return;
            }
        }
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
}