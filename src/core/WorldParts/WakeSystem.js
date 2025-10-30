/**
 * WakeSystem
 * Manages waking sleeping chunks and propagating wake signals.
 * 
 * Responsibilities:
 * - Propagate wake signals from active chunks to nearby sleeping chunks (wake radius)
 * - Handle event-driven waking (earthquakes, volcanoes, player interaction)
 * - Downgrades distant neighbors to DROWSY
 * - Implements hysteresis to prevent thrashing
 */
export class WakeSystem {
  constructor(world, chunkManager, chunkStability, config = {}) {
    this.world = world;
    this.chunkManager = chunkManager;
    this.chunkStability = chunkStability;

    // Wake propagation parameters
    this.wakeRadius = config.wakeRadius ?? 2;           // Chunks to wake around active
    this.drowseRadius = config.drowseRadius ?? 3;       // Chunks to make drowsy
    this.maxWakeEventsPerFrame = config.maxWakeEventsPerFrame ?? 5;
    this.updateFrequency = config.updateFrequency ?? 10; // Frames between propagation updates

    // Event queue
    this.wakeEventQueue = [];
    this.updateCounter = 0;
  }

  /**
   * Update propagation each frame.
   */
  update(deltaTime) {
    this.updateCounter++;
    
    // Process queued events
    this.processWakeEvents();
    
    // Periodically propagate wake from active chunks
    if (this.updateCounter % this.updateFrequency === 0) {
      this.propagateWake();
    }
  }

  /**
   * Queue a wake event (e.g., earthquake, volcano, player interaction).
   */
  scheduleWakeEvent(centerX, centerY, radius, intensity = 1.0) {
    this.wakeEventQueue.push({
      centerX, centerY, radius, intensity,
      time: this.world.simulationTime || 0
    });
  }

  /**
   * Process queued wake events.
   */
  processWakeEvents() {
    const { chunkSize, chunksX, chunksY } = this.chunkManager;
    const maxEvents = Math.min(this.maxWakeEventsPerFrame, this.wakeEventQueue.length);

    for (let i = 0; i < maxEvents; i++) {
      const event = this.wakeEventQueue.shift();
      if (!event) break;

      // Convert world coordinates to chunk coordinates
      const centerChunkX = Math.floor(event.centerX / chunkSize);
      const centerChunkY = Math.floor(event.centerY / chunkSize);

      // Wake chunks in radius
      const chunkRadius = Math.ceil(event.radius / chunkSize);
      for (let cy = -chunkRadius; cy <= chunkRadius; cy++) {
        for (let cx = -chunkRadius; cx <= chunkRadius; cx++) {
          const chunkX = centerChunkX + cx;
          const chunkY = centerChunkY + cy;

          if (chunkX < 0 || chunkX >= chunksX || chunkY < 0 || chunkY >= chunksY) continue;

          const chunkId = chunkY * chunksX + chunkX;
          const distance = Math.sqrt(cx * cx + cy * cy);

          // Full wake if close
          if (distance <= chunkRadius * 0.5) {
            this.chunkStability.forceWake(chunkId);
          } else if (distance <= chunkRadius) {
            // Drowsy if farther
            const currentState = this.chunkStability.chunkStates[chunkId];
            if (currentState >= 2) { // SLEEPING or FOSSIL
              this.chunkStability.chunkStates[chunkId] = 1; // DROWSY
              this.chunkStability.wokenTicks[chunkId] = this.chunkStability.minAwakeTicks;
            }
          }
        }
      }
    }
  }

  /**
   * Propagate wake signals from ACTIVE chunks to nearby sleeping chunks.
   */
  propagateWake() {
    const { chunksX, chunksY } = this.chunkManager;
    const { chunkStates } = this.chunkStability;

    // Find all ACTIVE chunks
    const activeChunks = [];
    for (let i = 0; i < chunkStates.length; i++) {
      if (chunkStates[i] === 0) { // ACTIVE
        activeChunks.push(i);
      }
    }

    // For each ACTIVE chunk, propagate wake
    for (const activeId of activeChunks) {
      const activeCx = activeId % chunksX;
      const activeCy = Math.floor(activeId / chunksX);

      // Wake chunks within wake radius
      for (let cy = -this.wakeRadius; cy <= this.wakeRadius; cy++) {
        for (let cx = -this.wakeRadius; cx <= this.wakeRadius; cx++) {
          const chunkX = activeCx + cx;
          const chunkY = activeCy + cy;

          if (chunkX < 0 || chunkX >= chunksX || chunkY < 0 || chunkY >= chunksY) continue;

          const chunkId = chunkY * chunksX + chunkX;
          const distance = Math.sqrt(cx * cx + cy * cy);

          // Skip the active chunk itself
          if (distance === 0) continue;

          const currentState = chunkStates[chunkId];

          // Wake nearby sleeping chunks
          if (distance <= this.wakeRadius && currentState === 2) { // SLEEPING
            this.chunkStability.forceWake(chunkId);
          }
          // Downgrade distant to drowsy
          else if (distance <= this.drowseRadius && currentState === 2) { // SLEEPING
            chunkStates[chunkId] = 1; // DROWSY
            this.chunkStability.wokenTicks[chunkId] = Math.ceil(this.chunkStability.minAwakeTicks * 0.5);
          }
        }
      }
    }
  }

  /**
   * Get stats on queued events.
   */
  getStats() {
    return {
      queuedEvents: this.wakeEventQueue.length,
      maxQueueSize: this.maxWakeEventsPerFrame
    };
  }
}