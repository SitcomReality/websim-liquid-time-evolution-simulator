# Phase 5 — Performance Optimizations

Goal: Add optimizations that make Tier 1 (and the whole sim) scalable: clustering, improved chunk sleeping, sub-stepping, and collision optimizations.

Key tasks:
- Implement ParticleCluster and ClusterManager to merge settled regions.
- Improve chunk sleep logic (ChunkStability, WakeSystem).
- Add SubstepController and CollisionOptimizer for numerical stability and faster collision checks.
- Integrate cluster manager into Tier1Backend or ParticleUpdater.

Files to add:
- src/core/clustering/{ParticleCluster,ClusterManager}.js
- src/core/WorldParts/ChunkStability.js
- src/core/WorldParts/WakeSystem.js
- src/physics/SubstepController.js
- src/physics/CollisionOptimizer.js

Notes:
- Make clustering conservative — avoid changing visible behavior unless clusters are disturbed.

