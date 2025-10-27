# Phase 8 — Testing and Validation

Goal: Verify correctness, stability, and performance across tiers and transitions.

Key tasks:
- Implement per-tier unit tests (state preservation, conservation checks).
- Create transition tests (rapid tier changes, visual continuity).
- Run long-run stability tests for each tier (memory, drift, runaway feedback).
- Add metrics and logging to detect numerical drift and performance regressions.

Suggested test files:
- tests/tier1.spec.js
- tests/tier2.spec.js
- tests/transition.spec.js
- tests/longrun.spec.js

Notes:
- Automate test runs in CI with a reduced but deterministic world seed.
- Track performance targets for each tier and regress on changes that significantly degrade throughput.

