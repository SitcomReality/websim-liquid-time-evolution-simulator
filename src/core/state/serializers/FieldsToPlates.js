/**
 * fieldsToPlates
 * Convert coarse field representation into a simple plate system abstraction.
 *
 * Inputs:
 *  - fields: { width, height, elevation, material: { sand, soil, granite, basalt }, ... }
 *  - plateResolution: approximate plate cell size (in field cells)
 *
 * Returns:
 *  {
 *    plates: [ { id, type, density, centerX, centerY, minX, maxX, minY, maxY, velocityX, velocityY, composition } ],
 *    plateIdField: Uint16Array(field.width * field.height),
 *    plateAgeField: Float32Array(field.width * field.height),
 *    numPlatesX, numPlatesY, cellSize: plateResolution, width: field.width, height: field.height
 *  }
 */
export function fieldsToPlates(fields, plateResolution = 32) {
  if (!fields || !fields.width || !fields.height) {
    throw new Error('fieldsToPlates: invalid fields input');
  }

  const fieldWidth = fields.width;
  const fieldHeight = fields.height;

  const platesX = Math.max(2, Math.floor(fieldWidth / plateResolution));
  const platesY = Math.max(2, Math.floor(fieldHeight / plateResolution));

  const plates = [];
  const plateIdField = new Uint16Array(fieldWidth * fieldHeight);
  const plateAgeField = new Float32Array(fieldWidth * fieldHeight);

  const mat = fields.material || {};
  const sandArr = mat.sand || new Float32Array(fieldWidth * fieldHeight);
  const soilArr = mat.soil || new Float32Array(fieldWidth * fieldHeight);
  const graniteArr = mat.granite || new Float32Array(fieldWidth * fieldHeight);
  const basaltArr = mat.basalt || new Float32Array(fieldWidth * fieldHeight);

  let plateIdCounter = 0;
  for (let py = 0; py < platesY; py++) {
    for (let px = 0; px < platesX; px++) {
      const startCx = Math.floor((px / platesX) * fieldWidth);
      const endCx = Math.floor(((px + 1) / platesX) * fieldWidth);
      const startCy = Math.floor((py / platesY) * fieldHeight);
      const endCy = Math.floor(((py + 1) / platesY) * fieldHeight);

      let graniteCount = 0, basaltCount = 0, sandCount = 0;
      let densitySum = 0, cellCount = 0;

      for (let cy = startCy; cy < endCy; cy++) {
        for (let cx = startCx; cx < endCx; cx++) {
          const idx = cy * fieldWidth + cx;
          cellCount++;
          graniteCount += graniteArr[idx] || 0;
          basaltCount += basaltArr[idx] || 0;
          sandCount += sandArr[idx] || 0;
          // approximate density proxy from composition
          densitySum += (graniteArr[idx] || 0) * 2.7 + (basaltArr[idx] || 0) * 3.0 + (sandArr[idx] || 0) * 1.5;
        }
      }

      const avgDensity = densitySum / Math.max(1, cellCount);
      const isOceanic = avgDensity > 2.8 || basaltCount > graniteCount;
      const plateType = isOceanic ? 'oceanic' : 'continental';

      const plate = {
        id: plateIdCounter,
        type: plateType,
        density: avgDensity,
        centerX: (startCx + endCx) / 2,
        centerY: (startCy + endCy) / 2,
        minX: startCx,
        maxX: Math.max(startCx + 1, endCx),
        minY: startCy,
        maxY: Math.max(startCy + 1, endCy),
        // initial small random velocity; will be inferred later
        velocityX: (Math.random() - 0.5) * 0.2,
        velocityY: (Math.random() - 0.5) * 0.2,
        composition: {
          granite: graniteCount / Math.max(1, cellCount),
          basalt: basaltCount / Math.max(1, cellCount),
          sand: sandCount / Math.max(1, cellCount)
        }
      };

      plates.push(plate);

      for (let cy = startCy; cy < endCy; cy++) {
        for (let cx = startCx; cx < endCx; cx++) {
          const idx = cy * fieldWidth + cx;
          plateIdField[idx] = plateIdCounter;
          plateAgeField[idx] = Math.random() * 200;
        }
      }

      plateIdCounter++;
    }
  }

  // Infer coarse plate velocities from elevation gradients
  computePlateVelocitiesFromFields(plates, fields, plateIdField);

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
 * computePlateVelocitiesFromFields
 * Estimate a simple velocity direction for each plate from elevation gradients inside plate bounds.
 */
function computePlateVelocitiesFromFields(plates, fields, plateIdField) {
  const fieldWidth = fields.width;
  const fieldHeight = fields.height;
  const elev = fields.elevation || new Float32Array(fieldWidth * fieldHeight);

  for (const plate of plates) {
    let gradX = 0, gradY = 0;
    let sampleCount = 0;

    const stepX = Math.max(1, Math.floor((plate.maxX - plate.minX) / 4));
    const stepY = Math.max(1, Math.floor((plate.maxY - plate.minY) / 4));

    for (let cy = plate.minY; cy < plate.maxY; cy += stepY) {
      for (let cx = plate.minX; cx < plate.maxX; cx += stepX) {
        if (cx > 0 && cx < fieldWidth - 1 && cy > 0 && cy < fieldHeight - 1) {
          const eLeft = elev[cy * fieldWidth + (cx - 1)];
          const eRight = elev[cy * fieldWidth + (cx + 1)];
          const eUp = elev[(cy - 1) * fieldWidth + cx];
          const eDown = elev[(cy + 1) * fieldWidth + cx];

          gradX += (eRight - eLeft) / 2;
          gradY += (eDown - eUp) / 2;
          sampleCount++;
        }
      }
    }

    if (sampleCount > 0) {
      gradX /= sampleCount;
      gradY /= sampleCount;
      const mag = Math.hypot(gradX, gradY);
      if (mag > 1e-4) {
        // Plates tend to move from high to low elevation in this heuristic
        plate.velocityX = -(gradX / mag) * 0.3;
        plate.velocityY = -(gradY / mag) * 0.3;
      }
    }
  }
}