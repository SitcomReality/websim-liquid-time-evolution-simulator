# Phase 3 — Tier 2 (Geological Scale)

Goal: Implement a coarse field-based simulation that approximates long-term geological processes much faster than particle-level simulation.

Key tasks:
- Implement field classes: MaterialField, ElevationField, ClimateField.
- Build Tier2Backend to operate on field grids and run erosion/flow/landform evolution.
- Provide transitionFromTier1(world) and transitionToTier1(world) for coarse ↔ particle conversions.
- Implement core geological processors (ErosionCalculator, MaterialFlowSimulator, LandformEvolver, ViscousRockFlow).

Files to add:
- src/core/fields/MaterialField.js
- src/core/fields/ElevationField.js
- src/core/fields/ClimateField.js
- src/core/backends/Tier2Backend.js
- src/core/backends/tier2/{ErosionCalculator,MaterialFlowSimulator,LandformEvolver,ViscousRockFlow}.js

Notes:
- Use a configurable cell resolution (e.g., 8–32 pixels per cell).
- Focus on plausible results rather than complete physical accuracy.

