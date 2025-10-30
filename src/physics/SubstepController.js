import { PARTICLE_PROPERTIES } from '../utils/Constants.js';

/**
 * SubstepController
 * Detects high-velocity particles and subdivides updates to prevent tunneling/instability.
 * 
 * When max velocity × timestep exceeds a safety threshold, the controller
 * automatically splits the frame into multiple smaller substeps.
 */
export class SubstepController {
  constructor(world, config = {}) {
    this.world = world;
    
    // Safety thresholds
    this.maxSafeDisplacement = config.maxSafeDisplacement || 1.5; // pixels per substep
    this.velocityThreshold = config.velocityThreshold || 1.0;    // pixels/frame above which we substepping
    this.maxSubsteps = config.maxSubsteps || 8;                  // Prevent runaway subdivision
    this.minSubstepDuration = config.minSubstepDuration || 1;    // Minimum dt for a substep (ms)
    
    // Diagnostics
    this.stats = {
      framesWithSubstepping: 0,
      totalSubstepCount: 0,
      maxSubstepsUsed: 1,
      avgSubstepsPerFrame: 1.0
    };
    
    this.framesSampled = 0;
  }

  /**
   * Calculate maximum particle velocity in the world.
   * Returns magnitude in pixels/frame at normal timescale.
   */
  calculateMaxVelocity() {
    let maxVelocity = 0;
    const sampleRate = Math.max(1, Math.floor(this.world.size / 500)); // Sample ~500 cells
    
    for (let i = 0; i < this.world.size; i += sampleRate) {
      const x = i % this.world.width;
      const y = Math.floor(i / this.world.width);
      const particle = this.world.getParticle(x, y);
      
      if (particle === 0) continue; // Skip empty
      
      // Estimate velocity from particle type flow characteristics
      const props = PARTICLE_PROPERTIES[particle];
      if (!props) continue;
      
      // Fluids move faster; solids slower
      // Rough estimate: flowRate correlates with typical velocity
      const typeVelocity = props.flowRate * 2.0; // Scale flowRate to velocity-like units
      
      // Check local pressure gradient (pressure drives flow)
      const pLeft = this.world.getPressure(x - 1, y);
      const pRight = this.world.getPressure(x + 1, y);
      const pUp = this.world.getPressure(x, y - 1);
      const pDown = this.world.getPressure(x, y + 1);
      
      const pressureGradient = Math.sqrt(
        (pRight - pLeft) ** 2 + (pDown - pUp) ** 2
      );
      
      // Velocity estimate: type + pressure gradient
      const estimatedVelocity = typeVelocity + pressureGradient * 0.5;
      maxVelocity = Math.max(maxVelocity, estimatedVelocity);
    }
    
    return maxVelocity;
  }

  /**
   * Determine number of substeps needed for stable simulation.
   * @param {number} deltaTime - Frame delta time in milliseconds
   * @param {number} fidelity - Simulation fidelity (0..1, affects particle movement)
   * @returns {number} Number of substeps to run (minimum 1)
   */
  calculateSubsteps(deltaTime, fidelity) {
    const maxVelocity = this.calculateMaxVelocity();
    
    // Displacement per frame = velocity × time × fidelity
    const displacement = maxVelocity * deltaTime * fidelity;
    
    // If displacement is within safe zone, no substeps needed
    if (displacement <= this.maxSafeDisplacement) {
      return 1;
    }
    
    // Calculate substeps to keep displacement safe
    let substeps = Math.ceil(displacement / this.maxSafeDisplacement);
    substeps = Math.min(substeps, this.maxSubsteps); // Cap substeps
    substeps = Math.max(substeps, 1);
    
    return substeps;
  }

  /**
   * Run physics update with sub-stepping if needed.
   * @param {Function} updateFn - Physics update function: updateFn(dt, fidelity)
   * @param {number} deltaTime - Frame delta time (ms)
   * @param {number} fidelity - Simulation fidelity (0..1)
   */
  updateWithSubstepping(updateFn, deltaTime, fidelity) {
    const substeps = this.calculateSubsteps(deltaTime, fidelity);
    
    if (substeps > 1) {
      // Sub-stepping active
      this.stats.framesWithSubstepping++;
      this.stats.maxSubstepsUsed = Math.max(this.stats.maxSubstepsUsed, substeps);
      
      const substepDelta = deltaTime / substeps;
      
      for (let i = 0; i < substeps; i++) {
        // Fidelity scales across substeps (spread work over substeps)
        const substepFidelity = fidelity / substeps;
        updateFn(substepDelta, substepFidelity);
      }
      
      this.stats.totalSubstepCount += substeps;
    } else {
      // No sub-stepping needed
      updateFn(deltaTime, fidelity);
    }
    
    // Update running average
    this.framesSampled++;
    this.stats.avgSubstepsPerFrame = this.stats.totalSubstepCount / Math.max(1, this.framesSampled);
  }

  /**
   * Get diagnostic statistics.
   */
  getStats() {
    return {
      ...this.stats,
      substeppingUtilization: this.stats.framesWithSubstepping > 0 ? 
        `${(this.stats.framesWithSubstepping / this.framesSampled * 100).toFixed(1)}% of frames` : 'none'
    };
  }

  /**
   * Reset statistics counters.
   */
  resetStats() {
    this.stats = {
      framesWithSubstepping: 0,
      totalSubstepCount: 0,
      maxSubstepsUsed: 1,
      avgSubstepsPerFrame: 1.0
    };
    this.framesSampled = 0;
  }
}