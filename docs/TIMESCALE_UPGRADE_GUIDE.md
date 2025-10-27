# Timescale Physics Upgrade Implementation Guide

## Overview

This guide provides a step-by-step process for upgrading the Liquid Time simulation to handle extreme timescales by implementing tiered physics models. Instead of just adjusting parameters at different speeds, we'll switch between entirely different rule sets optimized for different temporal scales.

## Current Architecture Analysis

### What We Have Now

Our current simulation operates on a single physics model:
- Individual particle tracking in `World.js` with Uint8Array storage
- Particle-level updates via specialized updaters (PlantUpdater, LavaUpdater, etc.)
- Chunk-based optimization with sleep states
- Thermal and pressure fields at lower resolution than particles
- Single unified time scaling that multiplies delta time

### Current Limitations

- At high time scales (1000x+), we're still simulating every particle interaction
- Fidelity reduction helps but fundamentally can't scale to geological timescales
- No distinction between micro-physics and macro-physics
- Thermal diffusion and wind calculation become bottlenecks
- Plant growth and erosion use particle-level logic even at millennium scales

### What Needs to Change

We need to introduce:
1. Multiple simulation backends (Tier 1, 2, 3)
2. A mode manager that switches between them based on time scale
3. Field-based representations for high-speed tiers
4. Event-driven systems for extreme scales
5. State preservation during tier transitions

## Implementation Strategy

### Phase 1: Foundation and Architecture

#### Step 1.1: Create Simulation Tier Enum

Create a new constants file for simulation modes.

**File: `src/utils/SimulationTiers.js`**

Define three tier levels:
- HUMAN_SCALE: 1x to 100x speed
- GEOLOGICAL_SCALE: 1000x to 100000x speed  
- TECTONIC_SCALE: 1000000x and above

Include tier metadata:
- Name for display
- Speed range (min/max multiplier)
- Update interval (how often to tick)
- Which systems are active
- Resolution settings

#### Step 1.2: Create Tier Manager

**File: `src/core/TierManager.js`**

This class handles:
- Detecting when time scale crosses tier boundaries
- Triggering tier transitions
- Managing state preservation during transitions
- Coordinating which backend is active

Key methods:
- `getCurrentTier(timeScale)`: Returns appropriate tier for given scale
- `shouldTransition(currentTier, newTimeScale)`: Checks if transition needed
- `transitionToTier(newTier)`: Orchestrates the transition process
- `preserveState()`: Captures current world state before transition
- `restoreState(targetTier)`: Adapts saved state to new tier's representation

#### Step 1.3: Create Field System Foundation

**File: `src/core/fields/FieldGrid.js`**

A generic field storage system that will be used by Tier 2 and 3.

Properties:
- Width and height in cells (coarser than particle grid)
- Storage arrays for different field types
- Interpolation methods for reading/writing

This replaces particle-level detail with cell-level properties like:
- Elevation
- Rock type distribution
- Water content
- Temperature
- Vegetation coverage

Methods:
- `getCell(x, y)`: Get cell data
- `setCell(x, y, data)`: Set cell data
- `interpolateFromParticles(world)`: Convert particle world to field
- `projectToParticles(world)`: Convert field back to particles for rendering

### Phase 2: Tier 1 Implementation (Human Scale)

This is our existing system with minor refactoring.

#### Step 2.1: Create Tier1Backend

**File: `src/core/backends/Tier1Backend.js`**

Wrap our existing ParticleUpdater system:
- Constructor takes World and existing updaters
- `update(deltaTime, fidelity)`: Calls existing particle update logic
- `getState()`: Returns particle arrays for state preservation
- `setState(particleData)`: Restores from saved state

This should be a thin wrapper that delegates to our existing systems. No major changes to ParticleUpdater or specialized updaters needed.

#### Step 2.2: Refactor Simulation.js

Modify Simulation to use the tier system:
- Add TierManager as a member
- Check for tier transitions each frame
- Delegate update calls to active backend
- Handle backend switching

Keep existing time scale logic but add tier transition checks.

### Phase 3: Tier 2 Implementation (Geological Scale)

This is where we switch from particles to fields.

#### Step 3.1: Create Field Representation Classes

**File: `src/core/fields/MaterialField.js`**

