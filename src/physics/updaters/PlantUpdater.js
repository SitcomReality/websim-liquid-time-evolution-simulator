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
        const currentParticle = this.world.getParticle(x, y);
        const above = this.world.getParticle(x, y - 1);
        
        const isWaterSurface = (below === PARTICLE_TYPES.WATER && above === PARTICLE_TYPES.EMPTY);
        const isSubmerged = (below === PARTICLE_TYPES.WATER || this.world.getParticle(x - 1, y) === PARTICLE_TYPES.WATER || this.world.getParticle(x + 1, y) === PARTICLE_TYPES.WATER);

        // --- RULE 1: Death at water surface or above steam/lava ---
        // Prevents floating forests and plants over boiling liquid
        const isOverHazard = below === PARTICLE_TYPES.STEAM || below === PARTICLE_TYPES.LAVA;
        if (isWaterSurface || isOverHazard) {
             // Immediate death into water, soil or empty space
             if (Math.random() < 0.3) {
                 this.world.setParticle(x, y, PARTICLE_TYPES.WATER);
             } else if (Math.random() < 0.5) {
                 this.world.setParticle(x, y, PARTICLE_TYPES.SOIL);
             } else {
                 this.world.setParticle(x, y, PARTICLE_TYPES.EMPTY);
             }
             return;
        }

        // If plant is in water: seeds should sink toward substrate
        if (isSubmerged) {
            // read seed/stem type stored in data (0 = seed, 1 = stem)
            const seedType = this.world.particleData[idx + 1] || 0;
            if (seedType === 0) {
                // Seed: sink downward toward substrate while underwater; age/dissolve if stuck too long
                // We rely on the seed being denser than water (density 1.1)
                if (this.world.getParticle(x, y + 1) === PARTICLE_TYPES.WATER || this.world.getParticle(x, y + 1) === PARTICLE_TYPES.EMPTY) {
                    // move seed downward (sink)
                    this.world.swapParticles(x, y, x, y + 1);
                    this.world.setUpdated(x, y + 1);
                    // gently age while sinking to eventually dissolve if never finding substrate
                    if (Math.random() < 0.002) this.world.particleData[idx] += 0.5; // slower aging while sinking
                } else {
                    // If seed has been underwater too long without finding substrate, dissolve
                    if ((this.world.particleData[idx] || 0) > 2400) { // longer lifetime underwater
                        this.world.setParticle(x, y, PARTICLE_TYPES.EMPTY);
                        return;
                    }
                }
                return;
            } else {
                // Stem / established plant: seek substrate below to anchor underwater
                const maxSearch = 12;
                let attached = false;
                for (let d = 1; d <= maxSearch; d++) {
                    const ny = y + d;
                    if (ny >= this.world.height - 1) break;
                    const belowCheck = this.world.getParticle(x, ny + 1);
                    const candidate = this.world.getParticle(x, ny);
                    if (belowCheck === PARTICLE_TYPES.SOIL || belowCheck === PARTICLE_TYPES.SAND || belowCheck === PARTICLE_TYPES.GRANITE || belowCheck === PARTICLE_TYPES.BASALT) {
                        // place plant directly above substrate if space available
                        const targetY = ny;
                        if (this.world.getParticle(x, targetY) === PARTICLE_TYPES.WATER || this.world.getParticle(x, targetY) === PARTICLE_TYPES.EMPTY) {
                            this.world.setParticle(x, targetY, PARTICLE_TYPES.PLANT, [0, 1, 0, this.world.particleData[idx + 3] || 0]);
                            this.world.setParticle(x, y, PARTICLE_TYPES.WATER);
                            this.world.setUpdated(x, targetY);
                            attached = true;
                        }
                        break;
                    }
                    // continue searching down through water
                }
                if (!attached) {
                    // No substrate found nearby: degrade to seed (float) with some chance, or slowly die
                    if (Math.random() < 0.04) { // reduced chance to convert to seed
                        this.world.particleData[idx + 1] = 0; // become seed
                        // slightly cool/damage to indicate weakening
                        this.world.particleData[idx] = (this.world.particleData[idx] || 0) + 40;
                    } else if ((this.world.particleData[idx + 2] || 0) > 1600) { // need to be much older before dying to soil
                        // old plant without attachment dies into soil
                        this.world.setParticle(x, y, PARTICLE_TYPES.SOIL);
                    }
                }
                return;
            }
        }

        // Allow plants to persist on edges: only fall if fully unsupported (air both below AND below-diagonals)
        if (below === PARTICLE_TYPES.EMPTY &&
            this.world.getParticle(x - 1, y + 1) === PARTICLE_TYPES.EMPTY &&
            this.world.getParticle(x + 1, y + 1) === PARTICLE_TYPES.EMPTY) {
            // Prefer turning into seed if high above ground, otherwise settle as soil to avoid spamming void
            if (Math.random() < 0.12) { // much less likely to create soil/plant from falling
                this.world.setParticle(x, y + 1, PARTICLE_TYPES.PLANT, [0, 0, 0, 0]);
            } else if (Math.random() < 0.06) {
                // very small chance to create soil; otherwise just become empty
                this.world.setParticle(x, y + 1, PARTICLE_TYPES.SOIL);
            } else {
                // mostly just vanish to empty to avoid rapid soil growth
                this.world.setParticle(x, y + 1, PARTICLE_TYPES.EMPTY);
            }
            this.world.setParticle(x, y, PARTICLE_TYPES.EMPTY);
            this.world.setUpdated(x, y + 1);
            return;
        }

        // Scale growth by actual simulation time
        const timeFactor = deltaTime / 16;
        age += timeFactor;
        this.world.particleData[idx + 2] = age;
        // Assign/refresh color occasionally based on environment (flowers can appear)
        if (Math.random() < 0.01 * timeFactor) { // halved chance of color/flower churn
            const env = classifyEnvironment(this.world, x, y);
            this.world.particleData[idx + 3] = maybeBloom(this.world.particleData[idx + 3] || env.colorCode, env.fertile);
        }

        // Photosynthesis
        // Allow photosynthesis when at least part of canopy is exposed (not strictly empty above).
        const canopyExposed = (above === PARTICLE_TYPES.EMPTY || above === PARTICLE_TYPES.STEAM || above === PARTICLE_TYPES.CLOUD);
        if (canopyExposed) {
            energy += 0.12 * timeFactor; // significantly reduced photosynthesis rate
        } else {
            // Even shaded plants slowly photosynthesize (overcast/under-canopy)
            energy += 0.01 * timeFactor; // much slower when shaded
        }

        // Water absorption from a slightly larger neighborhood (roots/wicking)
        let absorbed = false;
        for (let dx = -2; dx <= 2 && !absorbed; dx++) {
            for (let dy = 0; dy <= 2 && !absorbed; dy++) { // prefer water below and at same level
                const px = x + dx, py = y + dy;
                if (this.world.getParticle(px, py) === PARTICLE_TYPES.WATER) {
                    energy += 0.08 * timeFactor; // reduced water energy gain
                    // Very low chance to remove water so plants don't desiccate the world
                    if (Math.random() < 0.002 * timeFactor) {
                        this.world.setParticle(px, py, PARTICLE_TYPES.EMPTY);
                    }
                    absorbed = true;
                }
            }
        }

        if (type === 0) { // Seed
            // Seeds require more energy to germinate now (so they don't rapidly convert everywhere)
            if (energy > 4.5) { // raised threshold
                this.world.particleData[idx + 1] = 1;
                energy = 0;
                // Try to occupy a nearby valid surface (soil, sand, shallow rock)
                const trySpots = [[0,-1],[0,1],[-1,0],[1,0]];
                for (const s of trySpots) {
                    const sx = x + s[0], sy = y + s[1];
                    if (!this.world.inBounds(sx, sy)) continue;
                    const env = classifyEnvironment(this.world, sx, sy);
                    const belowP = this.world.getParticle(sx, sy + 1);
                    if (this.world.getParticle(sx, sy) === PARTICLE_TYPES.EMPTY && (belowP === PARTICLE_TYPES.SOIL || belowP === PARTICLE_TYPES.SAND || belowP === PARTICLE_TYPES.GRANITE || belowP === PARTICLE_TYPES.BASALT)) {
                        this.world.setParticle(sx, sy, PARTICLE_TYPES.PLANT, [0, 1, 0, env.colorCode]);
                        this.world.setUpdated(sx, sy);
                        break;
                    }
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

            if (energy > 8) { // require more energy to trigger reproduction/growth
                if (height >= 4) {
                    // produce seeds in nearby soil rather than grow taller
                    // Spread seeds much more conservatively to avoid rapid soil/plant proliferation
                    for (let dx = -4; dx <= 4; dx++) {
                        const nx = x + dx;
                        if (nx < 0 || nx >= this.world.width) continue;
                        for (let sy = 1; sy <= 6; sy++) {
                            const ny = y + sy;
                            if (ny >= this.world.height) break;
                            const below = this.world.getParticle(nx, ny + 1);
                            const target = this.world.getParticle(nx, ny);
                            if ((target === PARTICLE_TYPES.EMPTY || target === PARTICLE_TYPES.SOIL) &&
                                (below === PARTICLE_TYPES.SOIL || below === PARTICLE_TYPES.SAND || below === PARTICLE_TYPES.GRANITE || below === PARTICLE_TYPES.BASALT) &&
                                Math.random() < 0.04) { // much lower spawn chance
                                const env = classifyEnvironment(this.world, nx, ny);
                                this.world.setParticle(nx, ny, PARTICLE_TYPES.PLANT, [0, 0, 0, env.colorCode]); // seed
                                this.world.setUpdated(nx, ny);
                                break;
                            }
                        }
                    }
                    energy = 0;
                } else {
                    // Grow upwards as normal (slower due to higher threshold)
                    if (this.world.getParticle(x, y - 1) === PARTICLE_TYPES.EMPTY) {
                        const colorCode = this.world.particleData[idx + 3] || 0; // Inherit color code
                        if (Math.random() < 0.75) { // growth chance reduced slightly so growth takes longer
                            this.world.setParticle(x, y - 1, PARTICLE_TYPES.PLANT, [0, 1, 0, colorCode]);
                            energy = 0;
                            this.world.setUpdated(x, y - 1);
                        }
                    }
                }
            }

            // Occasional lateral colonization: much less frequent so soil production is slow
            if (age > 300 && Math.random() < 0.00015 * timeFactor) { // age and chance increased/reduced
                for (let attempt = 0; attempt < 4; attempt++) {
                    const nx = x + (Math.random() * 24 - 12) | 0;
                    const ny = y + (Math.random() * 8 - 4) | 0;
                    if (!this.world.inBounds(nx, ny)) continue;
                    const below = this.world.getParticle(nx, ny + 1);
                    const target = this.world.getParticle(nx, ny);
                    if ((target === PARTICLE_TYPES.EMPTY || target === PARTICLE_TYPES.SOIL) &&
                        (below === PARTICLE_TYPES.SOIL || below === PARTICLE_TYPES.SAND || below === PARTICLE_TYPES.GRANITE || below === PARTICLE_TYPES.BASALT)) {
                        const env = classifyEnvironment(this.world, nx, ny);
                        if (Math.random() < 0.06) { // additional check to make lateral colonization rare
                            this.world.setParticle(nx, ny, PARTICLE_TYPES.PLANT, [0, 0, 0, env.colorCode]);
                            this.world.setUpdated(nx, ny);
                            break;
                        }
                    }
                }
            }
        }

        // Death: make plants more forgiving — require old age AND being buried/overcrowded
        const buriedAbove = this.world.getParticle(x, y - 1) !== PARTICLE_TYPES.EMPTY && this.world.getParticle(x, y - 1) !== PARTICLE_TYPES.PLANT;
        if (age > 2400 || (age > 1200 && buriedAbove)) { // require much older plants before converting to soil
            this.world.setParticle(x, y, PARTICLE_TYPES.SOIL);
            return;
        }
        // Variant-specific micro-growth: allow colonization on many substrates
        if (Math.random() < 0.001 * timeFactor) { // slightly reduced micro-growth churn
            const env = classifyEnvironment(this.world, x, y);
            // cactus: small, 3-5 px height
            if (env.variant === 3) {
                const h = 3 + Math.floor(Math.random() * 3);
                for (let dy = 1; dy <= h; dy++) {
                    if (this.world.getParticle(x, y - dy) === PARTICLE_TYPES.EMPTY)
                        this.world.setParticle(x, y - dy, PARTICLE_TYPES.PLANT, [0, 1, 0, env.colorCode]);
                }
            } else if (env.variant === 1 || env.variant === 4) {
                // moss/lichen: spread sideways on rock but much less often
                const dir = Math.random() < 0.5 ? -1 : 1;
                if (Math.random() < 0.08 && this.world.getParticle(x + dir, y) !== PARTICLE_TYPES.BEDROCK)
                    this.world.setParticle(x + dir, y, PARTICLE_TYPES.PLANT, [0, 1, 0, env.colorCode]);
            } else if (env.variant === 2 || env.variant === 5) {
                // seaweed/coral: grow upward underwater (reduced frequency)
                if (Math.random() < 0.2 && (this.world.getParticle(x, y - 1) === PARTICLE_TYPES.WATER || this.world.getParticle(x, y) === PARTICLE_TYPES.WATER))
                    this.world.setParticle(x, y - 1, PARTICLE_TYPES.PLANT, [0, 1, 0, env.colorCode]);
            }
        }

        this.world.particleData[idx] = energy;
    }
}