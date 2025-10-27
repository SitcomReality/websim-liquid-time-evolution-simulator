# Phase 2 — Tier 1 (Human Scale)

Goal: Wrap the existing high-fidelity particle simulation into a Tier1Backend so the rest of the system can treat it as one backend.

Key tasks:
- Create src/core/backends/Tier1Backend.js that delegates to the current ParticleUpdater and World.
- Refactor Simulation to consult TierManager and call the active backend's update() rather than directly calling ParticleUpdater.
- Provide getState() and setState() on the Tier1 backend to permit serialization.

Files to add/update:
- src/core/backends/Tier1Backend.js
- src/core/Simulation.js (minor refactor to integrate TierManager/backends)

Notes:
- Minimize changes to particle code; Tier1Backend should be a thin wrapper.
- Ensure compatibility with rendering and controls (no change to UI expected).

