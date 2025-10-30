import { classifyEnvironment } from '../PlantEcology.js';
import { PlantCore } from './PlantCore.js';

export class ReproductionSystem {
  constructor(world) {
    this.world = world;
    this.core = new PlantCore(world);
  }

  trySpreadSeeds(x, y, data, columnHeight) {
    if (data.energy <= 8 || columnHeight < 4) return;

    // Spread seeds conservatively around nearby soil
    for (let dx = -4; dx <= 4; dx++) {
      const nx = x + dx;
      if (nx < 0 || nx >= this.world.width) continue;
      for (let sy = 1; sy <= 6; sy++) {
        const ny = y + sy;
        if (ny >= this.world.height) break;
        // Use core helper to place seeds with low chance
        if (this.core.trySeedPlacement(nx, ny, data.colorCode, 0.04)) break;
      }
    }
    data.energy = 0;
  }
}