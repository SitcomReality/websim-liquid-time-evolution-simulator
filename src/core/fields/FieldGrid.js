import { PARTICLE_TYPES, TEMPERATURE } from '../../utils/Constants.js';

export class FieldGrid {
  /**
   * FieldGrid is a coarse field representation used by Tier 2/3.
   * width/height are in cells; cellSize is pixels per cell in the particle world.
   */
  constructor(width, height, cellSize = 8) {
    this.width = width;
    this.height = height;
    this.cellSize = cellSize;
    this.size = width * height;

    // Core fields
    this.elevation = new Float32Array(this.size);   // 0..1 (0 = deep, 1 = high)
    this.temperature = new Float32Array(this.size); // Celsius average
    this.water = new Float32Array(this.size);       // 0..1 water content fraction
    this.vegetation = new Float32Array(this.size);  // 0..1 vegetation coverage

    // Rock type distribution as per-cell fractions (0..1)
    this.rockFracSand = new Float32Array(this.size);
    this.rockFracSoil = new Float32Array(this.size);
    this.rockFracGranite = new Float32Array(this.size);
    this.rockFracBasalt = new Float32Array(this.size);

    this.reset();
  }

  reset() {
    this.elevation.fill(0);
    this.temperature.fill(TEMPERATURE.AMBIENT);
    this.water.fill(0);
    this.vegetation.fill(0);
    this.rockFracSand.fill(0);
    this.rockFracSoil.fill(0);
    this.rockFracGranite.fill(0);
    this.rockFracBasalt.fill(0);
  }

  getIndex(x, y) {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return -1;
    return y * this.width + x;
  }

  getCell(x, y) {
    const idx = this.getIndex(x, y);
    if (idx < 0) return null;
    return {
      elevation: this.elevation[idx],
      temperature: this.temperature[idx],
      water: this.water[idx],
      vegetation: this.vegetation[idx],
      rock: {
        sand: this.rockFracSand[idx],
        soil: this.rockFracSoil[idx],
        granite: this.rockFracGranite[idx],
        basalt: this.rockFracBasalt[idx]
      }
    };
  }

  setCell(x, y, data) {
    const idx = this.getIndex(x, y);
    if (idx < 0) return;
    if (data.elevation !== undefined) this.elevation[idx] = data.elevation;
    if (data.temperature !== undefined) this.temperature[idx] = data.temperature;
    if (data.water !== undefined) this.water[idx] = data.water;
    if (data.vegetation !== undefined) this.vegetation[idx] = data.vegetation;
    if (data.rock) {
      if (data.rock.sand !== undefined) this.rockFracSand[idx] = data.rock.sand;
      if (data.rock.soil !== undefined) this.rockFracSoil[idx] = data.rock.soil;
      if (data.rock.granite !== undefined) this.rockFracGranite[idx] = data.rock.granite;
      if (data.rock.basalt !== undefined) this.rockFracBasalt[idx] = data.rock.basalt;
    }
  }

  /**
   * Convert the current particle world into coarse fields.
   * Captures elevation, temperature, water content, vegetation coverage, and rock mix per cell.
   */
  interpolateFromParticles(world) {
    const cs = this.cellSize;
    const cellsX = Math.min(this.width, Math.ceil(world.width / cs));
    const cellsY = Math.min(this.height, Math.ceil(world.height / cs));

    for (let cy = 0; cy < cellsY; cy++) {
      for (let cx = 0; cx < cellsX; cx++) {
        const idx = this.getIndex(cx, cy);
        const x0 = cx * cs;
        const y0 = cy * cs;
        const x1 = Math.min(world.width, x0 + cs);
        const y1 = Math.min(world.height, y0 + cs);

        let count = 0;
        let sumTemp = 0;
        let waterCount = 0;
        let vegCount = 0;

        let sand = 0, soil = 0, granite = 0, basalt = 0;
        let highestSolidY = world.height - 1;
        let foundSurface = false;

        for (let y = y0; y < y1; y++) {
          for (let x = x0; x < x1; x++) {
            count++;
            const p = world.getParticle(x, y);
            // Temperature: sample world thermal grid
            sumTemp += world.getTemperature(x, y);

            // Water/vegetation content
            if (p === PARTICLE_TYPES.WATER) waterCount++;
            if (p === PARTICLE_TYPES.PLANT) vegCount++;

            // Rock distribution (solids)
            if (p === PARTICLE_TYPES.SAND) sand++;
            else if (p === PARTICLE_TYPES.SOIL) soil++;
            else if (p === PARTICLE_TYPES.GRANITE) granite++;
            else if (p === PARTICLE_TYPES.BASALT) basalt++;

            // Track highest solid (surface) within this cell area
            if (!foundSurface) {
              if (p !== PARTICLE_TYPES.EMPTY && p !== PARTICLE_TYPES.WATER && p !== PARTICLE_TYPES.STEAM && p !== PARTICLE_TYPES.CLOUD && p !== PARTICLE_TYPES.PLANT) {
                highestSolidY = Math.min(highestSolidY, y);
                foundSurface = true; // first solid encountered scanning row-wise
              }
            }
          }
        }

        // Normalize rock mix
        const rockTotal = sand + soil + granite + basalt;
        const safe = rockTotal > 0 ? rockTotal : 1;
        this.rockFracSand[idx] = sand / safe;
        this.rockFracSoil[idx] = soil / safe;
        this.rockFracGranite[idx] = granite / safe;
        this.rockFracBasalt[idx] = basalt / safe;

        // Elevation: normalized inverse of surface Y within world
        const elev = foundSurface ? (1 - (highestSolidY / world.height)) : 0;
        this.elevation[idx] = Math.max(0, Math.min(1, elev));

        // Temperature average
        this.temperature[idx] = count > 0 ? (sumTemp / count) : TEMPERATURE.AMBIENT;

        // Content fractions
        this.water[idx] = count > 0 ? (waterCount / count) : 0;
        this.vegetation[idx] = count > 0 ? (vegCount / count) : 0;
      }
    }
  }