Stores material composition per cell:
- Material type percentages (granite: 60%, soil: 30%, sand: 10%)
- Total mass in cell
- Stability factor (how consolidated the material is)

Methods:
- `addMaterial(type, amount)`: Accumulate material
- `removeMaterial(type, amount)`: Erode material
- `getDominantType()`: Get primary material
- `getMaterialRatio(type)`: Get percentage of specific material

**File: `src/core/fields/ElevationField.js`**

Height map with additional properties:
- Base elevation (bedrock level)
- Sediment depth
- Slope calculations cached
- Flow direction cached

Methods:
- `getElevation(x, y)`: Total height at position
- `getSlope(x, y)`: Steepness and direction
- `adjustElevation(x, y, delta)`: Modify height
- `calculateFlowNetwork()`: Compute where material flows

**File: `src/core/fields/ClimateField.js`**

Atmospheric and water cycle at regional scale:
- Annual precipitation
- Average temperature
- Wind patterns (prevailing direction and strength)
- Seasonal variation

Methods:
- `getPrecipitation(x, y)`: Yearly rainfall
- `getTemperature(x, y)`: Average temperature
- `updateClimate(orography)`: Recalculate based on elevation changes

#### Step 3.2: Create Tier2Backend

**File: `src/core/backends/Tier2Backend.js`**

Main controller for geological simulation.

Constructor:
- Creates field grids
- Initializes subsystems (erosion, deposition, flow)
- Sets cell resolution (e.g., 16x16 pixel cells)

`update(deltaTime, fidelity)` method:
- Run erosion calculator
- Apply material flow
- Update elevation field
- Modify material distribution
- Update climate based on new topography

`transitionFromTier1(world)`:
- Sample particle grid to build fields
- Calculate initial slopes and flow networks
- Aggregate materials into cell percentages

`transitionToTier1(world)`:
- Project fields back to particles
- Place particles according to material ratios
- Reconstruct detailed terrain

#### Step 3.3: Create Geological Processes

**File: `src/core/backends/tier2/ErosionCalculator.js`**

Calculate erosion rates per cell:
- Input: elevation, material composition, climate
- Output: erosion amount per cell per year

Algorithm:
- Steep slopes erode faster (angle of repose)
- Soft materials (soil) erode faster than hard (granite)
- Precipitation increases erosion (rain dissolves and carries)
- Calculate using simplified RUSLE (Revised Universal Soil Loss Equation)

**File: `src/core/backends/tier2/MaterialFlowSimulator.js`**

Move eroded material downslope:
- Input: erosion amounts, flow network, material properties
- Output: new material distribution

Algorithm:
- Material flows from high to low elevation following flow network
- Settle when slope drops below angle of repose
- Different materials have different transport distances
- Accumulation in basins and valleys

**File: `src/core/backends/tier2/LandformEvolver.js`**

Handles long-term landscape changes:
- Valley deepening through repeated erosion
- Mountain rounding as peaks erode
- Delta formation at river mouths (if we model rivers)
- Coastal shaping if adjacent to water

**File: `src/core/backends/tier2/ViscousRockFlow.js`**

Model rock as extremely viscous fluid at geological timescales:
- Deep rock flows toward low pressure zones
- Cavern roofs sag and eventually collapse
- Mountain roots sink into mantle (isostatic adjustment)

Algorithm:
- Calculate pressure from overlying material weight
- Apply flow equation with extreme viscosity (10^20 Pa·s for rock)
- Move material very slowly based on pressure gradients
- This creates the "everything is liquid" effect over millennia

#### Step 3.4: Integrate Wind and Climate

**File: `src/core/backends/tier2/RegionalClimate.js`**

Simplified atmospheric model:
- Prevailing wind patterns (based on latitude and planetary rotation)
- Orographic effects (mountains create rain shadows)
- Temperature gradients (latitude, elevation, ocean proximity)

Algorithm:
- Divide world into climate zones
- Wind flows from high to low pressure
- Moisture accumulates over oceans, precipitates over mountains
- Calculate yearly averages, not moment-to-moment

This replaces the expensive per-pixel wind calculations with regional patterns.

### Phase 4: Tier 3 Implementation (Tectonic Scale)

