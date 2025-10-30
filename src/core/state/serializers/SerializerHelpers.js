//
// Misc helpers used by serializers (downsample/upsample and loss estimation).
//

/**
 * Merge similar adjacent cells to reduce field complexity.
 * @param {Object} fields - Field object with width, height, cellSize, elevation, material, climate
 * @param {number} factor - Downsample factor (integer)
 * @returns {Object} simplified fields
 */
export function simplifyFields(fields, factor = 2) {
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
      let elevSum = 0,
        sandSum = 0,
        soilSum = 0,
        graniteSum = 0,
        basaltSum = 0;
      let tempSum = 0,
        precipSum = 0;
      let count = 0;

      const y0 = ny * factor;
      const x0 = nx * factor;

      for (let dy = 0; dy < factor; dy++) {
        for (let dx = 0; dx < factor; dx++) {
          const ox = x0 + dx;
          const oy = y0 + dy;
          if (ox < fields.width && oy < fields.height) {
            const idx = oy * fields.width + ox;
            elevSum += fields.elevation[idx] || 0;
            sandSum += (fields.material?.sand?.[idx]) || 0;
            soilSum += (fields.material?.soil?.[idx]) || 0;
            graniteSum += (fields.material?.granite?.[idx]) || 0;
            basaltSum += (fields.material?.basalt?.[idx]) || 0;
            tempSum += (fields.climate?.temperature?.[idx]) || 0;
            precipSum += (fields.climate?.precipitation?.[idx]) || 0;
            count++;
          }
        }
      }

      const nIdx = ny * newWidth + nx;
      if (count === 0) {
        simplified.elevation[nIdx] = 0;
        simplified.material.sand[nIdx] = 0;
        simplified.material.soil[nIdx] = 0;
        simplified.material.granite[nIdx] = 0;
        simplified.material.basalt[nIdx] = 0;
        simplified.climate.temperature[nIdx] = 0;
        simplified.climate.precipitation[nIdx] = 0;
      } else {
        simplified.elevation[nIdx] = elevSum / count;
        simplified.material.sand[nIdx] = sandSum / count;
        simplified.material.soil[nIdx] = soilSum / count;
        simplified.material.granite[nIdx] = graniteSum / count;
        simplified.material.basalt[nIdx] = basaltSum / count;
        simplified.climate.temperature[nIdx] = tempSum / count;
        simplified.climate.precipitation[nIdx] = precipSum / count;
      }
    }
  }

  return simplified;
}

/**
 * Upsample a coarse field into a finer resolution (nearest-neighbor approach).
 * @param {Object} fields - Coarse field object
 * @param {number} factor - Upsample factor
 * @returns {Object} upsampled fields
 */
export function upsampleFields(fields, factor = 2) {
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

        upsampled.elevation[nIdx] = fields.elevation[sIdx] || 0;
        upsampled.material.sand[nIdx] = (fields.material?.sand?.[sIdx]) || 0;
        upsampled.material.soil[nIdx] = (fields.material?.soil?.[sIdx]) || 0;
        upsampled.material.granite[nIdx] = (fields.material?.granite?.[sIdx]) || 0;
        upsampled.material.basalt[nIdx] = (fields.material?.basalt?.[sIdx]) || 0;
        upsampled.climate.temperature[nIdx] = (fields.climate?.temperature?.[sIdx]) || 0;
        upsampled.climate.precipitation[nIdx] = (fields.climate?.precipitation?.[sIdx]) || 0;
        upsampled.climate.windDirX[nIdx] = (fields.climate?.windDirX?.[sIdx]) || 0;
        upsampled.climate.windDirY[nIdx] = (fields.climate?.windDirY?.[sIdx]) || 0;
      }
    }
  }

  return upsampled;
}

/**
 * Estimate information retained/loss for conversions.
 * Lightweight heuristic for UI diagnostics.
 * @param {Object} sourceState - source state (may include cellSize)
 * @param {string} conversionPath - e.g. 'particles->fields' or 'fields->plates'
 * @returns {Object} metrics { type, informationRetained: 0..1, warnings: [] }
 */
export function estimateConversionLoss(sourceState, conversionPath) {
  const metrics = {
    type: conversionPath,
    informationRetained: 0,
    warnings: []
  };

  switch (conversionPath) {
    case 'particles->fields': {
      const cellArea = (sourceState.cellSize || 16) ** 2;
      // Rough heuristic: more area per sample → less retained info
      metrics.informationRetained = Math.min(1, 1 / cellArea);
      metrics.warnings.push('Spatial detail aggregated; individual particle behavior lost');
      break;
    }
    case 'fields->particles':
      metrics.informationRetained = 0.6;
      metrics.warnings.push('Reconstructed particles are probabilistic; exact state not recoverable');
      break;
    case 'fields->plates':
      metrics.informationRetained = 0.2;
      metrics.warnings.push('Plate abstraction loses local erosion/deposition details');
      metrics.warnings.push('Velocity computed from gradients; precise flow lost');
      break;
    case 'plates->fields':
      metrics.informationRetained = 0.4;
      metrics.warnings.push('Plate projection is generalized; fine structures reconstructed');
      break;
    default:
      metrics.informationRetained = 0;
      metrics.warnings.push('Unknown conversion path');
  }

  return metrics;
}

