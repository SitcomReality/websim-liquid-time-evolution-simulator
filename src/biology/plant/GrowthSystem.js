import { PARTICLE_TYPES } from '../../utils/Constants.js';
import { classifyEnvironment } from '../PlantEcology.js';
import { PlantCore } from './PlantCore.js';

export class GrowthSystem {
  constructor(world) {
    this.world = world;
    this.core = new PlantCore(world);
  }

  tryGerminate(x, y, data) {
    // Seeds require more energy to germinate
    if (data.energy > 4.5) {
      data.type = 1;
      data.energy = 0;

      // Try to occupy a nearby valid surface
      const env = classifyEnvironment(this.world, x, y);
      this.core.tryOccupyNearbySurfaceWithStem(x, y, env.colorCode);
    }
  }

  tryGrowUpward(x, y, data, columnHeight) {
    if (data.energy > 8) {
      if (columnHeight >= 4) {
        // Too tall: reproduction handled elsewhere; reset energy
        data.energy = 0;
      } else {
        // Grow upward slower
        if (this.world.getParticle(x, y - 1) === PARTICLE_TYPES.EMPTY) {
          const colorCode = data.colorCode || 0;
          if (Math.random() < 0.75) {
            this.world.setParticle(x, y - 1, PARTICLE_TYPES.PLANT, [0, 1, 0, colorCode]);
            data.energy = 0;
            this.world.setUpdated(x, y - 1);
          }
        }
      }
    }
  }
}