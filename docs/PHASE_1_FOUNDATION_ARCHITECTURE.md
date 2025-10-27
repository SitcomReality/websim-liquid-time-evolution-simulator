# Phase 1 — Foundation and Architecture

Goal: Create the core tier infrastructure and foundational systems that let us switch physics backends.

Key tasks:
- Add SimulationTiers constants describing ranges and metadata for each tier.
- Implement a TierManager to detect time-scale boundaries and orchestrate transitions.
- Create a FieldGrid (generic, coarse cell grid) to represent Tier 2/3 fields later.

Files to add:
- src/utils/SimulationTiers.js
- src/core/TierManager.js
- src/core/fields/FieldGrid.js

Notes:
- Keep TierManager lightweight and focused on detection, preservation hooks, and calling serializers.
- FieldGrid should provide interpolation helpers and conversion stubs for Particle<->Field conversions.
- Aim for minimal coupling to existing world code; use adapters/serializers for conversions.

