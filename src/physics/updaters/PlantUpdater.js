import { PARTICLE_TYPES } from '../../utils/Constants.js';
import { classifyEnvironment, maybeBloom } from '../../biology/PlantEcology.js';
import { PlantCore } from '../../biology/plant/PlantCore.js';
import { UnderwaterBehavior } from '../../biology/plant/UnderwaterBehavior.js';
import { GrowthSystem } from '../../biology/plant/GrowthSystem.js';
import { ReproductionSystem } from '../../biology/plant/ReproductionSystem.js';
import { EnvironmentInteraction } from '../../biology/plant/EnvironmentInteraction.js';
import { MortalitySystem } from '../../biology/plant/MortalitySystem.js';

// PlantUpdater orchestrates plant logic by delegating to smaller modules.
// This makes it suitable for tiered timescale integration and future field-level approximations.
export class PlantUpdater {
  constructor(world) {
    this.world = world;

    // Subsystems (can be swapped per tier in the future)
    this.core = new PlantCore(world);
    this.water = new UnderwaterBehavior(world);
    this.growth = new GrowthSystem(world);
    this.repro = new ReproductionSystem(world);
    this.envfx = new EnvironmentInteraction(world);
    this.mort = new MortalitySystem(world);
  }

  update(x, y, deltaTime) {
    const data = this.core.readPlantData(x, y);
    if (!data) return;

    // Early hazard checks and water-surface deaths
    if (this.core.applyHazardRules(x, y)) return;

    // Underwater behaviors (seed sinking or stem anchoring)
    if (this.core.isSubmerged(x, y)) {
      if (this.water.updateUnderwater(x, y, data, deltaTime)) return;
    }

    // Edge support check: fall only when fully unsupported
    if (this.core.tryUnsupportedFall(x, y)) return;

    // Time-based progression
    const timeFactor = deltaTime / 16;
    data.age += timeFactor;

    // Flower/color updates
    if (Math.random() < 0.01 * timeFactor) {
      const env = classifyEnvironment(this.world, x, y);
      data.colorCode = maybeBloom(data.colorCode || env.colorCode, env.fertile);
    }

    // Photosynthesis and water absorption
    data.energy += this.core.photosynthesisEnergy(x, y, timeFactor);
    data.energy += this.core.absorbNearbyWater(x, y, timeFactor);

    // Growth and reproduction
    if (data.type === 0) {
      // Seed -> germination
      this.growth.tryGerminate(x, y, data);
    } else if (data.type === 1) {
      // Stem: vertical growth or reproduction if tall
      const columnHeight = this.core.measureColumnHeight(x, y);
      this.growth.tryGrowUpward(x, y, data, columnHeight);
      this.repro.trySpreadSeeds(x, y, data, columnHeight);
      this.envfx.tryLateralColonization(x, y, data, timeFactor);
    }

    // Mortality and micro-variant growth
    if (this.mort.checkDeath(x, y, data)) return;
    this.envfx.maybeMicroGrowth(x, y, timeFactor);

    // Persist data back to world
    this.core.writePlantData(x, y, data);
  }
}