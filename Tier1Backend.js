
Each file should be small (under 300 lines) and have a single responsibility.

### Backwards Compatibility

Existing features should work at Tier 1:
- All current particle types
- Plant growth
- Lava flows
- Weather systems
- Primordials (need tier-specific behavior)

Gradual enhancement means we can ship Tier 1 refactor before implementing other tiers.

## Key Design Principles

### Separation of Concerns

Each tier is completely independent:
- Different data structures
- Different update loops
- Different rendering needs

TierManager is the only connection point.

### Progressive Enhancement

Start simple, add complexity:
- Tier 1 is basically current system
- Tier 2 adds field simulation
- Tier 3 adds event-driven tectonics

Each tier can be developed and tested independently.

### Lossy but Plausible Transitions

When transitioning:
- Don't try to preserve every detail
- Focus on large-scale features
- Interpolate small details on transition
- Prioritize stability over perfect accuracy

For example, when going from particles to fields, we lose individual rock positions but preserve the mountain shape.

### Caching and Lazy Evaluation

Compute expensive things rarely:
- Flow networks: Recalculate only when elevation changes significantly
- Climate patterns: Update every N simulation years
- Plate boundaries: Detect infrequently

This is especially important in Tier 2/3 where we can afford to be clever about what we update.

### Clear State Ownership

Each backend owns its state:
- Tier1Backend owns particle arrays
- Tier2Backend owns field grids
- Tier3Backend owns plate structures

No shared mutable state between backends except through serialization.

## Expected Performance Improvements

### Current System
- 1x speed: 60 FPS
- 10x speed: 60 FPS  
- 100x speed: 40 FPS (some lag)
- 1000x speed: 15 FPS (very laggy)
- 10000x speed: Unusable

### With Tiered System
- 1x-100x speed (Tier 1): 60 FPS (same as now)
- 1000x-10000x speed (Tier 2): 60 FPS (fields are much faster)
- 100000x-1000000x speed (Tier 3): 60 FPS (events are trivial)

The key is that at high speeds, we're doing fundamentally less work, not just skipping steps.

## Conclusion

This upgrade transforms the simulation from a single-scale particle system into a multi-scale earth simulator. By switching between fundamentally different physics models, we can handle timescales from seconds to eons without sacrificing either visual quality or simulation accuracy at the appropriate scale.

The modular approach means we can implement incrementally, test thoroughly, and maintain clean separation between different simulation regimes. Each tier is a separate simulation engine with its own rules, connected only through state serialization at transition points.

