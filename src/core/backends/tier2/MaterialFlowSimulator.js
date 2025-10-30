/**
 * MaterialFlowSimulator
 * Routes eroded material downslope and deposits it in appropriate locations.
 * Different materials travel different distances before settling.
 */
export class MaterialFlowSimulator {
  constructor(fields) {
    this.fields = fields;
    
    // Transport distance (in cells) before settling
    // Based on material density and settling velocity
    this.transportDistances = {
      sand: 8,      // Fine sand travels moderate distance
      soil: 4,      // Heavier soil settles quicker
      granite: 1,   // Heavy fragments settle quickly
      basalt: 2     // Basalt fragments travel a bit
    };
  }

  update(deltaTime) {
    const W = this.fields.materialField.width;
    const H = this.fields.materialField.height;
    
    // Track sediment being transported
    const transportBuffer = {
      sand: new Float32Array(this.fields.materialField.size),
      soil: new Float32Array(this.fields.materialField.size),
      granite: new Float32Array(this.fields.materialField.size),
      basalt: new Float32Array(this.fields.materialField.size)
    };

    // First pass: extract eroded material
    const erosionMap = this.fields.erosion.update(deltaTime);
    
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const idx = this.fields.materialField.getIndex(x, y);
        if (idx < 0) continue;

        const erosion = erosionMap[idx];
        if (erosion <= 0) continue;

        // Erode material proportional to composition
        const materials = ['sand', 'soil', 'granite', 'basalt'];
        for (const mat of materials) {
          const ratio = this.fields.materialField.getMaterialRatio(x, y, mat);
          const erodedAmount = erosion * ratio;
          
          if (erodedAmount > 0) {
            this.fields.materialField.removeMaterial(x, y, mat, erodedAmount);
            transportBuffer[mat][idx] += erodedAmount;
          }
        }
        
        // Lower elevation after erosion
        this.fields.elevationField.adjustElevation(x, y, -erosion);
      }
    }

    // Second pass: transport and deposit material downslope
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const idx = this.fields.materialField.getIndex(x, y);
        if (idx < 0) continue;

        // For each material type, move it downslope
        const materials = ['sand', 'soil', 'granite', 'basalt'];
        
        for (const mat of materials) {
          let transported = transportBuffer[mat][idx];
          if (transported <= 0) continue;

          const slope = this.fields.elevationField.getSlope(x, y);
          const flowDir = this.fields.elevationField.flowDirX[idx];
          const flowDirY = this.fields.elevationField.flowDirY[idx];
          const maxDistance = this.transportDistances[mat];
          
          // Follow flow network for up to maxDistance cells
          let currentX = x;
          let currentY = y;
          let distanceTraveled = 0;
          let remainingLoad = transported;

          while (remainingLoad > 0 && distanceTraveled < maxDistance) {
            // Calculate next position along flow
            const nextX = Math.round(currentX + flowDir);
            const nextY = Math.round(currentY + flowDirY);

            // Check bounds
            if (nextX < 0 || nextX >= W || nextY < 0 || nextY >= H) break;

            const nextIdx = this.fields.materialField.getIndex(nextX, nextY);
            const nextSlope = this.fields.elevationField.getSlope(nextX, nextY);
            
            // Check if slope is still steep enough to carry material
            const slopeDegrees = Math.atan(nextSlope.mag) * (180 / Math.PI);
            const angleOfRepose = this.getAngleOfRepose(mat);

            if (slopeDegrees < angleOfRepose) {
              // Slope too gentle, deposit material here
              const depositAmount = remainingLoad * 0.3; // Deposit 30% per gentle cell
              this.fields.materialField.addMaterial(nextX, nextY, mat, depositAmount);
              this.fields.elevationField.adjustElevation(nextX, nextY, depositAmount * 0.1);
              remainingLoad -= depositAmount;
            }

            currentX = nextX;
            currentY = nextY;
            distanceTraveled++;

            // Gradual settling over distance (more for heavy materials)
            const settlingRate = (1.0 - (distanceTraveled / maxDistance)) * 0.05;
            const settled = remainingLoad * settlingRate;
            if (settled > 0) {
              this.fields.materialField.addMaterial(currentX, currentY, mat, settled);
              this.fields.elevationField.adjustElevation(currentX, currentY, settled * 0.1);
              remainingLoad -= settled;
            }
          }

          // Deposit remaining load at final location
          if (remainingLoad > 0 && currentX >= 0 && currentX < W && currentY >= 0 && currentY < H) {
            this.fields.materialField.addMaterial(currentX, currentY, mat, remainingLoad);
            this.fields.elevationField.adjustElevation(currentX, currentY, remainingLoad * 0.1);
          }
        }
      }
    }

    // Recalculate flow network after elevation changes
    this.fields.elevationField.calculateFlowNetwork();
  }

  getAngleOfRepose(material) {
    const angles = {
      granite: 35,
      basalt: 35,
      soil: 30,
      sand: 32
    };
    return angles[material] || 30;
  }
}