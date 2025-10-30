import { StateSerializer } from './StateSerializer.js';

/**
 * TransitionCoordinator
 * Orchestrates smooth transitions between simulation tiers.
 * 
 * Responsibilities:
 * - Detect tier changes and queue transitions
 * - Pause simulation during conversion
 * - Serialize state and convert representations
 * - Initialize new backend with converted state
 * - Resume simulation with visual continuity
 * - Handle rapid timescale changes without data loss
 * - Validate state integrity across conversions
 * 
 * Usage:
 *   const coordinator = new TransitionCoordinator(simulation, tierManager);
 *   coordinator.update(currentTimeScale);
 */
export class TransitionCoordinator {
  constructor(simulation, tierManager, config = {}) {
    this.simulation = simulation;
    this.tierManager = tierManager;

    // Configuration
    this.enableSmoothTransitions = config.enableSmoothTransitions !== false;
    this.validateStateOnTransition = config.validateStateOnTransition !== false;
    this.preserveVisualContinuity = config.preserveVisualContinuity !== false;
    this.maxConversionTimeMs = config.maxConversionTimeMs || 50; // Target completion time
    this.enableLogging = config.enableLogging !== false;

    // State machine
    this.state = 'idle'; // 'idle' | 'preparing' | 'converting' | 'initializing' | 'resuming'
    this.currentTier = tierManager.activeTier;
    this.targetTier = null;
    this.targetTimeScale = null;

    // Queuing for rapid transitions
    this.transitionQueue = [];
    this.isTransitioning = false;
    this.conversionStartTime = null;

    // State preservation
    this.savedState = null;
    this.preTransitionStats = null;

    // Diagnostics
    this.stats = {
      transitionsCompleted: 0,
      totalConversionTimeMs: 0,
      averageConversionTimeMs: 0,
      stateValidationPasses: 0,
      stateValidationFailures: 0,
      featuresPreserved: 0,
      featuresMissed: 0
    };

    this.conversionHistory = [];
  }

  /**
   * Main update loop: detect and coordinate tier changes.
   * Call this each frame alongside simulation.update().
   */
  update(currentTimeScale) {
    if (this.state === 'idle') {
      // Check if tier transition is needed
      const nextTier = this.tierManager.getCurrentTier(currentTimeScale);
      if (nextTier.key !== this.currentTier.key) {
        this.queueTransition(nextTier, currentTimeScale);
      }
    } else if (this.state === 'preparing') {
      this.prepareTransition();
    } else if (this.state === 'converting') {
      this.executeConversion();
    } else if (this.state === 'initializing') {
      this.initializeNewBackend();
    } else if (this.state === 'resuming') {
      this.resumeSimulation();
    }
  }

  /**
   * Queue a transition to a new tier.
   * If already transitioning, add to queue (handles rapid timescale changes).
   */
  queueTransition(targetTier, targetTimeScale) {
    if (this.enableLogging) {
      console.log(`[TransitionCoordinator] Queuing transition: ${this.currentTier.name} → ${targetTier.name} @ ${targetTimeScale.toFixed(1)}x`);
    }

    // If already transitioning, queue the new request
    if (this.isTransitioning) {
      // Replace pending queue with the latest request (most recent user action wins)
      this.transitionQueue = [{ tier: targetTier, timeScale: targetTimeScale }];
      return;
    }

    // Start transition immediately
    this.targetTier = targetTier;
    this.targetTimeScale = targetTimeScale;
    this.isTransitioning = true;
    this.conversionStartTime = performance.now();
  }

  /**
   * Preparation phase: pause simulation and capture state snapshots.
   */
  prepareTransition() {
    // Pause simulation
    this.simulation.running = false;

    // Capture pre-transition state for diagnostics and rollback
    this.preTransitionStats = {
      timeScale: this.simulation.timeScale,
      simulationTime: this.simulation.simulationTime,
      worldSize: this.simulation.world.size,
      tier: this.currentTier.key
    };

    // Count important features before conversion
    this.stats.featuresPreserved = this.countImportantFeatures();

    if (this.enableLogging) {
      console.log('[TransitionCoordinator] Paused simulation for state capture');
    }

    this.state = 'converting';
  }

