/**
 * GlacialCycles
 * Simulates long-term glaciation cycles with:
 * - Temperature oscillation (~100,000 year Milankovitch cycle)
 * - Glacier formation at high latitudes/elevations when cold
 * - Deep erosion carving U-shaped valleys
 * - Moraine deposition when glaciers melt
 * - Feedback effects (albedo increase, isostatic effects)
 *
 * NOTE: This implementation uses FieldGrid (Tier3's field representation).
 * FieldGrid exposes elevation as an array (0..1) and getIndex(x,y). Elevation
 * helper functions are implemented here to avoid depending on ElevationField APIs.
 */
export class GlacialCycles {
  constructor(fields, config = {}) {
    this.fields = fields;

    // Temperature cycle parameters
    this.baselineTemperature = config.baselineTemperature ?? 15;
    this.cycleLength = config.cycleLength ?? 100000; // years per full cycle
    this.amplitudeRange = config.amplitudeRange ?? 8; // ±°C variation
    this.currentPhase = 0; // 0..1 through cycle

    // Glacier parameters
    this.snowLineElevation = config.snowLineElevation ?? 0.4; // normalized elevation
    this.glacierErosionRate = config.glacierErosionRate ?? 0.003;

    // Ensure glacierThickness size matches the underlying elevation array
    const size = this.fields.elevationField.size || (this.fields.elevationField.width * this.fields.elevationField.height);
    this.glacierThickness = new Float32Array(size); // Track ice thickness
    this.glacierHistory = new Map(); // For visual/debug feedback

    // Global state
    this.globalTemperature = this.baselineTemperature;
    this.iceVolume = 0; // Aggregate ice present
    this.seaLevelOffset = 0; // Ice sheet effect on sea level

    // Timing
    this.simulationTime = 0;
    this.lastGlacierAdvanceTime = -1000000;
    this.lastGlacierRetreatTime = -1000000;
  }

  // --- Helpers using FieldGrid API (elevation array + getIndex) ---

  _elevationAt(x, y) {
    const idx = this.fields.elevationField.getIndex(x, y);
    if (idx < 0) return 0;
    // FieldGrid.elevation is normalized 0..1
    return this.fields.elevationField.elevation[idx];
  }

  _setElevationAt(x, y, delta) {
    const idx = this.fields.elevationField.getIndex(x, y);
    if (idx < 0) return;
    // Adjust elevation conservatively
    this.fields.elevationField.elevation[idx] = Math.max(0, Math.min(1, this.fields.elevationField.elevation[idx] + delta));
  }

