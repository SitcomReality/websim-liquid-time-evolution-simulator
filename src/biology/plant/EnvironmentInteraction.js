import { PARTICLE_TYPES } from '../../utils/Constants.js';
import { classifyEnvironment } from '../PlantEcology.js';

export class EnvironmentInteraction {
  constructor(world) {
    this.world = world;
  }

  tryLateralColonization(x, y, data, timeFactor) {
    if (data.age > 300 && Math.random() < 0.00015 * timeFactor) {
      for (let attempt = 0; attempt < 4; attempt++) {
        const nx = x + (Math.random() * 24 - 12) | 0;
        const ny = y + (Math.random() * 8 - 4) | 0;
        if (!this.world.inBounds(nx, ny)) continue;
        const below = this.world.getParticle(nx, ny + 1);
        const target = this.world.getParticle(nx, ny);
        const surfaceOk =
          (below === PARTICLE_TYPES.SOIL || below === PARTICLE_TYPES.SAND || below === PARTICLE_TYPES.GRANITE || below === PARTICLE_TYPES.BASALT);
        if ((target === PARTICLE_TYPES.EMPTY || target === PARTICLE_TYPES.SOIL) && surfaceOk) {
          const env = classifyEnvironment(this.world, nx, ny);
          if (Math.random() < 0.06) {
            this.world.setParticle(nx, ny, PARTICLE_TYPES.PLANT, [0, 0, 0, env.colorCode]);
            this.world.setUpdated(nx, ny);
            break;
          }
        }
      }
    }
  }

  maybeMicroGrowth(x, y, timeFactor) {
    // Variant-specific micro-growth: allow colonization on many substrates
    if (Math.random() < 0.001 * timeFactor) {
      const env = classifyEnvironment(this.world, x, y);
      if (env.variant === 3) {
        // cactus: small, 3-5 px height
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
        if (Math.random() < 0.2 &&
            (this.world.getParticle(x, y - 1) === PARTICLE_TYPES.WATER || this.world.getParticle(x, y) === PARTICLE_TYPES.WATER))
          this.world.setParticle(x, y - 1, PARTICLE_TYPES.PLANT, [0, 1, 0, env.colorCode]);
      }
    }
  }
}