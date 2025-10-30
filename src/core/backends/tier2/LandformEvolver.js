/**
 * LandformEvolver
 * Handles large-scale, long-term landscape changes:
 * - Valley deepening through focused erosion
 * - Mountain peak rounding
 * - Delta formation and sedimentation patterns
 * - Coastal shaping and marine terraces
 */
export class LandformEvolver {
  constructor(fields) {
    this.fields = fields;
    this.valleyHistory = new Map(); // Track valley formation over time
  }

  update(deltaTime) {
    const W = this.fields.materialField.width;
    const H = this.fields.materialField.height;

    // 1. Identify and deepen valleys
    this.deepenValleys(deltaTime);

    // 2. Round mountain peaks through preferential erosion
    this.roundPeaks(deltaTime);

    // 3. Handle delta/fan formation in basins
    this.formDeltas(deltaTime);

    // 4. Shape coastlines if adjacent to water
    this.shapeCoastlines(deltaTime);

    // 5. Isostatic adjustment (very slow)
    this.applyIsostasis(deltaTime);
  }

  /**
   * Deepens valleys by increasing erosion in flow-concentrated zones.
   */
  deepenValleys(deltaTime) {
    const W = this.fields.materialField.width;
    const H = this.fields.materialField.height;
    const flowConcentration = new Float32Array(this.fields.materialField.size);

    // Count convergent flow paths into each cell
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const idx = this.fields.materialField.getIndex(x, y);
        
        // Check how many neighbors flow into this cell
        let inflow = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const nx = x + dx, ny = y + dy;
            if (nx < 0 || nx >= W || ny < 0 || ny >= H) continue;
            
            const nIdx = this.fields.materialField.getIndex(nx, ny);
            // Check if neighbor flows toward current cell
            const nFlowX = this.fields.elevationField.flowDirX[nIdx];
            const nFlowY = this.fields.elevationField.flowDirY[nIdx];
            const flowingIn = (Math.abs(nFlowX - (-dx / Math.sqrt(dx*dx + dy*dy))) < 0.1 &&
                              Math.abs(nFlowY - (-dy / Math.sqrt(dx*dx + dy*dy))) < 0.1);
            if (flowingIn) inflow++;
          }
        }
        
        flowConcentration[idx] = inflow;
      }
    }

    // Deepen high-flow cells
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const idx = this.fields.materialField.getIndex(x, y);
        const concentration = flowConcentration[idx];
        
        // Strong valley effect if many cells flow through here
        if (concentration >= 4) {
          const deepeningRate = Math.min(0.02, concentration * 0.004);
          this.fields.elevationField.adjustElevation(x, y, -deepeningRate * deltaTime);
          
          // Remove some soft material to help maintain valley
          if (Math.random() < 0.3) {
            this.fields.materialField.removeMaterial(x, y, 'soil', deepeningRate * 0.1);
          }
        }
      }
    }
  }

  /**
   * Rounds mountain peaks through preferential erosion of high points.
   */
  roundPeaks(deltaTime) {
    const W = this.fields.materialField.width;
    const H = this.fields.materialField.height;

    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const idx = this.fields.materialField.getIndex(x, y);
        const elevation = this.fields.elevationField.getElevation(x, y);
        
        // Check neighbors
        let neighborSum = 0;
        let neighborCount = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const nx = x + dx, ny = y + dy;
            if (nx >= 0 && nx < W && ny >= 0 && ny < H) {
              const nElev = this.fields.elevationField.getElevation(nx, ny);
              neighborSum += nElev;
              neighborCount++;
            }
          }
        }
        
        const avgNeighbor = neighborCount > 0 ? neighborSum / neighborCount : elevation;
        const heightAboveAvg = elevation - avgNeighbor;
        
        // Erode high peaks faster
        if (heightAboveAvg > 0.1) {
          const erosionRate = heightAboveAvg * 0.01 * deltaTime;
          this.fields.elevationField.adjustElevation(x, y, -erosionRate);
          
          // Increase steepness of erosion on very high peaks
          if (heightAboveAvg > 0.3) {
            this.fields.elevationField.adjustElevation(x, y, -erosionRate * 0.5);
          }
        }
      }
    }
  }

  /**
   * Forms deltas and alluvial fans in basins by concentrating sediment deposition.
   */
  formDeltas(deltaTime) {
    const W = this.fields.materialField.width;
    const H = this.fields.materialField.height;

    // Identify sinks (local minima) where sediment accumulates
    for (let y = 1; y < H - 1; y++) {
      for (let x = 1; x < W - 1; x++) {
        const idx = this.fields.materialField.getIndex(x, y);
        const elev = this.fields.elevationField.getElevation(x, y);
        
        let isSink = true;
        let minNeighbor = elev;
        
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const nElev = this.fields.elevationField.getElevation(x + dx, y + dy);
            if (nElev < elev) {
              isSink = false;
              minNeighbor = Math.min(minNeighbor, nElev);
            }
          }
        }
        
        // If it's a sink, deposit extra sediment (delta formation)
        if (isSink && elev < 0.5) { // Prefer low areas
          const depositRate = (0.5 - elev) * 0.002 * deltaTime;
          this.fields.materialField.addMaterial(x, y, 'sand', depositRate * 0.6);
          this.fields.materialField.addMaterial(x, y, 'soil', depositRate * 0.4);
        }
      }
    }
  }

  /**
   * Shapes coastlines and creates marine terraces.
   */
  shapeCoastlines(deltaTime) {
    // This would require knowing where water is (ocean/sea level)
    // For now, simplified: assume cells below certain elevation are "coastal"
    const waterLevel = 0.3; // Normalized
    
    const W = this.fields.materialField.width;
    const H = this.fields.materialField.height;

    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const idx = this.fields.materialField.getIndex(x, y);
        const elev = this.fields.elevationField.getElevation(x, y);
        
        // Check if near coastline
        let nearWater = false;
        for (let dy = -2; dy <= 2; dy++) {
          for (let dx = -2; dx <= 2; dx++) {
            const nx = x + dx, ny = y + dy;
            if (nx >= 0 && nx < W && ny >= 0 && ny < H) {
              if (this.fields.elevationField.getElevation(nx, ny) < waterLevel) {
                nearWater = true;
                break;
              }
            }
          }
          if (nearWater) break;
        }
        
        // If coastal and above water, wave action erodes
        if (nearWater && elev > waterLevel && elev < waterLevel + 0.15) {
          const erosionRate = 0.002 * deltaTime;
          this.fields.elevationField.adjustElevation(x, y, -erosionRate);
          
          // Create marine terrace (slight flattening)
          if (Math.random() < 0.3) {
            this.fields.elevationField.adjustElevation(x, y, -0.001);
          }
        }
      }
    }
  }

  /**
   * Applies isostatic adjustment: earth crust floats on mantle.
   * Areas with large sediment load sink; areas that erode rise.
   */
  applyIsostasis(deltaTime) {
    const W = this.fields.materialField.width;
    const H = this.fields.materialField.height;

    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const idx = this.fields.materialField.getIndex(x, y);
        
        // Sediment load causes subsidence
        const sediment = this.fields.elevationField.sedimentDepth[idx];
        if (sediment > 0.1) {
          // Heavy load causes slow subsidence
          const subsidenceRate = sediment * 0.0001 * deltaTime;
          this.fields.elevationField.baseElevation[idx] -= subsidenceRate;
        }
        
        // Erosion of deep crust causes uplift (isostatic rebound)
        const basalt = this.fields.materialField.getMaterialRatio(x, y, 'basalt');
        const granite = this.fields.materialField.getMaterialRatio(x, y, 'granite');
        const denseRock = basalt + granite;
        
        if (denseRock < 0.3) {
          // Low density at depth (eroded away) causes uplift
          const reboundRate = (0.3 - denseRock) * 0.00005 * deltaTime;
          this.fields.elevationField.baseElevation[idx] += reboundRate;
        }
      }
    }
  }
}