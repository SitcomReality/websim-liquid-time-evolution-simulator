export const SIMULATION_TIERS = {
  HUMAN_SCALE: {
    key: 'HUMAN_SCALE',
    name: 'Tier 1 — Human Scale',
    speedRange: { min: 1, max: 100 }, // multiplier
    updateIntervalMs: 16,             // ~60 Hz
    systemsActive: {
      particles: true,
      unifiedFluids: true,
      thermal: true,
      airflow: true,
      biology: true,
      erosion: true,
      geological: true, // lightweight tectonic hints
      cloudsWeather: true,
      primordials: true
    },
    resolution: {
      particleResolution: 1,  // per-pixel
      thermalResolution: 4,   // matches current Thermodynamics default
      windResolution: 8,      // typically 2x thermal
      fieldResolution: null   // unused in Tier 1
    }
  },

  GEOLOGICAL_SCALE: {
    key: 'GEOLOGICAL_SCALE',
    name: 'Tier 2 — Geological Scale',
    speedRange: { min: 1000, max: 100000 },
    updateIntervalMs: 100, // coarse ticks; visuals may render less often
    systemsActive: {
      particles: false,       // particle backend suspended
      unifiedFluids: false,
      thermal: true,          // coarse field-based thermal
      airflow: true,          // coarse wind/advection
      biology: false,         // approximated/aggregated at field level
      erosion: true,          // field erosion models
      geological: true,       // landform evolution, viscous rock flow
      cloudsWeather: true,    // coarse humidity/precip in fields
      primordials: false      // optional or mapped to field influences
    },
    resolution: {
      particleResolution: null,
      thermalResolution: 8,   // coarser thermal grid
      windResolution: 16,     // coarser wind grid
      fieldResolution: 16     // N pixels per cell for material/elevation fields
    }
  },

  TECTONIC_SCALE: {
    key: 'TECTONIC_SCALE',
    name: 'Tier 3 — Tectonic Scale',
    speedRange: { min: 1000000, max: Infinity },
    updateIntervalMs: 500, // event-driven; very low frequency updates
    systemsActive: {
      particles: false,
      unifiedFluids: false,
      thermal: true,          // broad climate bands
      airflow: true,          // global circulation bands
      biology: false,         // implicit, not simulated directly
      erosion: true,          // large-scale erosion/depocenter shifts
      geological: true,       // plates, subduction, spreading, events
      cloudsWeather: true,    // storm bands, monsoons as events
      primordials: false      // disabled or represented as rare events
    },
    resolution: {
      particleResolution: null,
      thermalResolution: 16,  // very coarse
      windResolution: 32,     // very coarse winds
      fieldResolution: 32     // plate/cell scale
    }
  }
};

/**
 * Returns the tier config for a given time-scale multiplier.
 * If scale falls between tiers, prefers the higher tier for performance.
 */
export function getTierForScale(scale) {
  if (scale >= SIMULATION_TIERS.TECTONIC_SCALE.speedRange.min) {
    return SIMULATION_TIERS.TECTONIC_SCALE;
  }
  if (scale >= SIMULATION_TIERS.GEOLOGICAL_SCALE.speedRange.min &&
      scale <= SIMULATION_TIERS.GEOLOGICAL_SCALE.speedRange.max) {
    return SIMULATION_TIERS.GEOLOGICAL_SCALE;
  }
  // Default to Human Scale for anything below Geological min
  return SIMULATION_TIERS.HUMAN_SCALE;
}