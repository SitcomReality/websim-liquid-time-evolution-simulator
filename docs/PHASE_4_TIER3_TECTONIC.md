# Phase 4 — Tier 3 (Tectonic Scale)

Goal: Implement a highly abstract, event-driven tectonic backend operating on plate systems and large events, suitable for million-year timescales.

Key tasks:
- Implement a PlateSystem (plates, velocities, boundaries), SubductionHandler, SeafloorSpreading.
- Create an EventManager and GlacialCycles models to produce rare but impactful events.
- Build Tier3Backend that evolves plates, triggers events, and updates fields at low frequency.
- Add transitionFromTier2(fields) and transitionToTier2(fields) conversion routines.

Files to add:
- src/core/backends/tier3/{PlateSystem,SubductionHandler,SeafloorSpreading,EventManager,GlacialCycles}.js
- src/core/backends/Tier3Backend.js

Notes:
- Prioritize simplicity and speed. Tier3 is about changing shape, not simulating particles.

