/**
 * ErosionCalculator
 * Calculates erosion rates per cell using a simplified RUSLE (Revised Universal Soil Loss Equation).
 * E = R × K × LS × C × P
 * Where:
 *  R = rainfall/runoff erosivity (from climate)
 *  K = soil erodibility (depends on material type)
 *  LS = slope length/steepness factor
 *  C = cover management (vegetation reduces erosion)
 *  P = support practice (we can ignore for natural systems)
 */
export class ErosionCalculator {
  constructor(fields) {
    this.fields = fields;
    
    // Material erodibility factors (K values, relative)
    // Higher = erodes more easily
    this.erodibilityFactors = {
      granite: 0.05,   // Very hard
      basalt: 0.08,    // Hard
      soil: 0.35,      // Medium
      sand: 0.25,      // Medium-low (cohesive when damp)
      vegetation: 0    // Not erodible itself
    };
    
    // Angle of repose (degrees) - angle at which material stops flowing downslope
    this.angleOfRepose = {
      granite: 35,
      basalt: 35,
      soil: 30,
      sand: 32
    };
  }

  update(deltaTime) {
    const erosionAmount = new Float32Array(this.fields.materialField.size);
    const W = this.fields.materialField.width;
    const H = this.fields.materialField.height;

    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const idx = this.fields.materialField.getIndex(x, y);
        if (idx < 0) continue;

        // Get cell properties
        const slope = this.fields.elevationField.getSlope(x, y);
        const slopeDegrees = Math.atan(slope.mag) * (180 / Math.PI);
        const precipitation = this.fields.climateField.getPrecipitation(x, y);
        const vegetation = this.fields.materialField.getMaterialRatio(x, y, 'vegetation');
        const dominantMaterial = this.fields.materialField.getDominantType(x, y);

        // R factor: rainfall erosivity (0-1000 based on precipitation)
        // Assume mm/year → relative erosivity
        const R = Math.min(1.0, precipitation / 3000);

        // K factor: soil erodibility based on dominant material
        const K = this.erodibilityFactors[dominantMaterial] || 0.1;

        // LS factor: slope length and steepness
        // LS = (λ/22.13)^m × (65.41 sin²θ + 4.56 sinθ + 0.065)
        // Simplified: assume λ = cell width (constant), use m=0.5
        const slopeRadians = slopeDegrees * (Math.PI / 180);
        const LS = Math.pow(slope.mag / 0.1, 0.5) * 
                   (65.41 * Math.sin(slopeRadians) * Math.sin(slopeRadians) + 
                    4.56 * Math.sin(slopeRadians) + 0.065);

        // C factor: cover management (vegetation protects)
        // C = exp(-a × (LAI / (1 + LAI)))
        // Simplified: C = (1 - vegetation)^2 (squared for strong protection effect)
        const C = Math.pow(1 - Math.min(1, vegetation), 2);

        // Calculate erosion (RUSLE)
        let erosionRate = R * K * LS * C * deltaTime / 1000;

        // Additional factors:
        // Precipitation runoff increases erosion
        if (precipitation > 800) erosionRate *= 1.2;

        // Steep slopes erode more
        if (slopeDegrees > 30) erosionRate *= 1.5;
        if (slopeDegrees > 45) erosionRate *= 2.0;

        // Soften very steep, erodible slopes (angle of repose effect)
        const reposeDegrees = this.angleOfRepose[dominantMaterial] || 32;
        if (slopeDegrees > reposeDegrees) {
          erosionRate *= (1 + (slopeDegrees - reposeDegrees) / 10);
        }

        // Cap erosion to prevent runaway
        const maxErosionPerYear = 0.05; // Max 5cm/year
        erosionRate = Math.min(maxErosionPerYear, erosionRate);

        erosionAmount[idx] = Math.max(0, erosionRate);
      }
    }

    return erosionAmount;
  }
}