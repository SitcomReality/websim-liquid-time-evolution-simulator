# Phase 6 — State Management and Transitions

Goal: Build robust serialization and transition infrastructure so state can be preserved and translated across tiers.

Key tasks:
- Add StateSerializer to convert particles↔fields↔plates.
- Implement TransitionCoordinator to pause the sim, serialize state, initialize backends, and restore.
- Ensure lossy but plausible transitions, preserving large-scale geography.

Files to add:
- src/core/state/StateSerializer.js
- src/core/state/TransitionCoordinator.js

Notes:
- Provide unit tests for round-trip conversions with acceptable error bounds.
- Always pause rendering during transitions for visual continuity.

