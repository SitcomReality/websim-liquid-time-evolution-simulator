This folder contains focused overlay renderers used by TierDebugOverlayDelegate.js:

- FlowOverlay.js      -> renders Tier2 flow networks
- ErosionOverlay.js   -> renders computed erosion heatmap
- MaterialOverlay.js  -> renders material composition map
- PlateOverlay.js     -> renders plate fills and boundaries for Tier3
- StressOverlay.js    -> renders stress heatmap computed from plate boundaries
- EventsOverlay.js    -> renders recent event predictions and markers

Each overlay receives a lightweight delegate that exposes ctx, canvas, world, and simulation references. The original large TierDebugOverlay implementation was split so each renderer is easier to maintain.

Note: the top-level src/ui/TierDebugOverlay.js now re-exports the delegator and contains tombstone comments where big functions were removed.