  /**
   * Conversion phase: serialize and convert state between representations.
   */
  executeConversion() {
    try {
      // Get current state from active backend
      const currentState = this.tierManager.activeBackend?.getState?.() ||
                           this._captureDefaultState();

      // Determine conversion path
      const conversionPath = `${this.currentTier.key}_to_${this.targetTier.key}`;

      if (this.enableLogging) {
        console.log(`[TransitionCoordinator] Converting state: ${conversionPath}`);
      }

      // Execute conversion
      this.savedState = this._performConversion(currentState, conversionPath);

      // Validate converted state
      if (this.validateStateOnTransition) {
        const validation = this._validateConvertedState(this.savedState);
        if (!validation.valid) {
          console.warn('[TransitionCoordinator] State validation failed:', validation.errors);
          this.stats.stateValidationFailures++;
          if (!validation.recoverable) {
            throw new Error('State conversion produced invalid/unrecoverable state');
          }
        } else {
          this.stats.stateValidationPasses++;
        }
      }

      // Log conversion diagnostics
      const loss = StateSerializer.estimateConversionLoss(currentState, conversionPath);
      if (this.enableLogging) {
        console.log(`[TransitionCoordinator] Conversion loss estimate: ${(loss.informationRetained * 100).toFixed(1)}% retained`);
        if (loss.warnings.length > 0) {
          console.warn('[TransitionCoordinator] Conversion warnings:', loss.warnings);
        }
      }

      this.conversionHistory.push({
        timestamp: performance.now(),
        path: conversionPath,
        loss: loss.informationRetained,
        valid: validation?.valid ?? true
      });

      this.state = 'initializing';
    } catch (error) {
      console.error('[TransitionCoordinator] Conversion failed:', error);
      this.state = 'idle';
      this.isTransitioning = false;
      this._rollback();
      throw error;
    }
  }

  /**
   * Initialization phase: create new backend and restore converted state.
   */
  initializeNewBackend() {
    try {
      if (this.enableLogging) {
        console.log(`[TransitionCoordinator] Initializing new backend for ${this.targetTier.name}`);
      }

      // Transition to new tier (TierManager creates backend)
      this.tierManager.transitionToTier(this.targetTier);

      // Restore converted state into new backend
      if (this.savedState && this.tierManager.activeBackend) {
        const adapted = this._adaptStateForNewBackend(
          this.savedState,
          this.currentTier,
          this.targetTier
        );

        if (typeof this.tierManager.activeBackend.setState === 'function') {
          this.tierManager.activeBackend.setState(adapted);
        }
      }

      // Update coordinator state
      this.currentTier = this.targetTier;

      // Count features after conversion
      const featuresAfter = this.countImportantFeatures();
      this.stats.featuresPreserved = featuresAfter;

      if (this.enableLogging) {
        console.log(`[TransitionCoordinator] Backend initialized and state restored`);
      }

      this.state = 'resuming';
    } catch (error) {
      console.error('[TransitionCoordinator] Backend initialization failed:', error);
      this.state = 'idle';
      this.isTransitioning = false;
      this._rollback();
      throw error;
    }
  }

  /**
   * Resume phase: restart simulation with new backend.
   */
  resumeSimulation() {
    // Resume simulation with new backend
    this.simulation.running = true;
    this.simulation.timeScale = this.targetTimeScale;
    this.tierManager.activeBackend = this.tierManager.activeBackend;

    const conversionTime = performance.now() - this.conversionStartTime;
    this.stats.totalConversionTimeMs += conversionTime;
    this.stats.transitionsCompleted++;
    this.stats.averageConversionTimeMs = this.stats.totalConversionTimeMs / this.stats.transitionsCompleted;

    if (this.enableLogging) {
      console.log(`[TransitionCoordinator] Transition complete in ${conversionTime.toFixed(1)}ms`);
    }

    // Check if there's a queued transition
    if (this.transitionQueue.length > 0) {
      const next = this.transitionQueue.shift();
      this.state = 'idle';
      this.isTransitioning = false;
      // Will be picked up next frame
      this.targetTier = next.tier;
      this.targetTimeScale = next.timeScale;
    } else {
      this.state = 'idle';
      this.isTransitioning = false;
      this.targetTier = null;
      this.targetTimeScale = null;
    }

    // Clean up
    this.savedState = null;
  }