  _getSlopeAndFlowDir(x, y) {
    // Approximate slope magnitude and a simple flow direction (steepest descent neighbor).
    const W = this.fields.elevationField.width;
    const H = this.fields.elevationField.height;
    const center = this._elevationAt(x, y);
    let bestDrop = 0, bestDx = 0, bestDy = 0;
    let gx = 0, gy = 0;

    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || nx >= W || ny < 0 || ny >= H) continue;
        const n = this._elevationAt(nx, ny);
        const drop = center - n;
        if (drop > bestDrop) { bestDrop = drop; bestDx = dx; bestDy = dy; }
        gx += (n - center) * dx;
        gy += (n - center) * dy;
      }
    }

    const gMag = Math.sqrt(gx * gx + gy * gy);
    const slope = { mag: gMag, dx: gMag > 0 ? gx / gMag : 0, dy: gMag > 0 ? gy / gMag : 0 };
    const flowDir = bestDrop > 0 ? { x: bestDx / Math.sqrt(bestDx * bestDx + bestDy * bestDy), y: bestDy / Math.sqrt(bestDx * bestDx + bestDy * bestDy) } : { x: 0, y: 0 };

    return { slope, flowDir };
  }

  // --- Core update functions ---

  /**
   * Update glacial system each timestep.
   */
  update(deltaTime) {
    this.simulationTime += deltaTime;

    // Update global temperature based on cycle
    this.updateTemperatureCycle(deltaTime);

    // Detect advance/retreat transitions
    this.updateGlacialState(deltaTime);

    // Apply glacier erosion and deposition
    this.applyGlacialProcesses(deltaTime);

    // Update sea level based on ice volume
    this.updateSeaLevel(deltaTime);
  }

  /**
   * Oscillate global temperature on Milankovitch cycles.
   * Uses sinusoidal variation with superimposed random weather noise.
   */
  updateTemperatureCycle(deltaTime) {
    // Phase advance through cycle
    this.currentPhase = (this.simulationTime % this.cycleLength) / this.cycleLength;

    // Smooth sinusoidal oscillation
    const cycleTemp = Math.sin(this.currentPhase * Math.PI * 2 - Math.PI / 2) * this.amplitudeRange;

    // Add small stochastic weather perturbations
    const weatherNoise = (Math.random() - 0.5) * 2 * (this.amplitudeRange * 0.1);

    this.globalTemperature = this.baselineTemperature + cycleTemp + weatherNoise;
  }

  /**
   * Detect when glaciation should advance or retreat.
   * Advance: cold period begins. Retreat: warming begins.
   */
  updateGlacialState(deltaTime) {
    const coldThreshold = this.baselineTemperature - this.amplitudeRange * 0.5;
    const warmThreshold = this.baselineTemperature + this.amplitudeRange * 0.3;

    const timeThreshold = 30000; // Don't cycle too frequently

    if (this.globalTemperature < coldThreshold &&
        this.simulationTime - this.lastGlacierAdvanceTime > timeThreshold) {
      this.advanceGlaciers();
      this.lastGlacierAdvanceTime = this.simulationTime;
    }

    if (this.globalTemperature > warmThreshold &&
        this.simulationTime - this.lastGlacierRetreatTime > timeThreshold) {
      this.retreatGlaciers();
      this.lastGlacierRetreatTime = this.simulationTime;
    }
  }

  /**
   * Advance glaciers during cold periods.
   */
  advanceGlaciers() {
    const W = this.fields.elevationField.width;
    const H = this.fields.elevationField.height;

    // Adjust snowline lower as global temperature drops
    const tempDelta = this.globalTemperature - this.baselineTemperature;
    const snowlineAdjustment = tempDelta * 0.02; // 1% elevation per °C
    const activeSnoLine = Math.max(0.1, this.snowLineElevation - snowlineAdjustment);

    // Form/thicken glaciers above snowline
    for (let y = 0; y < H; y++) {
      // Higher latitude = lower snowline
      const lat = y / H;
      const latSnowLine = activeSnoLine - lat * 0.15; // Polar regions colder

      for (let x = 0; x < W; x++) {
        const idx = this.fields.elevationField.getIndex(x, y);
        if (idx < 0) continue;
        const elev = this._elevationAt(x, y);

        // Accumulate ice if above adjusted snowline
        if (elev > latSnowLine) {
          const accumRate = Math.max(0, elev - latSnowLine) * 0.02;
          this.glacierThickness[idx] = Math.min(this.glacierThickness[idx] + accumRate, 0.2);
        }
      }
    }
  }

  /**
   * Retreat glaciers during warm periods.
   */
  retreatGlaciers() {
    const W = this.fields.elevationField.width;
    const H = this.fields.elevationField.height;

    // Melt glaciers, especially at lower elevations
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const idx = this.fields.elevationField.getIndex(x, y);
        if (idx < 0) continue;
        const elev = this._elevationAt(x, y);

        if (this.glacierThickness[idx] > 0) {
          // Melt faster at low elevation, slower at high elevation
          const meltRate = Math.max(0.001, 0.02 * (1 - Math.min(1, elev / 0.8)));
          const melted = Math.min(this.glacierThickness[idx], meltRate);

          this.glacierThickness[idx] -= melted;

          // Deposit moraine (glacial till) as ice melts
          if (melted > 0) {
            this.fields.materialField.addMaterial(x, y, 'soil', melted * 0.8);
            this.fields.materialField.addMaterial(x, y, 'sand', melted * 0.2);
          }
        }
      }
    }
  }

  /**
   * Apply glacier erosion (only when glaciers present).
   * Glaciers carve deep U-shaped valleys and pluck bedrock.
   */
  applyGlacialProcesses(deltaTime) {
    const W = this.fields.elevationField.width;
    const H = this.fields.elevationField.height;

    for (let y = 1; y < H - 1; y++) {
      for (let x = 1; x < W - 1; x++) {
        const idx = this.fields.elevationField.getIndex(x, y);
        if (idx < 0) continue;
        const iceThick = this.glacierThickness[idx];

        if (iceThick <= 0) continue; // No ice, skip

        // Glacier erodes proportional to thickness and elevation
        const elev = this._elevationAt(x, y);
        const erosionStrength = iceThick * this.glacierErosionRate * deltaTime;

        // Approximate slope and flow direction
        const { slope, flowDir } = this._getSlopeAndFlowDir(x, y);

        // Carve valley: lower elevation where glacier flows
        this._setElevationAt(x, y, -erosionStrength);

        // Widen valley: depress nearby cells
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const nx = x + dx, ny = y + dy;
            const nIdx = this.fields.elevationField.getIndex(nx, ny);
            if (nIdx < 0) continue;
            // Gentler erosion to sides (U-shaped profile)
            this._setElevationAt(nx, ny, -erosionStrength * 0.4);
          }
        }

        // Pluck and transport bedrock
        if (Math.random() < iceThick * 0.1) {
          // Remove some material (represent quarrying)
          const mat = this.fields.materialField.getDominantType(x, y);
          if (mat) {
            this.fields.materialField.removeMaterial(x, y, mat, erosionStrength * 0.2);
          }
        }

        // Glacier flows downslope, carrying sediment (use flowDir approximation)
        const nx = Math.round(x + flowDir.x);
        const ny = Math.round(y + flowDir.y);
        if (nx > 0 && nx < W - 1 && ny > 0 && ny < H - 1) {
          const nIdx = this.fields.elevationField.getIndex(nx, ny);
          if (nIdx >= 0) {
            const transfer = iceThick * 0.05;
            this.glacierThickness[idx] -= transfer;
            this.glacierThickness[nIdx] += transfer;
          }
        }
      }
    }

    // Calculate total ice volume for sea level effects
    this.iceVolume = 0;
    for (let i = 0; i < this.glacierThickness.length; i++) {
      this.iceVolume += this.glacierThickness[i];
    }
  }

  /**
   * Update sea level based on ice volume (simplified).
   * More ice = lower sea level (water locked in ice).
   */
  updateSeaLevel(deltaTime) {
    // Sea level offset: -100 m per ice volume unit (arbitrary scale)
    this.seaLevelOffset = -this.iceVolume * 100;
  }

  /**
   * Get glacial system state for diagnostics.
   */
  getState() {
    // handle empty glacierThickness gracefully
    const maxThickness = this.glacierThickness.length ? Math.max(...this.glacierThickness) : 0;
    return {
      globalTemperature: this.globalTemperature.toFixed(2),
      cyclePhase: (this.currentPhase * 100).toFixed(1),
      iceVolume: this.iceVolume.toFixed(4),
      seaLevelOffset: this.seaLevelOffset.toFixed(1),
      maxGlacierThickness: maxThickness.toFixed(4)
    };
  }
}