  /**
   * Project coarse fields back into particle space.
   * By default, this is conservative and only nudges water/vegetation/temperature.
   * Set options.overwrite = true to rebuild cell materials using dominant rock type.
   */
  projectToParticles(world, options = {}) {
    const { overwrite = false, sprinkleFactor = 0.5 } = options;
    const cs = this.cellSize;
    const cellsX = Math.min(this.width, Math.ceil(world.width / cs));
    const cellsY = Math.min(this.height, Math.ceil(world.height / cs));

    for (let cy = 0; cy < cellsY; cy++) {
      for (let cx = 0; cx < cellsX; cx++) {
        const idx = this.getIndex(cx, cy);
        const x0 = cx * cs;
        const y0 = cy * cs;
        const x1 = Math.min(world.width, x0 + cs);
        const y1 = Math.min(world.height, y0 + cs);

        // Determine dominant rock
        let domType = PARTICLE_TYPES.SOIL;
        let domVal = this.rockFracSoil[idx];
        if (this.rockFracSand[idx] > domVal) { domVal = this.rockFracSand[idx]; domType = PARTICLE_TYPES.SAND; }
        if (this.rockFracGranite[idx] > domVal) { domVal = this.rockFracGranite[idx]; domType = PARTICLE_TYPES.GRANITE; }
        if (this.rockFracBasalt[idx] > domVal) { domVal = this.rockFracBasalt[idx]; domType = PARTICLE_TYPES.BASALT; }

        // Compute a local "surface" height inside this cell from elevation
        const localHeight = Math.floor((1 - this.elevation[idx]) * world.height);
        const cellMid = Math.floor((y0 + y1) / 2);
        const targetSurfaceY = Math.max(y0, Math.min(y1 - 1, localHeight));

        for (let y = y0; y < y1; y++) {
          for (let x = x0; x < x1; x++) {
            // Always push temperature hint into thermo field
            const tCell = this.temperature[idx];
            const tNow = world.getTemperature(x, y);
            world.setTemperature(x, y, tNow * 0.7 + tCell * 0.3);

            if (overwrite) {
              // Rebuild materials: dominant rock below surface, air/water/plants above
              if (y > targetSurfaceY) {
                // Below surface: set dominant rock
                world.setParticle(x, y, domType);
              } else {
                // Above surface: decide water/air/veg
                const w = this.water[idx];
                if (Math.random() < w) {
                  world.setParticle(x, y, PARTICLE_TYPES.WATER);
                } else {
                  // vegetation sprinkle on near-surface cells
                  const v = this.vegetation[idx];
                  if (y === targetSurfaceY && Math.random() < v * 0.5) {
                    world.setParticle(x, y, PARTICLE_TYPES.PLANT, [0, 0, 0, 0]);
                  } else {
                    world.setParticle(x, y, PARTICLE_TYPES.EMPTY);
                  }
                }
              }
            } else {
              // Conservative projection: sprinkle water/vegetation and adjust temperature
              const p = world.getParticle(x, y);
              // Add water hints in upper half of the cell
              if (y < cellMid && (p === PARTICLE_TYPES.EMPTY || p === PARTICLE_TYPES.SAND || p === PARTICLE_TYPES.SOIL)) {
                if (Math.random() < this.water[idx] * sprinkleFactor * 0.2) {
                  world.setParticle(x, y, PARTICLE_TYPES.WATER);
                }
              }
              // Add plants on likely surfaces
              if (y >= y0 + 1 && y < y1 - 1 && p !== PARTICLE_TYPES.BEDROCK) {
                const below = world.getParticle(x, y + 1);
                const surfaceLike = (below === PARTICLE_TYPES.SOIL || below === PARTICLE_TYPES.SAND || below === PARTICLE_TYPES.GRANITE || below === PARTICLE_TYPES.BASALT);
                if (surfaceLike && world.getParticle(x, y) === PARTICLE_TYPES.EMPTY) {
                  if (Math.random() < this.vegetation[idx] * sprinkleFactor * 0.15) {
                    world.setParticle(x, y, PARTICLE_TYPES.PLANT, [0, 0, 0, 0]);
                  }
                }
              }
            }
          }
        }
      }
    }
  }
}