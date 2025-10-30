import { PARTICLE_TYPES } from '../../utils/Constants.js';
import { classifyEnvironment } from '../PlantEcology.js';

export class PlantCore {
  constructor(world) {
    this.world = world;
  }

  readPlantData(x, y) {
    const idx = this.world.getIndex(x, y) * 4;
    const type = this.world.particleData[idx + 1];
    if (this.world.getParticle(x, y) !== PARTICLE_TYPES.PLANT) return null;
    return {
      energy: this.world.particleData[idx] || 0,
      type: type || 0, // 0 seed, 1 stem
      age: this.world.particleData[idx + 2] || 0,
      colorCode: this.world.particleData[idx + 3] || 0
    };
  }

  writePlantData(x, y, data) {
    const idx = this.world.getIndex(x, y) * 4;
    this.world.particleData[idx] = data.energy;
    this.world.particleData[idx + 1] = data.type;
    this.world.particleData[idx + 2] = data.age;
    this.world.particleData[idx + 3] = data.colorCode;
  }

  isWaterSurface(x, y) {
    const below = this.world.getParticle(x, y + 1);
    const above = this.world.getParticle(x, y - 1);
    return (below === PARTICLE_TYPES.WATER && above === PARTICLE_TYPES.EMPTY);
  }

  isSubmerged(x, y) {
    const w = this.world;
    const below = w.getParticle(x, y + 1);
    return (
      below === PARTICLE_TYPES.WATER ||
      w.getParticle(x - 1, y) === PARTICLE_TYPES.WATER ||
      w.getParticle(x + 1, y) === PARTICLE_TYPES.WATER
    );
  }

  isOverHazard(x, y) {
    const below = this.world.getParticle(x, y + 1);
    return (below === PARTICLE_TYPES.STEAM || below === PARTICLE_TYPES.LAVA);
  }

  applyHazardRules(x, y) {
    if (this.isWaterSurface(x, y) || this.isOverHazard(x, y)) {
      // Immediate death: convert into water/soil/empty with probabilities
      const r = Math.random();
      if (r < 0.3) this.world.setParticle(x, y, PARTICLE_TYPES.WATER);
      else if (r < 0.8) this.world.setParticle(x, y, PARTICLE_TYPES.SOIL);
      else this.world.setParticle(x, y, PARTICLE_TYPES.EMPTY);
      return true;
    }
    return false;
  }

  tryUnsupportedFall(x, y) {
    const w = this.world;
    const below = w.getParticle(x, y + 1);
    const bl = w.getParticle(x - 1, y + 1);
    const br = w.getParticle(x + 1, y + 1);
    if (below === PARTICLE_TYPES.EMPTY && bl === PARTICLE_TYPES.EMPTY && br === PARTICLE_TYPES.EMPTY) {
      // Prefer turning into seed/soil/empty with low probabilities
      const r1 = Math.random();
      if (r1 < 0.12) {
        w.setParticle(x, y + 1, PARTICLE_TYPES.PLANT, [0, 0, 0, 0]);
      } else if (r1 < 0.18) {
        w.setParticle(x, y + 1, PARTICLE_TYPES.SOIL);
      } else {
        w.setParticle(x, y + 1, PARTICLE_TYPES.EMPTY);
      }
      w.setParticle(x, y, PARTICLE_TYPES.EMPTY);
      w.setUpdated(x, y + 1);
      return true;
    }
    return false;
  }

  photosynthesisEnergy(x, y, timeFactor) {
    const above = this.world.getParticle(x, y - 1);
    const canopyExposed = (above === PARTICLE_TYPES.EMPTY || above === PARTICLE_TYPES.STEAM || above === PARTICLE_TYPES.CLOUD);
    if (canopyExposed) return 0.12 * timeFactor;
    return 0.01 * timeFactor;
  }

  absorbNearbyWater(x, y, timeFactor) {
    const w = this.world;
    for (let dx = -2; dx <= 2; dx++) {
      for (let dy = 0; dy <= 2; dy++) {
        const px = x + dx, py = y + dy;
        if (!w.inBounds(px, py)) continue;
        if (w.getParticle(px, py) === PARTICLE_TYPES.WATER) {
          // tiny energy bump and small chance to remove water
          if (Math.random() < 0.002 * timeFactor) {
            w.setParticle(px, py, PARTICLE_TYPES.EMPTY);
          }
          return 0.08 * timeFactor;
        }
      }
    }
    return 0;
  }

  measureColumnHeight(x, y, maxScan = 50) {
    let height = 0;
    for (let dy = 0; dy < maxScan; dy++) {
      const ny = y + dy;
      if (ny >= this.world.height) break;
      if (this.world.getParticle(x, ny) === PARTICLE_TYPES.PLANT) height++;
      else break;
    }
    return height;
  }

  placeStemIfValid(x, y, colorCode) {
    const w = this.world;
    if (w.getParticle(x, y) === PARTICLE_TYPES.EMPTY) {
      w.setParticle(x, y, PARTICLE_TYPES.PLANT, [0, 1, 0, colorCode || 0]);
      w.setUpdated(x, y);
      return true;
    }
    return false;
  }

  tryOccupyNearbySurfaceWithStem(x, y, colorCode) {
    const w = this.world;
    const spots = [[0,-1],[0,1],[-1,0],[1,0]];
    for (const s of spots) {
      const sx = x + s[0], sy = y + s[1];
      if (!w.inBounds(sx, sy)) continue;
      const belowP = w.getParticle(sx, sy + 1);
      const surfaceOk = (belowP === PARTICLE_TYPES.SOIL || belowP === PARTICLE_TYPES.SAND || belowP === PARTICLE_TYPES.GRANITE || belowP === PARTICLE_TYPES.BASALT);
      if (w.getParticle(sx, sy) === PARTICLE_TYPES.EMPTY && surfaceOk) {
        w.setParticle(sx, sy, PARTICLE_TYPES.PLANT, [0, 1, 0, colorCode || 0]);
        w.setUpdated(sx, sy);
        return true;
      }
    }
    return false;
  }

  trySeedPlacement(x, y, colorCode, chance = 0.06) {
    const w = this.world;
    const below = w.getParticle(x, y + 1);
    const target = w.getParticle(x, y);
    const surfaceOk = (below === PARTICLE_TYPES.SOIL || below === PARTICLE_TYPES.SAND || below === PARTICLE_TYPES.GRANITE || below === PARTICLE_TYPES.BASALT);
    if ((target === PARTICLE_TYPES.EMPTY || target === PARTICLE_TYPES.SOIL) && surfaceOk && Math.random() < chance) {
      const env = classifyEnvironment(w, x, y);
      w.setParticle(x, y, PARTICLE_TYPES.PLANT, [0, 0, 0, colorCode ?? env.colorCode]);
      w.setUpdated(x, y);
      return true;
    }
    return false;
  }
}