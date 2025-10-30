import { ParticleUpdater } from '../../physics/ParticleUpdater.js';
import { ClusterManager } from '../clustering/ClusterManager.js';
import { SubstepController } from '../../physics/SubstepController.js';
import { CollisionOptimizer } from '../../physics/CollisionOptimizer.js';

export class Tier1Backend {
  constructor(world, config = {}) {
    this.world = world;
    this.particleUpdater = new ParticleUpdater(world);
    
    // Add clustering system for performance
    this.clusterManager = new ClusterManager(world, {
      minClusterSize: config.minClusterSize || 8,
      maxClusterSize: config.maxClusterSize || 200,
      scanFrequency: config.scanFrequency || 50
    });

    // Add numerical stability improvements
    this.substepController = new SubstepController(world, {
      maxSafeDisplacement: config.maxSafeDisplacement || 1.5,
      velocityThreshold: config.velocityThreshold || 1.0,
      maxSubsteps: config.maxSubsteps || 8
    });

    this.collisionOptimizer = new CollisionOptimizer(world, {
      cellSize: config.collisionCellSize || 16
    });

    this.enableSubstepping = config.enableSubstepping !== false;
    this.enableCollisionOptimization = config.enableCollisionOptimization !== false;
  }

  // Delegate to existing particle update loop with sub-stepping
  update(deltaTime, fidelity) {
    if (this.enableSubstepping) {
      // Use sub-stepping controller for numerical stability
      this.substepController.updateWithSubstepping(
        (dt, f) => this.particleUpdater.update(f, dt),
        deltaTime,
        fidelity
      );
    } else {
      // Standard update without sub-stepping
      this.particleUpdater.update(fidelity, deltaTime);
    }
    
    // Optimize collision detection
    if (this.enableCollisionOptimization) {
      this.collisionOptimizer.rebuildGrid();
      const collisions = this.collisionOptimizer.checkCollisions();
      // Collisions detected but not yet acted upon in this stub
      // Can be used for future collision response systems
    }
    
    // Manage clusters (overhead is minimal)
    this.clusterManager.update(deltaTime);
  }

  // Snapshot particle-world state for transitions
  getState() {
    const w = this.world;
    return {
      kind: 'particle_world',
      width: w.width,
      height: w.height,
      particles: w.particles.slice(0),
      particleData: w.particleData.slice(0),
      temperature: w.temperature.slice(0),
      pressure: w.pressure.slice(0),
      clustering: this.clusterManager.getState()
    };
  }

  // Restore state snapshot back into the world
  setState(state) {
    const w = this.world;
    if (!state || state.kind !== 'particle_world') return;

    const minW = Math.min(w.width, state.width);
    const minH = Math.min(w.height, state.height);

    // Copy particle and per-pixel data over the overlapping area
    for (let y = 0; y < minH; y++) {
      for (let x = 0; x < minW; x++) {
        const iWorld = y * w.width + x;
        const iState = y * state.width + x;

        w.particles[iWorld] = state.particles[iState];

        const dW = iWorld * 4, dS = iState * 4;
        w.particleData[dW] = state.particleData[dS];
        w.particleData[dW + 1] = state.particleData[dS + 1];
        w.particleData[dW + 2] = state.particleData[dS + 2];
        w.particleData[dW + 3] = state.particleData[dS + 3];
      }
    }

    // Thermal/pressure fields (best-effort copy; resolutions may differ externally)
    const lenT = Math.min(w.temperature.length, state.temperature.length);
    for (let i = 0; i < lenT; i++) {
      w.temperature[i] = state.temperature[i];
      w.pressure[i] = state.pressure[i];
    }

    // Restore clustering state if available
    if (state.clustering) {
      this.clusterManager.setState(state.clustering);
    }
  }

  /**
   * Get combined diagnostics from all optimization systems.
   */
  getDiagnostics() {
    return {
      substepping: this.substepController.getStats(),
      collision: this.collisionOptimizer.getStats(),
      clustering: this.clusterManager.getStats()
    };
  }
}