/**
 * Project plate/tectonic representation back to field representation (Tier 3 → Tier 2).
 */
export function platesToFields(plateState, fieldWidth, fieldHeight) {
  const fields = {
    width: fieldWidth,
    height: fieldHeight,
    cellSize: fieldWidth / (plateState.width || fieldWidth),
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

  for (let y = 0; y < fieldHeight; y++) {
    for (let x = 0; x < fieldWidth; x++) {
      const fIdx = y * fieldWidth + x;

      const scaledX = Math.floor((x / fieldWidth) * (plateState.width || 1));
      const scaledY = Math.floor((y / fieldHeight) * (plateState.height || 1));
      const pIdx = scaledY * (plateState.width || 1) + scaledX;

      if (pIdx >= 0 && pIdx < (plateIdField.length || 0)) {
        const plateId = plateIdField[pIdx];
        const plate = plates[plateId];
        const age = plateAgeField[pIdx] || 0;

        if (plate) {
          if (plate.type === 'oceanic') {
            const depthFactor = age / 200;
            fields.elevation[fIdx] = 0.3 * (1 - depthFactor * 0.5);
          } else {
            fields.elevation[fIdx] = 0.6 + Math.random() * 0.2;
          }

          if (plate.type === 'oceanic') {
            fields.material.basalt[fIdx] = 0.7;
            fields.material.granite[fIdx] = 0.2;
            fields.material.sand[fIdx] = 0.1;
          } else {
            fields.material.granite[fIdx] = 0.6;
            fields.material.sand[fIdx] = 0.3;
            fields.material.soil[fIdx] = 0.1;
          }

          const baseTempK = age > 100 ? 600 : 300;
          fields.climate.temperature[fIdx] = baseTempK;
        }
      }
    }
  }

  return fields;
}

