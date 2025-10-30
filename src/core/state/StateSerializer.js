import { PARTICLE_TYPES, PARTICLE_PROPERTIES, TEMPERATURE } from '../../utils/Constants.js';
import { FieldGrid } from '../fields/FieldGrid.js';

/**
 * StateSerializer
 * Converts between tier representations with minimal loss:
 * - Particles ↔ Fields (Tier 1 ↔ Tier 2)
 * - Fields ↔ Plates (Tier 2 ↔ Tier 3)
 * 
 * Provides centralized serialization logic for tier transitions.
 */
export class StateSerializer {
  /**
   * Convert particle world to field representation.
   * Aggregates particles into coarser field cells (Tier 1 → Tier 2).
   * 
   * @param {World} world - Particle world
   * @param {number} cellSize - Pixels per field cell
   * @returns {Object} Field state with elevation, material, climate
   */
  static particlesToFields(world, cellSize = 16) {
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

    // Aggregate particles into field cells
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

        // Sample all particles in cell
        for (let y = y0; y < y1; y++) {
          for (let x = x0; x < x1; x++) {
            const p = world.getParticle(x, y);

            // Track highest solid (surface elevation)
            if (p !== PARTICLE_TYPES.EMPTY && 
                p !== PARTICLE_TYPES.WATER && 
                p !== PARTICLE_TYPES.STEAM && 
                p !== PARTICLE_TYPES.CLOUD &&
                p !== PARTICLE_TYPES.PLANT) {
              highestSolidY = Math.min(highestSolidY, y);
            }

            // Aggregate material composition
            if (p === PARTICLE_TYPES.SAND) sand++;
            else if (p === PARTICLE_TYPES.SOIL) soil++;
            else if (p === PARTICLE_TYPES.GRANITE) granite++;
            else if (p === PARTICLE_TYPES.BASALT) basalt++;
            else if (p === PARTICLE_TYPES.WATER) waterCount++;

            // Average temperature
            const t = world.getTemperature(x, y);
            tempSum += t;
            tempCount++;
          }
        }

        const cellArea = (x1 - x0) * (y1 - y0);

        // Elevation: normalized inverse of surface height
        const surfaceFound = highestSolidY < world.height;
        fields.elevation[idx] = surfaceFound ? 
          Math.max(0, 1 - (highestSolidY / world.height)) : 0;

        // Material fractions
        const rockTotal = sand + soil + granite + basalt || 1;
        fields.material.sand[idx] = sand / rockTotal;
        fields.material.soil[idx] = soil / rockTotal;
        fields.material.granite[idx] = granite / rockTotal;
        fields.material.basalt[idx] = basalt / rockTotal;

        // Climate
        fields.climate.temperature[idx] = tempCount > 0 ? 
          tempSum / tempCount : TEMPERATURE.AMBIENT;

        // Precipitation based on water presence
        fields.climate.precipitation[idx] = (waterCount / cellArea) * 2000; // Scale to mm/year
      }
    }

    return fields;
  }

  /**
   * Convert field representation back to particle world.
   * Reconstructs particle grid from fields (Tier 2 → Tier 1).
   * 
   * @param {Object} fields - Field state (from particlesToFields)
   * @param {World} world - Target particle world (pre-allocated)
   * @param {Object} options - Conversion options
   * @returns {World} Updated world
   */
  static fieldsToParticles(fields, world, options = {}) {
    const { 
      overwrite = true,
      sprinkleFactor = 0.5,
      preserveTemperature = true
    } = options;

    const cs = fields.cellSize;
    const width = fields.width;
    const height = fields.height;

    for (let cy = 0; cy < height; cy++) {
      for (let cx = 0; cx < width; cx++) {
        const idx = cy * width + cx;
        const x0 = cx * cs;
        const y0 = cy * cs;
        const x1 = Math.min(world.width, x0 + cs);
        const y1 = Math.min(world.height, y0 + cs);

        // Determine dominant rock type
        const ratios = {
          sand: fields.material.sand[idx],
          soil: fields.material.soil[idx],
          granite: fields.material.granite[idx],
          basalt: fields.material.basalt[idx]
        };

        let dominantType = PARTICLE_TYPES.SOIL;
        let dominantRatio = ratios.soil;

        for (const [matName, ratio] of Object.entries(ratios)) {
          if (ratio > dominantRatio) {
            dominantRatio = ratio;
            switch (matName) {
              case 'sand': dominantType = PARTICLE_TYPES.SAND; break;
              case 'granite': dominantType = PARTICLE_TYPES.GRANITE; break;
              case 'basalt': dominantType = PARTICLE_TYPES.BASALT; break;
            }
          }
        }

        // Calculate surface elevation
        const elev = fields.elevation[idx];
        const surfaceY = Math.floor(world.height * (1 - Math.min(1, elev)));

        // Reconstruct particle grid
        for (let y = y0; y < y1; y++) {
          for (let x = x0; x < x1; x++) {
            if (overwrite) {
              // Rebuild: solid below surface, air/water above
              if (y >= surfaceY) {
                world.setParticle(x, y, dominantType);
              } else {
                // Probabilistic water/air based on precipitation
                const waterProb = Math.min(0.3, fields.climate.precipitation[idx] / 3000);
                if (Math.random() < waterProb * sprinkleFactor) {
                  world.setParticle(x, y, PARTICLE_TYPES.WATER);
                } else {
                  world.setParticle(x, y, PARTICLE_TYPES.EMPTY);
                }
              }
            } else {
              // Conservative: only adjust temperature and nudge water
              if (preserveTemperature) {
                const tField = fields.climate.temperature[idx];
                const tNow = world.getTemperature(x, y);
                world.setTemperature(x, y, tNow * 0.7 + tField * 0.3);
              }

              // Sprinkle water in upper regions
              if (y < surfaceY && Math.random() < 0.01 * sprinkleFactor) {
                const p = world.getParticle(x, y);
                if (p === PARTICLE_TYPES.EMPTY) {
                  world.setParticle(x, y, PARTICLE_TYPES.WATER);
                }
              }
            }
          }
        }
      }
    }

    return world;
  }

  /**
   * Convert field representation to plate/tectonic representation.
   * Abstracts to major geological structures (Tier 2 → Tier 3).
   * 
   * @param {Object} fields - Field state
   * @param {number} plateResolution - Cells per plate
   * @returns {Object} Plate state with geometry and material distribution
   */
  static fieldsToPlates(fields, plateResolution = 32) {
    const fieldWidth = fields.width;
    const fieldHeight = fields.height;

    // Determine plate grid
    const platesX = Math.max(2, Math.floor(fieldWidth / plateResolution));
    const platesY = Math.max(2, Math.floor(fieldHeight / plateResolution));

    const plates = [];
    const plateIdField = new Uint16Array(fieldWidth * fieldHeight);
    const plateAgeField = new Float32Array(fieldWidth * fieldHeight);

    // Create plates and assign cells
    for (let py = 0; py < platesY; py++) {
      for (let px = 0; px < platesX; px++) {
        const plateId = py * platesX + px;

        // Determine plate properties from its region
        const startCx = Math.floor((px / platesX) * fieldWidth);
        const endCx = Math.floor(((px + 1) / platesX) * fieldWidth);
        const startCy = Math.floor((py / platesY) * fieldHeight);
        const endCy = Math.floor(((py + 1) / platesY) * fieldHeight);

        // Analyze region to classify as oceanic/continental
        let graniteCount = 0, basaltCount = 0, sandCount = 0;
        let densitySum = 0, cellCount = 0;

        for (let cy = startCy; cy < endCy; cy++) {
          for (let cx = startCx; cx < endCx; cx++) {
            const idx = cy * fieldWidth + cx;
            cellCount++;

            graniteCount += fields.material.granite[idx];
            basaltCount += fields.material.basalt[idx];
            sandCount += fields.material.sand[idx];

            // Density proxy: granite/basalt = heavier
            densitySum += fields.material.granite[idx] * 2.7 + 
                          fields.material.basalt[idx] * 3.0 + 
                          fields.material.sand[idx] * 1.5;
          }
        }

        // Classify plate type by dominant rock
        const avgDensity = densitySum / Math.max(1, cellCount);
        const isOceanic = avgDensity > 2.8 || basaltCount > graniteCount;
        const plateType = isOceanic ? 'oceanic' : 'continental';

        // Create plate object
        const plate = {
          id: plateId,
          type: plateType,
          density: avgDensity,
          centerX: (startCx + endCx) / 2,
          centerY: (startCy + endCy) / 2,
          minX: startCx,
          maxX: endCx,
          minY: startCy,
          maxY: endCy,
          // Random initial velocity (will be computed from field slopes)
          velocityX: (Math.random() - 0.5) * 0.2,
          velocityY: (Math.random() - 0.5) * 0.2,
          // Material composition fractions
          composition: {
            granite: graniteCount / Math.max(1, cellCount),
            basalt: basaltCount / Math.max(1, cellCount),
            sand: sandCount / Math.max(1, cellCount)
          }
        };

        plates.push(plate);

        // Assign cells to this plate and age them
        for (let cy = startCy; cy < endCy; cy++) {
          for (let cx = startCx; cx < endCx; cx++) {
            const idx = cy * fieldWidth + cx;
            plateIdField[idx] = plateId;
            // Random initial crust age (0-200 Mya)
            plateAgeField[idx] = Math.random() * 200;
          }
        }
      }
    }

    // Compute plate velocities from elevation gradients
    this.computePlateVelocitiesFromFields(plates, fields, plateIdField);

    return {
      plates,
      plateIdField,
      plateAgeField,
      numPlatesX: platesX,
      numPlatesY: platesY,
      cellSize: plateResolution,
      width: fieldWidth,
      height: fieldHeight
    };
  }

  /**
   * Convert plate/tectonic representation back to field representation.
   * Projects plate movements and activity to field data (Tier 3 → Tier 2).
   * 
   * @param {Object} plateState - Plate state (from fieldsToPlates)
   * @param {number} fieldWidth - Target field width
   * @param {number} fieldHeight - Target field height
   * @returns {Object} Field state
   */
  static platesToFields(plateState, fieldWidth, fieldHeight) {
    const fields = {
      width: fieldWidth,
      height: fieldHeight,
      cellSize: fieldWidth / plateState.width,
      elevation: new Float32Array(fieldWidth * fieldHeight),
      material: {
        sand: new Float32Array(fieldWidth * fieldHeight),
        soil: new Float32Array(fieldWidth * fieldHeight),
        granite: new Float32Array(fieldWidth * fieldHeight),
        basalt: new Float32Array(fieldWidth * fieldHeight)
      },
      climate: {
        temperature: new Float32Array(fieldWidth * fieldHeight),
        precipitation: new Float32Array(fieldWidth * fieldHeight),
        windDirX: new Float32Array(fieldWidth * fieldHeight),
        windDirY: new Float32Array(fieldWidth * fieldHeight)
      }
    };

    const { plates, plateIdField, plateAgeField } = plateState;

    // Project plate data onto field grid
    for (let y = 0; y < fieldHeight; y++) {
      for (let x = 0; x < fieldWidth; x++) {
        const fIdx = y * fieldWidth + x;

        // Find which plate this cell belongs to
        const scaledX = Math.floor((x / fieldWidth) * plateState.width);
        const scaledY = Math.floor((y / fieldHeight) * plateState.height);
        const pIdx = scaledY * plateState.width + scaledX;

        if (pIdx >= 0 && pIdx < plateIdField.length) {
          const plateId = plateIdField[pIdx];
          const plate = plates[plateId];
          const age = plateAgeField[pIdx] || 0;

          if (plate) {
            // Elevation: younger crust (mid-ocean ridges) is higher
            if (plate.type === 'oceanic') {
              // Mid-ocean ridge elevation boost
              const depthFactor = age / 200; // Older = deeper
              fields.elevation[fIdx] = 0.3 * (1 - depthFactor * 0.5);
            } else {
              // Continental crust is higher
              fields.elevation[fIdx] = 0.6 + Math.random() * 0.2;
            }

            // Material distribution based on plate type
            if (plate.type === 'oceanic') {
              fields.material.basalt[fIdx] = 0.7;
              fields.material.granite[fIdx] = 0.2;
              fields.material.sand[fIdx] = 0.1;
            } else {
              fields.material.granite[fIdx] = 0.6;
              fields.material.sand[fIdx] = 0.3;
              fields.material.soil[fIdx] = 0.1;
            }

            // Temperature: deeper/older crust is hotter (if subsurface)
            const baseTempK = age > 100 ? 600 : 300;
            fields.climate.temperature[fIdx] = baseTempK;
          }
        }
      }
    }

    return fields;
  }

  /**
   * Helper: Compute plate velocities from elevation gradient patterns.
   * Infers plate motion from topographic ridges/trenches.
   */
  static computePlateVelocitiesFromFields(plates, fields, plateIdField) {
    const fieldWidth = fields.width;
    const fieldHeight = fields.height;

    for (const plate of plates) {
      // Sample elevation gradient within plate bounds
      let gradX = 0, gradY = 0;
      let sampleCount = 0;

      for (let cy = plate.minY; cy < plate.maxY; cy += Math.max(1, Math.floor((plate.maxY - plate.minY) / 4))) {
        for (let cx = plate.minX; cx < plate.maxX; cx += Math.max(1, Math.floor((plate.maxX - plate.minX) / 4))) {
          if (cx > 0 && cx < fieldWidth - 1 && cy > 0 && cy < fieldHeight - 1) {
            const idx = cy * fieldWidth + cx;
            const eLeft = fields.elevation[cy * fieldWidth + (cx - 1)];
            const eRight = fields.elevation[cy * fieldWidth + (cx + 1)];
            const eUp = fields.elevation[(cy - 1) * fieldWidth + cx];
            const eDown = fields.elevation[(cy + 1) * fieldWidth + cx];

            gradX += (eRight - eLeft) / 2;
            gradY += (eDown - eUp) / 2;
            sampleCount++;
          }
        }
      }

      if (sampleCount > 0) {
        gradX /= sampleCount;
        gradY /= sampleCount;

        // Plate moves away from ridges (high elevation) toward trenches (low elevation)
        const grad = Math.sqrt(gradX * gradX + gradY * gradY);
        if (grad > 0.01) {
          plate.velocityX = -(gradX / grad) * 0.3;
          plate.velocityY = -(gradY / grad) * 0.3;
        }
      }
    }
  }

  /**
   * Merge similar adjacent cells to reduce field complexity.
   * Useful for downsampling when transitioning down a tier.
   */
  static simplifyFields(fields, factor = 2) {
    const newWidth = Math.ceil(fields.width / factor);
    const newHeight = Math.ceil(fields.height / factor);

    const simplified = {
      width: newWidth,
      height: newHeight,
      cellSize: fields.cellSize * factor,
      elevation: new Float32Array(newWidth * newHeight),
      material: {
        sand: new Float32Array(newWidth * newHeight),
        soil: new Float32Array(newWidth * newHeight),
        granite: new Float32Array(newWidth * newHeight),
        basalt: new Float32Array(newWidth * newHeight)
      },
      climate: {
        temperature: new Float32Array(newWidth * newHeight),
        precipitation: new Float32Array(newWidth * newHeight),
        windDirX: new Float32Array(newWidth * newHeight),
        windDirY: new Float32Array(newWidth * newHeight)
      }
    };

    for (let ny = 0; ny < newHeight; ny++) {
      for (let nx = 0; nx < newWidth; nx++) {
        let elevSum = 0, sandSum = 0, soilSum = 0, graniteSum = 0, basaltSum = 0;
        let tempSum = 0, precipSum = 0;
        let count = 0;

        const y0 = ny * factor;
        const x0 = nx * factor;

        for (let dy = 0; dy < factor; dy++) {
          for (let dx = 0; dx < factor; dx++) {
            const oy = y0 + dy, ox = x0 + dx;
            if (ox < fields.width && oy < fields.height) {
              const idx = oy * fields.width + ox;
              elevSum += fields.elevation[idx];
              sandSum += fields.material.sand[idx];
              soilSum += fields.material.soil[idx];
              graniteSum += fields.material.granite[idx];
              basaltSum += fields.material.basalt[idx];
              tempSum += fields.climate.temperature[idx];
              precipSum += fields.climate.precipitation[idx];
              count++;
            }
          }
        }

        const nIdx = ny * newWidth + nx;
        simplified.elevation[nIdx] = elevSum / count;
        simplified.material.sand[nIdx] = sandSum / count;
        simplified.material.soil[nIdx] = soilSum / count;
        simplified.material.granite[nIdx] = graniteSum / count;
        simplified.material.basalt[nIdx] = basaltSum / count;
        simplified.climate.temperature[nIdx] = tempSum / count;
        simplified.climate.precipitation[nIdx] = precipSum / count;
      }
    }

    return simplified;
  }

  /**
   * Upsample fields to higher resolution (reverse of simplify).
   * Uses nearest-neighbor interpolation for speed.
   */
  static upsampleFields(fields, factor = 2) {
    const newWidth = fields.width * factor;
    const newHeight = fields.height * factor;

    const upsampled = {
      width: newWidth,
      height: newHeight,
      cellSize: fields.cellSize / factor,
      elevation: new Float32Array(newWidth * newHeight),
      material: {
        sand: new Float32Array(newWidth * newHeight),
        soil: new Float32Array(newWidth * newHeight),
        granite: new Float32Array(newWidth * newHeight),
        basalt: new Float32Array(newWidth * newHeight)
      },
      climate: {
        temperature: new Float32Array(newWidth * newHeight),
        precipitation: new Float32Array(newWidth * newHeight),
        windDirX: new Float32Array(newWidth * newHeight),
        windDirY: new Float32Array(newWidth * newHeight)
      }
    };

    for (let ny = 0; ny < newHeight; ny++) {
      for (let nx = 0; nx < newWidth; nx++) {
        const sourceY = Math.floor(ny / factor);
        const sourceX = Math.floor(nx / factor);

        if (sourceX < fields.width && sourceY < fields.height) {
          const sIdx = sourceY * fields.width + sourceX;
          const nIdx = ny * newWidth + nx;

          upsampled.elevation[nIdx] = fields.elevation[sIdx];
          upsampled.material.sand[nIdx] = fields.material.sand[sIdx];
          upsampled.material.soil[nIdx] = fields.material.soil[sIdx];
          upsampled.material.granite[nIdx] = fields.material.granite[sIdx];
          upsampled.material.basalt[nIdx] = fields.material.basalt[sIdx];
          upsampled.climate.temperature[nIdx] = fields.climate.temperature[sIdx];
          upsampled.climate.precipitation[nIdx] = fields.climate.precipitation[sIdx];
          upsampled.climate.windDirX[nIdx] = fields.climate.windDirX[sIdx];
          upsampled.climate.windDirY[nIdx] = fields.climate.windDirY[sIdx];
        }
      }
    }

    return upsampled;
  }

  /**
   * Estimate data loss when converting between tiers.
   * Returns metrics: precision, information retained, etc.
   */
  static estimateConversionLoss(sourceState, conversionPath) {
    // conversionPath: e.g., 'particles->fields', 'fields->plates', etc.

    const metrics = {
      type: conversionPath,
      informationRetained: 0,
      warnings: []
    };

    switch (conversionPath) {
      case 'particles->fields':
        // Information loss from aggregation
        // Each field cell represents ~(cellSize)² particles
        const cellArea = (sourceState.cellSize || 16) ** 2;
        metrics.informationRetained = Math.min(1, 1 / cellArea);
        metrics.warnings.push('Spatial detail aggregated; individual particle behavior lost');
        break;

      case 'fields->particles':
        // Reconstruction assumes homogeneous cells
        metrics.informationRetained = 0.6; // Rough estimate
        metrics.warnings.push('Reconstructed particles are probabilistic; exact state not recoverable');
        break;

      case 'fields->plates':
        // Large loss: from fine fields to coarse tectonic plates
        metrics.informationRetained = 0.2;
        metrics.warnings.push('Plate abstraction loses local erosion/deposition details');
        metrics.warnings.push('Velocity computed from gradients; precise flow lost');
        break;

      case 'plates->fields':
        // Recovery from plates shows general structure but not fine detail
        metrics.informationRetained = 0.4;
        metrics.warnings.push('Plate projection is generalized; fine structures reconstructed');
        break;

      default:
        metrics.informationRetained = 0;
        metrics.warnings.push('Unknown conversion path');
    }

    return metrics;
  }
}