  /**
   * Count important features (volcanoes, water bodies, etc.).
   * Used to verify features are preserved across transitions.
   */
  countImportantFeatures() {
    const world = this.simulation.world;
    const PARTICLE_TYPES = {
      LAVA: 5,
      WATER: 2,
      PLANT: 8,
      STEAM: 7
    };

    let features = 0;

    // Sample world to find features (full scan would be slow)
    const sampleRate = Math.max(1, Math.floor(world.size / 1000));
    for (let i = 0; i < world.size; i += sampleRate) {
      const p = world.particles[i];

      // Count "important" particles
      if (p === PARTICLE_TYPES.LAVA) features += 3; // Volcanoes are critical
      else if (p === PARTICLE_TYPES.WATER) features += 1;
      else if (p === PARTICLE_TYPES.PLANT) features += 1;
      else if (p === PARTICLE_TYPES.STEAM) features += 2; // Active volcanism
    }

    return Math.floor(features / sampleRate);
  }

  /**
   * Perform state conversion based on tier pair.
   */
  _performConversion(state, conversionPath) {
    // Delegate to StateSerializer based on conversion direction
    const [fromTier, toTier] = conversionPath.split('_to_');

    switch (conversionPath) {
      case 'human_scale_to_geological_scale':
        // Particle world → Fields
        return {
          kind: 'field_world',
          fields: StateSerializer.particlesToFields(this.simulation.world, 16)
        };

      case 'geological_scale_to_human_scale':
        // Fields → Particle world
        // This requires reconstructing particles; delegated to backend.setState
        return {
          kind: 'particle_world',
          state: state // Pass through for backend to handle
        };

      case 'geological_scale_to_tectonic_scale':
        // Fields → Plates
        if (state.fields) {
          return {
            kind: 'tectonic_world',
            plateState: StateSerializer.fieldsToPlates(state.fields, 32)
          };
        }
        return state;

      case 'tectonic_scale_to_geological_scale':
        // Plates → Fields
        if (state.plateState) {
          return {
            kind: 'field_world',
            fields: StateSerializer.platesToFields(state.plateState, 400, 300)
          };
        }
        return state;

      // Cross-tier jumps (rare but possible)
      case 'human_scale_to_tectonic_scale':
        // Particles → Fields → Plates (multi-step)
        const fieldsIntermediate = StateSerializer.particlesToFields(this.simulation.world, 16);
        return {
          kind: 'tectonic_world',
          plateState: StateSerializer.fieldsToPlates(fieldsIntermediate, 32)
        };

      case 'tectonic_scale_to_human_scale':
        // Plates → Fields → Particles (delegated to backend)
        if (state.plateState) {
          const fieldsRecovered = StateSerializer.platesToFields(state.plateState, 400, 300);
          return {
            kind: 'particle_world',
            fields: fieldsRecovered
          };
        }
        return state;

      default:
        if (this.enableLogging) {
          console.warn(`[TransitionCoordinator] Unknown conversion path: ${conversionPath}`);
        }
        return state;
    }
  }

