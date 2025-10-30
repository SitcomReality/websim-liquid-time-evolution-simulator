import { PARTICLE_TYPES } from '../../utils/Constants.js';

export class UnderwaterBehavior {
  constructor(world) {
    this.world = world;
  }

  updateUnderwater(x, y, data, deltaTime) {
    // Seed behavior: sink downward through water/empty, dissolve if stuck too long
    if (data.type === 0) {
      const below = this.world.getParticle(x, y + 1);
      if (below === PARTICLE_TYPES.WATER || below === PARTICLE_TYPES.EMPTY) {
        this.world.swapParticles(x, y, x, y + 1);
        this.world.setUpdated(x, y + 1);
        // slower aging while sinking
        const idx = this.world.getIndex(x, y) * 4;
        this.world.particleData[idx] = (this.world.particleData[idx] || 0) + 0.5;
      } else {
        // If seed has been underwater too long without finding substrate, dissolve
        if ((this.world.particleData[this.world.getIndex(x, y) * 4] || 0) > 2400) {
          this.world.setParticle(x, y, PARTICLE_TYPES.EMPTY);
          return true;
        }
      }
      return true;
    }

    // Stem behavior: seek substrate below to anchor underwater
    const maxSearch = 12;
    for (let d = 1; d <= maxSearch; d++) {
      const ny = y + d;
      if (ny >= this.world.height - 1) break;
      const belowCheck = this.world.getParticle(x, ny + 1);
      const candidate = this.world.getParticle(x, ny);
      const substrate =
        belowCheck === PARTICLE_TYPES.SOIL ||
        belowCheck === PARTICLE_TYPES.SAND ||
        belowCheck === PARTICLE_TYPES.GRANITE ||
        belowCheck === PARTICLE_TYPES.BASALT;
      if (substrate) {
        if (candidate === PARTICLE_TYPES.WATER || candidate === PARTICLE_TYPES.EMPTY) {
          this.world.setParticle(x, ny, PARTICLE_TYPES.PLANT, [0, 1, 0, this.world.particleData[this.world.getIndex(x, y)*4 + 3] || 0]);
          this.world.setParticle(x, y, PARTICLE_TYPES.WATER);
          this.world.setUpdated(x, ny);
          return true;
        }
        break;
      }
    }
    // No substrate found: degrade to seed with chance or old stem dies to soil
    if (Math.random() < 0.04) {
      this.world.particleData[this.world.getIndex(x, y)*4 + 1] = 0; // become seed
      this.world.particleData[this.world.getIndex(x, y)*4] = (this.world.particleData[this.world.getIndex(x, y)*4] || 0) + 40;
    } else if ((this.world.particleData[this.world.getIndex(x, y)*4 + 2] || 0) > 1600) {
      this.world.setParticle(x, y, PARTICLE_TYPES.SOIL);
      return true;
    }
    return true;
  }
}