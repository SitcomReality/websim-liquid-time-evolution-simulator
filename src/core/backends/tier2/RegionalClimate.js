import { TEMPERATURE } from '../../../utils/Constants.js';

/** 
 * RegionalClimate
 * Simplified atmospheric model for Tier 2:
 * - Prevailing wind patterns by latitude bands (easterlies/westerlies)
 * - Orographic effects (rain shadow, windward precipitation)
 * - Temperature gradients (latitude, elevation)
 * - Moisture accumulation over oceans and precipitation over mountains
 *
 * Operates on yearly averages; avoids per-pixel, per-frame wind computation cost.
 */
export class RegionalClimate {
  constructor(fields, config = {}) {
    this.fields = fields;
    this.W = fields.materialField.width;
    this.H = fields.materialField.height;

    // Configurable parameters
    this.waterLevel = config.waterLevel ?? 0.32; // normalized elevation threshold for "ocean"
    this.lapseRate = config.lapseRate ?? (6.5 / 1000); // °C per meter (units are arbitrary -> treated as normalized)
    this.baselinePrecipMm = config.baselinePrecipMm ?? 600;
    this.maxPrecipMm = config.maxPrecipMm ?? 3000;
    this.minPrecipMm = config.minPrecipMm ?? 50;

    // Wind strength by latitude band
    this.bandWindStrength = {
      equatorial: 0.35,   // Hadley cells trade winds
      midlat: 0.45,       // Westerlies stronger
      polar: 0.30         // Polar easterlies weaker
    };

    // Seasonality by band (amplitude)
    this.bandSeasonality = {
      equatorial: 0.15,
      midlat: 0.30,
      polar: 0.20
    };
  }

  /** 
   * Determine prevailing wind direction and band membership for a given latitude ratio (0..1).
   * Returns { vx, vy, strength, seasonality, band }
   */
  getPrevailingWind(lat) {
    // Bands: 0.0-0.25 polar (north), 0.25-0.45 mid (north), 0.45-0.55 equatorial, 0.55-0.75 mid (south), 0.75-1.0 polar (south)
    let band = 'equatorial', vx = -1, vy = 0;

    if (lat < 0.25) { // polar north: easterlies (east->west)
      band = 'polar'; vx = -1; vy = 0.1;
    } else if (lat < 0.45) { // mid-lat north: westerlies (west->east)
      band = 'midlat'; vx = 1; vy = -0.05;
    } else if (lat < 0.55) { // equatorial: easterlies (east->west)
      band = 'equatorial'; vx = -1; vy = 0;
    } else if (lat < 0.75) { // mid-lat south: westerlies (west->east)
      band = 'midlat'; vx = 1; vy = 0.05;
    } else { // polar south: easterlies (east->west)
      band = 'polar'; vx = -1; vy = -0.1;
    }

    const strength = this.bandWindStrength[band];
    const seasonality = this.bandSeasonality[band];
    return { vx, vy, strength, seasonality, band };
  }

  /** 
   * Simple moisture source check: treat low-elevation regions as "ocean".
   */
  isOceanCell(x, y) {
    const elev = this.fields.elevationField.getElevation(x, y);
    return elev <= this.waterLevel;
  }

  /** 
   * Estimate upwind moisture availability by sampling backwards along wind vector.
   * Returns 0..1 moisture factor decaying with distance from ocean source.
   */
  upwindMoisture(x, y, wind) {
    const maxSteps = 12;
    let moisture = 0;
    let cx = x, cy = y;

    const stepX = Math.sign(wind.vx);
    const stepY = Math.sign(wind.vy);

    for (let s = 0; s < maxSteps; s++) {
      cx -= stepX;
      cy -= stepY;
      if (cx < 0 || cx >= this.W || cy < 0 || cy >= this.H) break;
      if (this.isOceanCell(cx, cy)) {
        // Closer oceans provide more moisture; exponential decay by steps
        const proximity = Math.exp(-s * 0.25);
        moisture = Math.max(moisture, proximity);
        break;
      }
    }
    return moisture;
  }

  /** 
   * Orographic precipitation enhancement and rain shadow based on wind-facing slope.
   */
  orographicPrecipDelta(x, y, wind) {
    const elev = this.fields.elevationField.getElevation(x, y);

    // Sample a cell upwind and downwind to gauge slope facing wind
    const upX = x - Math.sign(wind.vx);
    const upY = y - Math.sign(wind.vy);
    const downX = x + Math.sign(wind.vx);
    const downY = y + Math.sign(wind.vy);

    const eUp = this._safeElev(upX, upY);
    const eDown = this._safeElev(downX, downY);

    const slopeFacingWind = Math.max(0, elev - eUp);
    const slopeLeeward = Math.max(0, eDown - elev);

    // Scale factors tuned for coarse fields
    const boost = slopeFacingWind * 0.6;
    const shadow = slopeLeeward * 0.4;
    return { boost, shadow };
  }

  _safeElev(x, y) {
    if (x < 0 || x >= this.W || y < 0 || y >= this.H) return 0;
    return this.fields.elevationField.getElevation(x, y);
  }

  /** 
   * Compute yearly average climate fields across the grid.
   * Updates: temperature, precipitation, windDirX/Y, windStrength, seasonality.
   */
  updateYearly(years = 1) {
    const cf = this.fields.climateField;

    for (let y = 0; y < this.H; y++) {
      const lat = y / (this.H - 1); // 0 = north pole, 1 = south pole in this grid
      const wind = this.getPrevailingWind(lat);

      for (let x = 0; x < this.W; x++) {
        const idx = cf.getIndex(x, y);

        // Base temperature: ambient modulated by latitude and elevation lapse rate
        const baseLatCooling = 18 * Math.pow(Math.abs(lat - 0.5) * 2, 1.2); // cooler toward poles
        const elev = this.fields.elevationField.getElevation(x, y);
        const elevationCooling = elev * 900 * this.lapseRate; // rough normalization to meters
        let temp = TEMPERATURE.AMBIENT - baseLatCooling - elevationCooling;

        // Oceans are milder: damp absolute temperature deviation
        if (this.isOceanCell(x, y)) {
          temp = temp * 0.7 + TEMPERATURE.AMBIENT * 0.3;
        }

        // Wind fields (unit-ish vectors + strength)
        cf.windDirX[idx] = wind.vx;
        cf.windDirY[idx] = wind.vy;
        cf.windStrength[idx] = wind.strength;

        // Seasonality amplitude by band (used elsewhere for display/effects)
        cf.seasonality[idx] = wind.seasonality;

        // Precipitation: baseline + moisture + orographic modifiers
        const moisture = this.upwindMoisture(x, y, wind);
        const { boost, shadow } = this.orographicPrecipDelta(x, y, wind);
        const windFactor = 1 + wind.strength * 0.8;

        let precip = this.baselinePrecipMm * (windFactor + 0.4 * moisture) + boost - shadow;

        // Clamp reasonable bounds
        precip = Math.max(this.minPrecipMm, Math.min(this.maxPrecipMm, precip));

        // Write fields
        cf.temperature[idx] = temp;
        cf.precipitation[idx] = precip;
      }
    }
  }
}