Maximum abstraction for million-year timescales.

#### Step 4.1: Create Tectonic Plate System

**File: `src/core/backends/tier3/PlateSystem.js`**

Divide world into tectonic plates:
- Each plate has velocity vector
- Plate boundaries (convergent, divergent, transform)
- Plate composition (oceanic vs continental)

Data structure:
- Plate ID field (which plate owns each cell)
- Plate velocity vectors
- Plate boundary types

Methods:
- `updatePlatePositions(deltaTime)`: Move plates
- `handleCollisions()`: Detect and resolve plate interactions
- `createMountains(boundaryLine)`: Uplift at convergent boundaries
- `createRift(boundaryLine)`: Subsidence at divergent boundaries

**File: `src/core/backends/tier3/SubductionHandler.js`**

Handle plate convergence:
- Oceanic plate subducts under continental
- Creates volcanic arcs
- Builds mountain ranges
- Triggers earthquakes (wake events for tier transitions)

**File: `src/core/backends/tier3/SeafloorSpreading.js`**

Handle divergent boundaries:
- New oceanic crust forms at mid-ocean ridges
- Symmetric spreading on both sides
- Creates new basaltic rock
- Forms ocean basins

#### Step 4.2: Create Event System

**File: `src/core/backends/tier3/EventManager.js`**

Major geological events that punctuate the simulation:
- Volcanic eruptions (create new landmass)
- Glaciation cycles (massive erosion pulses)
- Asteroid impacts (if we want to go that far)
- Supervolcano eruptions

Events are scheduled probabilistically based on geological conditions:
- Active subduction zones increase volcano probability
- Low global temperature triggers ice age
- Each event has effects that modify fields

**File: `src/core/backends/tier3/GlacialCycles.js`**

Ice age simulation:
- Global temperature variable oscillates on 100,000 year cycles
- When cold, glaciers form at high latitudes and elevations
- Glaciers erode deeply (carving U-shaped valleys)
- Deposit material when they melt (moraines)

This is event-driven rather than continuous simulation.

#### Step 4.3: Create Tier3Backend

**File: `src/core/backends/tier3/Tier3Backend.js`**

Main controller for planetary timescales.

Update method:
- Move tectonic plates
- Process plate boundary interactions
- Check for and trigger events
- Apply isostatic adjustment (crust rises/sinks to equilibrium)
- Run mega-scale erosion (glaciers, major river systems)

State transitions:
- `transitionFromTier2(fields)`: Inherit elevation and material fields, create plate boundaries
- `transitionToTier2(fields)`: Project plate movements into elevation changes

Much less computation than lower tiers because we're only updating major structures.

### Phase 5: Performance Optimizations

#### Step 5.1: Particle Clustering System

**File: `src/core/clustering/ParticleCluster.js`**

Merge stable particles into super-particles:
- Cluster adjacent particles of same type that aren't moving
- Store as single entity with combined mass
- Reduces collision checks dramatically

Splitting logic:
- Break cluster if hit with force
- Break if part of fast-moving flow
- Gradually merge particles in settled regions

Used in Tier 1 to reduce particle count without changing to fields.

**File: `src/core/clustering/ClusterManager.js`**

Manages clustering lifecycle:
- Scans for clusterable regions
- Creates and destroys clusters
- Handles cluster-particle interactions

#### Step 5.2: Advanced Chunk Sleep System

Enhance the existing chunk system in ChunkManager.

**File: `src/core/WorldParts/ChunkStability.js`**

More sophisticated stability analysis:
- Velocity threshold check (are particles moving?)
- Temperature gradient check (is heat flowing?)
- Structural stability (is collapse possible?)
- External force check (is wind/pressure affecting region?)

Mark chunks as:
- Active: Full simulation
- Drowsy: Reduced update frequency
- Sleeping: No updates until woken
- Fossil: Completely static, can never wake (deep bedrock)

**File: `src/core/WorldParts/WakeSystem.js`**

Manages waking sleeping regions:
- Propagate wake signals from active regions
- Event-driven waking (earthquake, volcano, player interaction)
- Wake radius (nearby chunks become drowsy)

#### Step 5.3: Numerical Stability Improvements

**File: `src/physics/SubstepController.js`**

