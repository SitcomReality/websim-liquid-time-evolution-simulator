import { SIMULATION_TIERS, getTierForScale } from '../utils/SimulationTiers.js';

/**
 * TierManager
 * - Detects tier based on time-scale
 * - Orchestrates transitions between tiers
 * - Preserves/restores state across backends
 *
 * Usage:
 *  const tierManager = new TierManager({
 *    getBackendForTier: (tier) => new Tier1Backend(world) // or Tier2/Tier3
 *  });
 *  tierManager.updateForTimeScale(sim.timeScale);
 */
export class TierManager {
  constructor(options = {}) {
    this.getBackendForTier = options.getBackendForTier || (() => null);
    this.onTransitionStart = options.onTransitionStart || (() => {});
    this.onTransitionEnd = options.onTransitionEnd || (() => {});
    this.onPreserveState = options.onPreserveState || null; // optional hook(world)=>object
    this.onRestoreState = options.onRestoreState || null;   // optional hook(state, backend, tier)

    this.activeBackend = null;
    this.activeTier = SIMULATION_TIERS.HUMAN_SCALE;
    this.savedState = null;
  }

  getCurrentTier(timeScale) {
    return getTierForScale(timeScale);
  }

  shouldTransition(currentTier, newTimeScale) {
    const next = this.getCurrentTier(newTimeScale);
    return next.key !== currentTier.key;
  }

  /**
   * Call when Simulation timeScale changes significantly.
   * Returns true if a transition occurred.
   */
  updateForTimeScale(timeScale) {
    if (!this.shouldTransition(this.activeTier, timeScale)) return false;
    const targetTier = this.getCurrentTier(timeScale);
    return this.transitionToTier(targetTier);
  }

  transitionToTier(newTier) {
    if (!newTier || newTier.key === this.activeTier.key) return false;

    this.onTransitionStart(this.activeTier, newTier);

    // 1) Preserve state from current backend (if any)
    this.preserveState();

    // 2) Create/activate backend for new tier
    const nextBackend = this.getBackendForTier(newTier);
    this.activeBackend = nextBackend;

    // 3) Restore/adapt state into target backend representation
    this.restoreState(newTier);

    // 4) Finalize
    this.activeTier = newTier;
    this.onTransitionEnd(newTier, this.activeBackend);

    return true;
  }

  /**
   * Captures simulation state. Prefers backend.getState(), otherwise snapshots World-like arrays.
   * Expects caller to supply world via backend.world if needed.
   */
  preserveState() {
    if (!this.activeBackend) {
      // If no backend yet, nothing to preserve
      this.savedState = null;
      return;
    }

    // Custom hook wins
    if (typeof this.onPreserveState === 'function') {
      this.savedState = this.onPreserveState(this._getWorldFromBackend(this.activeBackend));
      return;
    }

    // Try backend exporter
    if (typeof this.activeBackend.getState === 'function') {
      this.savedState = this.activeBackend.getState();
      return;
    }

    // Fallback: shallow snapshot of particle world
    const world = this._getWorldFromBackend(this.activeBackend);
    if (world) {
      this.savedState = this._snapshotWorld(world);
    } else {
      this.savedState = null;
    }
  }

  /**
   * Restores saved state into the target tier/backend.
   * Performs minimal adaptation; backends can implement setState for richer conversions.
   */
  restoreState(targetTier) {
    if (!this.savedState || !this.activeBackend) return;

    // Custom hook wins
    if (typeof this.onRestoreState === 'function') {
      this.onRestoreState(this.savedState, this.activeBackend, targetTier);
      return;
    }

    // Backend-aware restore
    if (typeof this.activeBackend.setState === 'function') {
      const adapted = this._adaptStateForTier(this.savedState, targetTier);
      this.activeBackend.setState(adapted);
      return;
    }

    // Fallback: write into a World-like backend if available
    const world = this._getWorldFromBackend(this.activeBackend);
    if (world && this.savedState.kind === 'particle_world') {
      this._applySnapshotToWorld(world, this.savedState);
    }
  }

  // --- Helpers ---

  _getWorldFromBackend(backend) {
    // Convention: Tier1Backend exposes .world; Tier2/Tier3 may not.
    return backend && backend.world ? backend.world : null;
  }

  _snapshotWorld(world) {
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

  _applySnapshotToWorld(world, state) {
    if (!state || state.kind !== 'particle_world') return;
    if (state.width !== world.width || state.height !== world.height) {
      // Basic size mismatch handling: clamp/copy overlapping area
      const minW = Math.min(world.width, state.width);
      const minH = Math.min(world.height, state.height);
      for (let y = 0; y < minH; y++) {
        for (let x = 0; x < minW; x++) {
          const iWorld = y * world.width + x;
          const iState = y * state.width + x;
          world.particles[iWorld] = state.particles[iState];
          const dW = iWorld * 4, dS = iState * 4;
          world.particleData[dW] = state.particleData[dS];
          world.particleData[dW + 1] = state.particleData[dS + 1];
          world.particleData[dW + 2] = state.particleData[dS + 2];
          world.particleData[dW + 3] = state.particleData[dS + 3];
        }
      }
      // Thermal fields (coarse) copied best-effort — backends may later recompute
      const lenT = Math.min(world.temperature.length, state.temperature.length);
      for (let i = 0; i < lenT; i++) {
        world.temperature[i] = state.temperature[i];
        world.pressure[i] = state.pressure[i];
      }
    } else {
      world.particles.set(state.particles);
      world.particleData.set(state.particleData);
      // Thermal grids may differ by resolution across tiers; copy best-effort
      const lenT = Math.min(world.temperature.length, state.temperature.length);
      for (let i = 0; i < lenT; i++) {
        world.temperature[i] = state.temperature[i];
        world.pressure[i] = state.pressure[i];
      }
    }
  }

  _adaptStateForTier(state, targetTier) {
    // Placeholder for richer conversions (particles<->fields<->plates).
    // For now, pass through particle snapshots and let backends handle conversion.
    return state;
  }
}