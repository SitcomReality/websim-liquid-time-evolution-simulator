import { PARTICLE_TYPES, PARTICLE_PROPERTIES } from '../../utils/Constants.js';

/**
 * ChunkStability
 * Analyzes chunk state to determine sleep status with more sophistication.
 * 
 * States:
 * - ACTIVE (0): Full simulation, all updaters run
 * - DROWSY (1): Reduced simulation frequency (1/3 updates)
 * - SLEEPING (2): No updates; woken by external events or neighbors
 * - FOSSIL (3): Deep bedrock, never simulated (immutable)
 */
export class ChunkStability {
  constructor(world, chunkManager, config = {}) {
    this.world = world;
    this.chunkManager = chunkManager;

    // Stability thresholds
    this.velocityThreshold = config.velocityThreshold ?? 0.05;      // Max velocity before active
    this.tempGradientThreshold = config.tempGradientThreshold ?? 5;  // °C/cell before active
    this.externalForceThreshold = config.externalForceThreshold ?? 0.3; // Wind/pressure before active
    this.collapseRiskThreshold = config.collapseRiskThreshold ?? 0.15;  // Fraction for cave-in risk

    // State storage (per chunk)
    this.chunkStates = new Uint8Array(chunkManager.chunksX * chunkManager.chunksY);
    this.chunkStateNames = ['ACTIVE', 'DROWSY', 'SLEEPING', 'FOSSIL'];
    
    // Stability scores (0..1, higher = more stable)
    this.stabilityScores = new Float32Array(chunkManager.chunksX * chunkManager.chunksY);
    
    // Counters for drowsy chunks (to reduce update frequency)
    this.drowsySkipCounters = new Uint8Array(chunkManager.chunksX * chunkManager.chunksY);
    
    // Track recently woken chunks to prevent immediate re-sleep
    this.wokenTicks = new Uint16Array(chunkManager.chunksX * chunkManager.chunksY);
    this.minAwakeTicks = config.minAwakeTicks ?? 30;
  }

  /**
   * Analyze all chunks and determine their stability state.
   */
  updateStability(deltaTime) {
    const { chunksX, chunksY, chunkSize } = this.chunkManager;
    const w = this.world.width;
    const h = this.world.height;

    for (let cy = 0; cy < chunksY; cy++) {
      for (let cx = 0; cx < chunksX; cx++) {
        const chunkId = cy * chunksX + cx;
        const startX = cx * chunkSize;
        const startY = cy * chunkSize;
        const endX = Math.min(startX + chunkSize, w);
        const endY = Math.min(startY + chunkSize, h);

        // Analyze chunk
        const stability = this.analyzeChunk(startX, startY, endX, endY);
        this.stabilityScores[chunkId] = stability;

        // Determine state based on stability and recent activity
        this.updateChunkState(chunkId, stability, deltaTime);
      }
    }
  }

  /**
   * Analyze a chunk region and return stability score (0..1).
   */
  analyzeChunk(startX, startY, endX, endY) {
    let instability = 0;

    // Sample region (not every cell for performance)
    const sampleStep = Math.max(1, Math.floor((endX - startX) / 4));
    
    for (let y = startY; y < endY; y += sampleStep) {
      for (let x = startX; x < endX; x += sampleStep) {
        // 1. Velocity check
        const particle = this.world.getParticle(x, y);
        if (particle !== PARTICLE_TYPES.EMPTY && particle !== PARTICLE_TYPES.BEDROCK) {
          // Estimate activity
          const v = this.estimateParticleVelocity(x, y);
          if (v > this.velocityThreshold) instability += 0.2;
          
          // 4. Structural collapse risk (essential for gravity)
          const collapseRisk = this.calculateCollapseRisk(x, y);
          if (collapseRisk > this.collapseRiskThreshold) instability += 0.5;
        }

        // 2. Temperature gradient check
        const tempGradient = this.calculateLocalTempGradient(x, y);
        if (tempGradient > this.tempGradientThreshold) instability += 0.1;

        // 3. External force check (wind/pressure)
        const wind = this.world.getWind(x, y);
        const pressure = this.world.getPressure(x, y);
        const windMagnitude = Math.sqrt(wind.vx * wind.vx + wind.vy * wind.vy);
        const forceIntensity = windMagnitude + Math.abs(pressure - 1.0);
        if (forceIntensity > this.externalForceThreshold) instability += 0.05;
      }
    }

    return Math.max(0, Math.min(1, instability));
  }

