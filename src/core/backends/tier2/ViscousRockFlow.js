/**
 * ViscousRockFlow
 * Models rock as an extremely viscous fluid at geological timescales.
 * Rock viscosity: ~10^20 Pa·s
 * This creates the "on a large enough timescale, everything is a liquid" effect.
 */
export class ViscousRockFlow {
  constructor(fields) {
    this.fields = fields;
    
    // Rock viscosity (in arbitrary units relative to each other)
    // Higher = flows more slowly
    this.rockViscosity = {
      granite: 1000,  // Stiff, resists flow
      basalt: 800,    // Slightly more fluid than granite
      mantle: 500     // More fluid than surface rocks
    };
    
    // Density (affects pressure)
    this.rockDensity = {
      granite: 2.7,
      basalt: 3.0,
      mantle: 3.3
    };
  }

  update(deltaTime) {
    const W = this.fields.materialField.width;
    const H = this.fields.materialField.height;
    const g = 9.81; // Gravity constant

    // Calculate pressure at each cell from overlying material
    const pressure = new Float32Array(this.fields.materialField.size);
    
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const idx = this.fields.materialField.getIndex(x, y);
        
        // Pressure = sum of weight of all material above
        // P = ρgh where h is depth
        let weightAbove = 0;
        for (let dy = 0; dy < y; dy++) {
          const upIdx = this.fields.materialField.getIndex(x, dy);
          const upElev = this.fields.elevationField.getElevation(x, dy);
          const mat = this.fields.materialField.getDominantType(x, dy);
          const density = this.getRockDensity(mat);
          weightAbove += density;
        }
        
        // Current cell depth factor
        const elev = this.fields.elevationField.getElevation(x, y);
        const depthFactor = Math.max(0, (y / H) - (elev / 2));
        
        pressure[idx] = (weightAbove + depthFactor * 100) * g;
      }
    }

    // Calculate pressure gradients and flow
    const maxViscousFlow = 0.0005; // Very small per timestep
    
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const idx = this.fields.materialField.getIndex(x, y);
        const currentPressure = pressure[idx];
        const mat = this.fields.materialField.getDominantType(x, y);
        const viscosity = this.getRockViscosity(mat);
        
        // Find direction of maximum pressure gradient (pressure flows away from high pressure)
        let maxGradient = 0;
        let bestDx = 0, bestDy = 0;
        
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const nx = x + dx, ny = y + dy;
            if (nx < 0 || nx >= W || ny < 0 || ny >= H) continue;
            
            const nIdx = this.fields.materialField.getIndex(nx, ny);
            const nPressure = pressure[nIdx];
            const gradient = (currentPressure - nPressure) / (Math.sqrt(dx*dx + dy*dy) + 0.1);
            
            if (Math.abs(gradient) > maxGradient) {
              maxGradient = Math.abs(gradient);
              bestDx = Math.sign(dx);
              bestDy = Math.sign(dy);
            }
          }
        }
        
        // Flow velocity from pressure gradient and viscosity
        // v = -∇P / η (simplified)
        const flowVelocity = (maxGradient / viscosity) * maxViscousFlow * deltaTime;
        
        if (flowVelocity > 0.00001) {
          const nx = x + bestDx;
          const ny = y + bestDy;
          
          if (nx >= 0 && nx < W && ny >= 0 && ny < H) {
            const nIdx = this.fields.materialField.getIndex(nx, ny);
            const nMat = this.fields.materialField.getDominantType(nx, ny);
            
            // Only flow if target is lower density (lighter material flows up toward pressure relief)
            const targetDensity = this.getRockDensity(nMat);
            const currentDensity = this.getRockDensity(mat);
            
            if (currentDensity > targetDensity || flowVelocity > 0.001) {
              // Transfer small amount of material
              const transferAmount = flowVelocity * 0.01;
              
              // Move the dominant material
              const available = this.fields.materialField.getMaterialRatio(x, y, mat);
              if (available > transferAmount) {
                this.fields.materialField.removeMaterial(x, y, mat, transferAmount);
                this.fields.materialField.addMaterial(nx, ny, mat, transferAmount);
              }
            }
          }
        }
        
        // Cavern collapse: if cavern roof (low density above high density) is unstable, collapse it
        if (y > 0) {
          const aboveIdx = this.fields.materialField.getIndex(x, y - 1);
          const aboveMat = this.fields.materialField.getDominantType(x, y - 1);
          const aboveDensity = this.getRockDensity(aboveMat);
          const currentDensity = this.getRockDensity(mat);
          
          // Unstable roof: light material over heavy material
          if (aboveDensity < currentDensity - 0.2 && Math.random() < 0.0001 * deltaTime) {
            // Slowly sag the roof
            this.fields.elevationField.adjustElevation(x, y - 1, -0.0001 * deltaTime);
            this.fields.elevationField.adjustElevation(x, y, 0.0001 * deltaTime);
          }
        }
      }
    }

    // Recalculate flow network after material redistribution
    this.fields.elevationField.calculateFlowNetwork();
  }

  getRockViscosity(material) {
    return this.rockViscosity[material] || 1000;
  }

  getRockDensity(material) {
    return this.rockDensity[material] || 2.7;
  }
}