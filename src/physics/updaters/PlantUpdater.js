import { PARTICLE_TYPES } from '../../utils/Constants.js';
import { classifyEnvironment, maybeBloom } from '../../biology/PlantEcology.js';

export class PlantUpdater {
    constructor(world) {
        this.world = world;
    }

    update(x, y, deltaTime) {
        const idx = this.world.getIndex(x, y) * 4;
        let energy = this.world.particleData[idx];
        let type = this.world.particleData[idx + 1];
        let age = this.world.particleData[idx + 2];

        // If plant has only void beneath it, make it fall as dirt or seed
        const below = this.world.getParticle(x, y + 1);
        if (below === PARTICLE_TYPES.EMPTY) {
            // Fall down: either become a seed or soil when falling
            if (Math.random() < 0.5) {
                // place a seed below
                this.world.setParticle(x, y + 1, PARTICLE_TYPES.PLANT, [0, 0, 0, 0]);
            } else {
                // become soil (dirt) and drop down
                this.world.setParticle(x, y + 1, PARTICLE_TYPES.SOIL);
            }
            // remove current plant pixel
            this.world.setParticle(x, y, PARTICLE_TYPES.EMPTY);
            this.world.setUpdated(x, y + 1);
            return;
        }

        // Scale growth by actual simulation time
        const timeFactor = deltaTime / 16;
        age += timeFactor;
        this.world.particleData[idx + 2] = age;
        // Assign/refresh color occasionally based on environment (flowers can appear)
        if (Math.random() < 0.02 * timeFactor) {
            const env = classifyEnvironment(this.world, x, y);
            this.world.particleData[idx + 3] = maybeBloom(this.world.particleData[idx + 3] || env.colorCode, env.fertile);
        }

        // Photosynthesis
        if (this.world.getParticle(x, y - 1) === PARTICLE_TYPES.EMPTY) {
            energy += 0.5 * timeFactor; // Faster energy gain
        }

        // Water absorption from nearby
        for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
                if (this.world.getParticle(x + dx, y + dy) === PARTICLE_TYPES.WATER) {
                    energy += 0.2 * timeFactor;
                    if (Math.random() < 0.02 * timeFactor) {
                        this.world.setParticle(x + dx, y + dy, PARTICLE_TYPES.EMPTY);
                    }
                    break;
                }
            }
        }

        if (type === 0) { // Seed
            if (energy > 3) {
                this.world.particleData[idx + 1] = 1;
                energy = 0;
                if (this.world.getParticle(x, y - 1) === PARTICLE_TYPES.EMPTY) {
                    const env = classifyEnvironment(this.world, x, y - 1);
                    this.world.setParticle(x, y - 1, PARTICLE_TYPES.PLANT, [0, 1, 0, env.colorCode]);
                }
            }
        } else if (type === 1) { // Stem
            // Enforce a maximum column height of 4 pixels. If at max, produce seeds instead.
            // Count continuous plant pixels downward to find column height to "ground"
            let height = 0;
            for (let dy = 0; dy < 50; dy++) {
                const ny = y + dy;
                if (ny >= this.world.height) break;
                if (this.world.getParticle(x, ny) === PARTICLE_TYPES.PLANT) height++;
                else break;
            }

            if (energy > 5) {
                if (height >= 4) {
                    // produce seeds in nearby soil rather than grow taller
                    for (let dx = -3; dx <= 3; dx++) {
                        const nx = x + dx;
                        if (nx < 0 || nx >= this.world.width) continue;
                        for (let sy = 1; sy <= 4; sy++) {
                            const ny = y + sy;
                            if (ny >= this.world.height) break;
                            if (this.world.getParticle(nx, ny) === PARTICLE_TYPES.SOIL && Math.random() < 0.25) {
                                const env = classifyEnvironment(this.world, nx, ny);
                                this.world.setParticle(nx, ny, PARTICLE_TYPES.PLANT, [0, 0, 0, env.colorCode]); // seed
                                this.world.setUpdated(nx, ny);
                                break;
                            }
                        }
                    }
                    energy = 0;
                } else {
                    // Grow upwards as normal
                    if (this.world.getParticle(x, y - 1) === PARTICLE_TYPES.EMPTY) {
                        this.world.setParticle(x, y - 1, PARTICLE_TYPES.PLANT, [0, 1, 0, 0]);
                        energy = 0;
                        this.world.setUpdated(x, y - 1);
                    }
                }
            }

            // Spread seeds
            if (age > 200 && Math.random() < 0.001 * timeFactor) {
                for (let dx = -10; dx <= 10; dx++) {
                    const nx = x + dx;
                    const ny = y + Math.floor(Math.random() * 5);
                    const env = classifyEnvironment(this.world, nx, ny);
                    if (this.world.getParticle(nx, ny) !== PARTICLE_TYPES.BEDROCK && this.world.inBounds(nx, ny)) {
                        this.world.setParticle(nx, ny, PARTICLE_TYPES.PLANT, [0, 0, 0, env.colorCode]);
                    }
                }
            }
        }

        // Death
        if (age > 500 || (this.world.getParticle(x, y - 1) !== PARTICLE_TYPES.EMPTY && this.world.getParticle(x,y-1) !== PARTICLE_TYPES.PLANT)) {
            this.world.setParticle(x, y, PARTICLE_TYPES.SOIL);
            return;
        }
        // Variant-specific micro-growth: allow colonization on many substrates
        if (Math.random() < 0.002 * timeFactor) {
            const env = classifyEnvironment(this.world, x, y);
            // cactus: small, 3-5 px height
            if (env.variant === 3) {
                const h = 3 + Math.floor(Math.random() * 3);
                for (let dy = 1; dy <= h; dy++) {
                    if (this.world.getParticle(x, y - dy) === PARTICLE_TYPES.EMPTY)
                        this.world.setParticle(x, y - dy, PARTICLE_TYPES.PLANT, [0, 1, 0, env.colorCode]);
                }
            } else if (env.variant === 1 || env.variant === 4) {
                // moss/lichen: spread sideways on rock
                const dir = Math.random() < 0.5 ? -1 : 1;
                if (this.world.getParticle(x + dir, y) !== PARTICLE_TYPES.BEDROCK)
                    this.world.setParticle(x + dir, y, PARTICLE_TYPES.PLANT, [0, 1, 0, env.colorCode]);
            } else if (env.variant === 2 || env.variant === 5) {
                // seaweed/coral: grow upward underwater
                if (this.world.getParticle(x, y - 1) === PARTICLE_TYPES.WATER || this.world.getParticle(x, y) === PARTICLE_TYPES.WATER)
                    this.world.setParticle(x, y - 1, PARTICLE_TYPES.PLANT, [0, 1, 0, env.colorCode]);
            }
        }

        this.world.particleData[idx] = energy;
    }
}