  /**
   * Validate converted state for integrity.
   */
  _validateConvertedState(state) {
    const errors = [];
    let recoverable = true;

    if (!state) {
      return { valid: false, errors: ['State is null/undefined'], recoverable: false };
    }

    switch (state.kind) {
      case 'particle_world':
        if (!state.particles || state.particles.length === 0) {
          errors.push('Particle array is empty');
          recoverable = false;
        }
        break;

      case 'field_world':
        if (!state.fields || !state.fields.elevation) {
          errors.push('Field elevation missing');
          recoverable = false;
        }
        if (state.fields.width < 10 || state.fields.height < 10) {
          errors.push('Field dimensions too small');
          recoverable = false;
        }
        break;

      case 'tectonic_world':
        if (!state.plateState || !state.plateState.plates) {
          errors.push('Plate state missing');
          recoverable = false;
        }
        if (state.plateState.plates.length < 2) {
          errors.push('Insufficient plates (need ≥2)');
          recoverable = true; // Can recover by reinitializing
        }
        break;

      default:
        errors.push(`Unknown state kind: ${state.kind}`);
        recoverable = false;
    }

    return {
      valid: errors.length === 0,
      errors,
      recoverable
    };
  }

  /**
   * Adapt state representation for new backend if needed.
   */
  _adaptStateForNewBackend(state, fromTier, toTier) {
    // Backends may have specific requirements or optimizations
    // This hook allows backends to transform state before setState()

    const adapted = { ...state };

    // Example: Tier2 backends might want to simplify fields
    if (toTier.key === 'geological_scale' && state.fields) {
      // Could downsample fields here if resolution is too high
      const maxCells = 100 * 100;
      const currentCells = state.fields.width * state.fields.height;
      if (currentCells > maxCells) {
        const factor = Math.ceil(Math.sqrt(currentCells / maxCells));
        adapted.fields = StateSerializer.simplifyFields(state.fields, factor);
      }
    }

    // Example: Tier3 backends might want specific plate configurations
    if (toTier.key === 'tectonic_scale' && state.plateState) {
      // Validate plate count matches expected resolution
      const expectedPlates = 6; // 3x2
      if (state.plateState.plates.length < expectedPlates) {
        console.warn(`[TransitionCoordinator] Low plate count; may cause clustering issues`);
      }
    }

    return adapted;
  }

  /**
   * Capture default state if backend doesn't implement getState().
   */
  _captureDefaultState() {
    const world = this.simulation.world;
    return {
      kind: 'particle_world',
      width: world.width,
      height: world.height,
      particles: world.particles.slice(0),
      particleData: world.particleData.slice(0),
      temperature: world.temperature.slice(0),
      pressure: world.pressure.slice(0)
    };
  }

  /**
   * Rollback: restore previous state if transition fails.
   */
  _rollback() {
    if (this.enableLogging) {
      console.warn('[TransitionCoordinator] Transition failed; rolling back');
    }

    // Resume simulation in current tier
    this.simulation.running = true;

    // Discard incomplete state
    this.savedState = null;
    this.targetTier = null;
    this.targetTimeScale = null;
    this.transitionQueue = [];
  }

  /**
   * Get diagnostic information.
   */
  getDiagnostics() {
    return {
      state: this.state,
      currentTier: this.currentTier.name,
      targetTier: this.targetTier?.name || 'none',
      isTransitioning: this.isTransitioning,
      queuedTransitions: this.transitionQueue.length,
      stats: {
        ...this.stats,
        lastConversionTime: this.conversionHistory.length > 0 ?
          this.conversionHistory[this.conversionHistory.length - 1] : null
      }
    };
  }

  /**
   * Get conversion history for debugging and optimization.
   */
  getConversionHistory(limit = 10) {
    return this.conversionHistory.slice(-limit).map(entry => ({
      ...entry,
      elapsedMs: (performance.now() - entry.timestamp).toFixed(1)
    }));
  }

  /**
   * Reset statistics (useful between gameplay sessions).
   */
  resetStats() {
    this.stats = {
      transitionsCompleted: 0,
      totalConversionTimeMs: 0,
      averageConversionTimeMs: 0,
      stateValidationPasses: 0,
      stateValidationFailures: 0,
      featuresPreserved: 0,
      featuresMissed: 0
    };
    this.conversionHistory = [];
  }
}