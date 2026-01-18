import { PARTICLE_TYPES } from '../../../utils/Constants.js';

/**
 * Convert field representation back to particle world.
 * Reconstructs particle grid from fields (Tier 2 → Tier 1).
 *
 * Parameters:
 *  - fields: object containing width, height, cellSize, elevation, material, climate (optional)
 *  - world: World instance to write particles/temperature into
 *  - options:
 *      overwrite (bool): if true, overwrite particle materials in the target area (default: true)
 *      sprinkleFactor (0..1): probability factor for sprinkling water/vegetation when not overwriting (default: 0.5)
 *      preserveTemperature (bool): if true, blend field temperature into world temperature (default: true)
 */
export function fieldsToParticles(fields, world, options = {}) {
  const {
    overwrite = true,
    sprinkleFactor = 0.5,
    preserveTemperature = true
  } = options;

  if (!fields || !world) return world;

  const cs = fields.cellSize || 16;
  const cellsX = fields.width;
  const cellsY = fields.height;

  // Helper to read material arrays from a couple of possible shapes
  const mat = fields.material || {};
  const rockSand = mat.sand || fields.rockFracSand || new Float32Array(cellsX * cellsY);
  const rockSoil = mat.soil || fields.rockFracSoil || new Float32Array(cellsX * cellsY);
  const rockGranite = mat.granite || fields.rockFracGranite || new Float32Array(cellsX * cellsY);
  const rockBasalt = mat.basalt || fields.rockFracBasalt || new Float32Array(cellsX * cellsY);

  const climate = fields.climate || {};
  const tempArray = climate.temperature || fields.temperature || new Float32Array(cellsX * cellsY);
  const precipArray = climate.precipitation || new Float32Array(cellsX * cellsY);

  for (let cy = 0; cy < cellsY; cy++) {
    for (let cx = 0; cx < cellsX; cx++) {
      const fIdx = cy * cellsX + cx;

      // World-space region covering this field cell
      const x0 = cx * cs;
      const y0 = cy * cs;
      const x1 = Math.min(world.width, x0 + cs);
      const y1 = Math.min(world.height, y0 + cs);

      // Determine dominant material for this field cell
      const sand = rockSand[fIdx] || 0;
      const soil = rockSoil[fIdx] || 0;
      const granite = rockGranite[fIdx] || 0;
      const basalt = rockBasalt[fIdx] || 0;

      // Choose dominant by value
      let dominant = 'soil';
      let maxVal = soil;
      if (sand > maxVal) { dominant = 'sand'; maxVal = sand; }
      if (granite > maxVal) { dominant = 'granite'; maxVal = granite; }
      if (basalt > maxVal) { dominant = 'basalt'; maxVal = basalt; }

      // Map dominant to particle type
      let dominantType = PARTICLE_TYPES.SOIL;
      switch (dominant) {
        case 'sand': dominantType = PARTICLE_TYPES.SAND; break;
        case 'granite': dominantType = PARTICLE_TYPES.GRANITE; break;
        case 'basalt': dominantType = PARTICLE_TYPES.BASALT; break;
        default: dominantType = PARTICLE_TYPES.SOIL;
      }

      // Surface Y from normalized elevation: elevation 0..1 -> surface row
      const elev = (fields.elevation && fields.elevation[fIdx] !== undefined) ? fields.elevation[fIdx] : 0;
      const surfaceY = Math.floor((1 - Math.min(1, Math.max(0, elev))) * world.height);

      // Temperature value for this cell (coarse)
      const cellTemp = tempArray[fIdx] !== undefined ? tempArray[fIdx] : undefined;
      const cellPrecip = precipArray[fIdx] !== undefined ? precipArray[fIdx] : 0;

      // Fill pixel region
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          // Apply temperature blending if requested
          if (preserveTemperature && typeof cellTemp === 'number') {
            // Blend into world thermal grid conservatively
            const oldT = world.getTemperature(x, y);
            world.setTemperature(x, y, oldT * 0.7 + cellTemp * 0.3);
          }

          if (overwrite) {
            // Below or at surface -> solid material, above -> water/air depending on precipitation
            if (y >= surfaceY) {
              world.setParticle(x, y, dominantType);
            } else {
              // above surface: water with some probability based on precip
              const waterProb = Math.min(0.6, (cellPrecip / 3000) * 0.5);
              if (Math.random() < waterProb) {
                world.setParticle(x, y, PARTICLE_TYPES.WATER);
              } else {
                world.setParticle(x, y, PARTICLE_TYPES.EMPTY);
              }
            }
          } else {
            // Conservative projection: only nudge temperature and occasionally sprinkle hints
            // Sprinkle water in upper portion with low probability
            if (y < surfaceY && Math.random() < Math.min(0.02, (cellPrecip / 3000) * sprinkleFactor * 0.02)) {
              if (world.getParticle(x, y) === PARTICLE_TYPES.EMPTY) {
                world.setParticle(x, y, PARTICLE_TYPES.WATER);
              }
            }

            // Slight chance to plant vegetation on likely surface pixels
            if (y === surfaceY && Math.random() < 0.01 * sprinkleFactor) {
              const below = world.getParticle(x, y + 1);
              if (below === PARTICLE_TYPES.SOIL || below === PARTICLE_TYPES.SAND || below === PARTICLE_TYPES.GRANITE || below === PARTICLE_TYPES.BASALT) {
                // seed a plant (type/stored data handled by Plant systems)
                world.setParticle(x, y, PARTICLE_TYPES.PLANT, [0, 0, 0, 0]);
              }
            }
          }
        }
      }
    }
  }

  return world;
}