  /**
   * Estimate particle velocity by checking if neighbors have swapped.
   * (Simplified: high-viscosity particles near low-viscosity neighbors suggest flow)
   */
  estimateParticleVelocity(x, y) {
    const particle = this.world.getParticle(x, y);
    const props = PARTICLE_PROPERTIES[particle];
    
    if (!props) return 0;
    
    let velocityIndicator = 0;

    // Check for flow-like neighbors (lighter particles nearby)
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nx = x + dx, ny = y + dy;
        if (!this.world.inBounds(nx, ny)) continue;

        const neighbor = this.world.getParticle(nx, ny);
        const nProps = PARTICLE_PROPERTIES[neighbor];

        // Denser particle next to lighter = potential flow
        if (nProps && props.density > nProps.density && nProps.density > 0.1) {
          velocityIndicator += 0.05;
        }
      }
    }

    // Fluids have inherent movement potential
    if (props.flowRate > 0.3) {
      velocityIndicator += props.flowRate * 0.1;
    }

    return velocityIndicator;
  }

  /**
   * Calculate local temperature gradient (rate of change).
   */
  calculateLocalTempGradient(x, y) {
    const centerTemp = this.world.getTemperature(x, y);
    let maxDiff = 0;

    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nx = x + dx, ny = y + dy;
        if (!this.world.inBounds(nx, ny)) continue;

        const nTemp = this.world.getTemperature(nx, ny);
        const diff = Math.abs(nTemp - centerTemp);
        maxDiff = Math.max(maxDiff, diff);
      }
    }

    return maxDiff;
  }

  /**
   * Calculate structural collapse risk for overhanging/unsupported regions.
   */
  calculateCollapseRisk(x, y) {
    const particle = this.world.getParticle(x, y);
    const props = PARTICLE_PROPERTIES[particle];
    
    // Only solids have collapse risk
    if (!props || props.viscosity < 1.0) return 0;

    const below = this.world.getParticle(x, y + 1);
    const belowProps = PARTICLE_PROPERTIES[below];

    // No support below = potential collapse
    if (below === PARTICLE_TYPES.EMPTY || (belowProps && belowProps.density < 0.5)) {
      let supportSides = 0;
      const left = this.world.getParticle(x - 1, y);
      const right = this.world.getParticle(x + 1, y);
      
      if (PARTICLE_PROPERTIES[left]?.viscosity >= props.viscosity) supportSides++;
      if (PARTICLE_PROPERTIES[right]?.viscosity >= props.viscosity) supportSides++;

      // No side support either = high collapse risk
      if (supportSides === 0) return 0.8;
      if (supportSides === 1) return 0.4;
    }

    return 0;
  }

  /**
   * Update chunk state based on stability score and history.
   */
  updateChunkState(chunkId, instability, deltaTime) {
    const currentState = this.chunkStates[chunkId];

    // Recently woken chunks stay active
    if (this.wokenTicks[chunkId] > 0) {
      this.wokenTicks[chunkId]--;
      this.chunkStates[chunkId] = 0; // Force ACTIVE
      return;
    }

    // Determine target state based on instability
    let targetState;
    if (instability > 0.15) {
      targetState = 0; // ACTIVE
    } else if (instability > 0.02) {
      targetState = 1; // DROWSY
    } else {
      targetState = 2; // SLEEPING
    }

    // Deep bedrock is always FOSSIL
    const isBedrock = this.isChunkBedrock(chunkId);
    if (isBedrock) targetState = 3;

    this.chunkStates[chunkId] = targetState;
  }

  /**
   * Check if chunk is pure bedrock (deep, inert).
   */
  isChunkBedrock(chunkId) {
    const { chunksX, chunkSize } = this.chunkManager;
    const cy = Math.floor(chunkId / chunksX);
    
    // Only chunks in lower half can be pure bedrock
    const thresholdY = Math.floor(this.chunkManager.chunksY * 0.7);
    if (cy < thresholdY) return false;

    // Sample chunk to check if all particles are bedrock/mantle
    const cx = chunkId % chunksX;
    const startX = cx * chunkSize;
    const startY = cy * chunkSize;
    const endX = Math.min(startX + chunkSize, this.world.width);
    const endY = Math.min(startY + chunkSize, this.world.height);

    let bedrockCount = 0;
    let totalCount = 0;
    const sampleStep = Math.max(1, Math.floor(chunkSize / 2));

    for (let y = startY; y < endY; y += sampleStep) {
      for (let x = startX; x < endX; x += sampleStep) {
        totalCount++;
        const particle = this.world.getParticle(x, y);
        if (particle === PARTICLE_TYPES.BEDROCK || particle === PARTICLE_TYPES.MANTLE) {
          bedrockCount++;
        }
      }
    }

    // If >90% bedrock, mark as fossil
    return totalCount > 0 && (bedrockCount / totalCount) > 0.9;
  }

  /**
   * Should chunk be updated this frame?
   */
  shouldUpdateChunk(chunkId) {
    const state = this.chunkStates[chunkId];
    
    switch (state) {
      case 0: // ACTIVE
        return true;
      
      case 1: // DROWSY - reduce update frequency
        this.drowsySkipCounters[chunkId] = (this.drowsySkipCounters[chunkId] + 1) % 3;
        return this.drowsySkipCounters[chunkId] === 0; // Update 1 in 3 times
      
      case 2: // SLEEPING
      case 3: // FOSSIL
        return false;
      
      default:
        return true;
    }
  }

  /**
   * Force-wake a chunk (used by events, external input).
   */
  forceWake(chunkId) {
    this.chunkStates[chunkId] = 0; // ACTIVE
    this.wokenTicks[chunkId] = this.minAwakeTicks;
    this.drowsySkipCounters[chunkId] = 0;
  }

  /**
   * Get chunk state name for debugging.
   */
  getStateName(chunkId) {
    return this.chunkStateNames[this.chunkStates[chunkId]] || 'UNKNOWN';
  }

  /**
   * Get debug stats.
   */
  getStats() {
    let active = 0, drowsy = 0, sleeping = 0, fossil = 0;
    for (let i = 0; i < this.chunkStates.length; i++) {
      switch (this.chunkStates[i]) {
        case 0: active++; break;
        case 1: drowsy++; break;
        case 2: sleeping++; break;
        case 3: fossil++; break;
      }
    }
    return { active, drowsy, sleeping, fossil, total: this.chunkStates.length };
  }
}