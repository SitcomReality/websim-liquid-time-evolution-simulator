import { PARTICLE_TYPES, TEMPERATURE } from '../../../utils/Constants.js';

/**
 * Convert particle world to field representation.
 * Aggregates particles into coarser field cells (Tier 1 → Tier 2).
 *
 * @param {Object} world - World instance with particle accessors
 * @param {number} cellSize - size in pixels of each field cell (default 16)
 * @returns {Object} fields - coarse fields (elevation, material, climate)
 */
export function particlesToFields(world, cellSize = 16) {
  const width = Math.ceil(world.width / cellSize);
  const height = Math.ceil(world.height / cellSize);

  const fields = {
    width,
    height,
    cellSize,
    elevation: new Float32Array(width * height),
    material: {
      sand: new Float32Array(width * height),
      soil: new Float32Array(width * height),
      granite: new Float32Array(width * height),
      basalt: new Float32Array(width * height)
    },
    climate: {
      temperature: new Float32Array(width * height),
      precipitation: new Float32Array(width * height),
      windDirX: new Float32Array(width * height),
      windDirY: new Float32Array(width * height)
    }
  };

  const getIndex = (x, y) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return -1;
    return y * width + x;
  };

  for (let cy = 0; cy < height; cy++) {
    for (let cx = 0; cx < width; cx++) {
      const idx = getIndex(cx, cy);
      const x0 = cx * cellSize;
      const y0 = cy * cellSize;
      const x1 = Math.min(world.width, x0 + cellSize);
      const y1 = Math.min(world.height, y0 + cellSize);

      let sand = 0, soil = 0, granite = 0, basalt = 0;
      let highestSolidY = world.height;
      let tempSum = 0, tempCount = 0;
      let waterCount = 0;

      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const p = world.getParticle(x, y);

          // Consider non-fluid/non-empty particles as "solid surface" candidates
          if (p !== PARTICLE_TYPES.EMPTY &&
              p !== PARTICLE_TYPES.WATER &&
              p !== PARTICLE_TYPES.STEAM &&
              p !== PARTICLE_TYPES.CLOUD &&
              p !== PARTICLE_TYPES.PLANT) {
            highestSolidY = Math.min(highestSolidY, y);
          }

          if (p === PARTICLE_TYPES.SAND) sand++;
          else if (p === PARTICLE_TYPES.SOIL) soil++;
          else if (p === PARTICLE_TYPES.GRANITE) granite++;
          else if (p === PARTICLE_TYPES.BASALT) basalt++;
          else if (p === PARTICLE_TYPES.WATER) waterCount++;

          const t = world.getTemperature(x, y);
          if (typeof t === 'number' && Number.isFinite(t)) {
            tempSum += t;
            tempCount++;
          }
        }
      }

      const cellArea = (x1 - x0) * (y1 - y0) || 1;
      const surfaceFound = highestSolidY < world.height;
      fields.elevation[idx] = surfaceFound ?
        Math.max(0, 1 - (highestSolidY / world.height)) : 0;

      const rockTotal = sand + soil + granite + basalt || 1;
      fields.material.sand[idx] = sand / rockTotal;
      fields.material.soil[idx] = soil / rockTotal;
      fields.material.granite[idx] = granite / rockTotal;
      fields.material.basalt[idx] = basalt / rockTotal;

      fields.climate.temperature[idx] = tempCount > 0 ?
        tempSum / tempCount : TEMPERATURE.AMBIENT;

      // Precipitation heuristic: fraction of cell occupied by water scaled to mm/year
      fields.climate.precipitation[idx] = (waterCount / cellArea) * 2000;
    }
  }

  return fields;
}