import { TEMPERATURE } from '../../utils/Constants.js';

export class ClimateField {
  constructor(width, height, cellSize = 32) {
    this.width = width;
    this.height = height;
    this.cellSize = cellSize;
    this.size = width * height;

    this.precipitation = new Float32Array(this.size); // mm/year
    this.temperature = new Float32Array(this.size);   // °C average
    this.windDirX = new Float32Array(this.size);      // prevailing wind unit vector
    this.windDirY = new Float32Array(this.size);
    this.windStrength = new Float32Array(this.size);  // 0..1
    this.seasonality = new Float32Array(this.size);   // amplitude 0..1

    this.reset();
  }

  reset() {
    this.precipitation.fill(600); // modest baseline rainfall
    this.temperature.fill(TEMPERATURE.AMBIENT);
    for (let i = 0; i < this.size; i++) {
      this.windDirX[i] = 1;  // default eastward
      this.windDirY[i] = 0;
      this.windStrength[i] = 0.3;
      this.seasonality[i] = 0.2;
    }
  }

  getIndex(x, y) {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return -1;
    return y * this.width + x;
  }

  getPrecipitation(x, y) {
    const idx = this.getIndex(x, y);
    if (idx < 0) return 0;
    return this.precipitation[idx];
  }

  getTemperature(x, y) {
    const idx = this.getIndex(x, y);
    if (idx < 0) return TEMPERATURE.AMBIENT;
    return this.temperature[idx];
  }

  updateClimate(orography) {
    // Recompute climate based on elevation and simple orographic effects.
    const W = this.width, H = this.height;
    const lapseRate = 6.5 / 1000; // °C per meter (if units roughly meters)
    const elevAt = (cx, cy) => {
      if (!orography) return 0;
      if (cx < 0 || cy < 0 || cx >= orography.width || cy >= orography.height) return 0;
      return orography.getElevation(cx, cy);
    };

    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const idx = this.getIndex(x, y);

        // Base temp adjusted by elevation via lapse rate
        const elevation = elevAt(x, y);
        const baseTemp = TEMPERATURE.AMBIENT - elevation * lapseRate;
        this.temperature[idx] = baseTemp;

        // Orographic precipitation: increase on windward slopes, decrease on leeward
        const wx = this.windDirX[idx], wy = this.windDirY[idx];
        const upX = x - Math.sign(wx), upY = y - Math.sign(wy);
        const downX = x + Math.sign(wx), downY = y + Math.sign(wy);

        const eUp = elevAt(upX, upY);
        const eDown = elevAt(downX, downY);
        const slopeFacingWind = Math.max(0, elevation - eUp);
        const slopeLeeward = Math.max(0, eDown - elevation);

        const orographicBoost = slopeFacingWind * 0.6; // mm per unit elevation difference
        const rainShadow = slopeLeeward * 0.4;

        const windFactor = 1 + this.windStrength[idx] * 0.8;
        const baseline = 600;

        let precip = baseline * windFactor + orographicBoost - rainShadow;
        precip = Math.max(50, Math.min(3000, precip));
        this.precipitation[idx] = precip;

        // Slight seasonal variability imprint on temperature (could be used by Tier2 processes)
        const seasonAmp = this.seasonality[idx];
        this.temperature[idx] = this.temperature[idx] * (1 - seasonAmp * 0.05); // dampen average slightly by seasonality
      }
    }
  }
}