Add sub-stepping for fast motion:
- Detect when particles have high velocity
- Split single update into multiple smaller steps
- Prevents tunneling and instability

Algorithm:
- Calculate max velocity in scene
- If velocity * dt > threshold, subdivide
- Run physics n times with dt/n
- Update rendering only once

**File: `src/physics/CollisionOptimizer.js`**

Spatial hashing for collision detection:
- Divide world into hash grid
- Only check collisions within same or adjacent cells
- Much faster than all-pairs checking

### Phase 6: State Management and Transitions

#### Step 6.1: State Serialization

**File: `src/core/state/StateSerializer.js`**

Convert between tier representations:
- Particles to fields
- Fields to plates
- Bidirectional conversion with minimal loss

Methods:
- `particlesToFields(world, cellSize)`: Aggregate particles into field grid
- `fieldsToParticles(fields, world)`: Reconstruct particle world
- `fieldsToPlates(fields)`: Abstract to tectonic representation
- `platesToFields(plates)`: Project plate movements to elevation

#### Step 6.2: Transition Coordinator

**File: `src/core/state/TransitionCoordinator.js`**

Smooth transitions between tiers:
- Pause simulation during transition
- Convert state using serializer
- Initialize new backend
- Resume with new physics model

Handle edge cases:
- User changes time scale rapidly
- Maintain visual continuity
- Preserve important features (don't lose the volcano)

#### Step 6.3: Rendering Bridge

**File: `src/core/rendering/RenderBridge.js`**

Ensure fields can be visualized:
- Always maintain a particle representation for rendering
- Update particle colors from field data
- Don't simulate particles in Tier 2/3, just use them for display

Methods:
- `updateParticlesFromFields(fields, world)`: Sync display particles to current field state
- `getVisibleRegion()`: Only update particles in view
- `interpolateChanges()`: Smooth visual updates even if backend updates slowly

### Phase 7: UI and Control Integration

#### Step 7.1: Update Controls

Modify `src/ui/Controls.js`:
- Display current tier mode
- Show tier-specific information (erosion rate, plate velocity, etc.)
- Add tier override option (force specific tier)
- Visual indicator when transitioning

#### Step 7.2: Time Scale Slider Enhancement

Update time scale control:
- Mark tier boundaries on slider
- Show which systems are active at current scale
- Display actual simulation speed (not just multiplier)

#### Step 7.3: Debug Overlays

**File: `src/ui/TierDebugOverlay.js`**

Visualization options for each tier:
- Tier 1: Existing overlays work fine
- Tier 2: Show flow networks, erosion rates, material composition
- Tier 3: Show plate boundaries, stress fields, event predictions

### Phase 8: Testing and Validation

#### Step 8.1: Per-Tier Unit Tests

Create test files for each backend:
- Test state preservation during transitions
- Verify physical plausibility (no negative mass, energy conservation)
- Check edge cases (world boundaries, extreme values)

#### Step 8.2: Transition Tests

Verify smooth transitions:
- Rapidly change time scales
- Check for visual glitches
- Ensure no state is lost
- Performance doesn't degrade

#### Step 8.3: Long-Run Stability

Run simulation for extended periods:
- Tier 1: Minutes of simulation time
- Tier 2: Thousands of simulated years
- Tier 3: Millions of simulated years

Check for:
- Numerical drift
- Runaway feedback loops
- Memory leaks
- Visual artifacts

## Migration Path

### Step-by-Step Implementation Order

1. Create tier infrastructure (Phase 1): TierManager, FieldGrid, constants
2. Wrap existing system as Tier1Backend (Phase 2): Minimal changes
3. Test that wrapped system works identically
4. Implement Tier2Backend basics (Phase 3.1-3.2): Field representation only
5. Add geological processes one at a time (Phase 3.3): Test each independently
6. Integrate Tier2 into TierManager and test transitions
7. Implement Tier3Backend structure (Phase 4.1-4.2): Events and plates
8. Complete Tier3 systems (Phase 4.3): Full planetary simulation
9. Add performance optimizations (Phase 5): Clustering, better sleep
10. Polish transitions and rendering (Phase 6-7): Smooth experience
11. Comprehensive testing (Phase 8)

### File Organization

Keep each system in its own file:


