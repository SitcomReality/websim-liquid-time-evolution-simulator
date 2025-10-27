# Phase 7 — UI and Control Integration

Goal: Expose tier info and controls to users and make the time-scale slider aware of tier boundaries.

Key tasks:
- Update UI controls to show current tier and allow forcing a tier.
- Mark tier boundaries on the time-scale slider and show which systems are active.
- Add TierDebugOverlay to visualize field-level data (flow nets, plate boundaries).

Files to update/add:
- src/ui/Controls.js (add display and override controls)
- src/ui/TierDebugOverlay.js

Notes:
- Keep UI minimal: clearly show current tier, transition status, and allow a manual override for debugging.

