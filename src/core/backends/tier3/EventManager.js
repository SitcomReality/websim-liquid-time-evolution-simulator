/** 
 * EventManager
 * Schedules and triggers major geological events that punctuate Tier 3 simulation.
 * Events are probabilistic and condition-based rather than deterministic.
 * 
 * Event types:
 * - Volcanic eruptions (at active subduction zones)
 * - Glacial cycles (driven by temperature oscillations)
 * - Supervolcano eruptions (rare, catastrophic)
 * - Asteroid impacts (optional, very rare)
 */
export class EventManager {
  constructor(plateSystem, fields, config = {}) {
    this.plateSystem = plateSystem;
    this.fields = fields;

    // Event tracking
    this.eventQueue = [];
    this.eventHistory = [];
    this.simulationTime = 0; // in years

    // Cooldown periods to avoid event spam
    this.volcanoLastTime = -100000;
    this.supervolcanoLastTime = -1000000;
    this.impactLastTime = -500000;
    this.volcanoMinCooldown = 50000; // years between major eruptions
    this.supervolcanoMinCooldown = 500000;
    this.impactMinCooldown = 300000;

    // Global climate state
    this.globalTemperature = 20; // °C baseline
    this.temperatureTrend = 0; // warming/cooling rate

    // Event probability parameters
    this.baseVolcanoProbability = 0.02; // per active boundary per year
    this.supervolcanoProbability = 0.0001;
    this.impactProbability = 0.00005;

    this.handlers = {};
    this.registerDefaultHandlers();
  }

  /** 
   * Register default event handler functions.
   */
  registerDefaultHandlers() {
    this.handlers['volcanic_eruption'] = (event) => this.handleVolcanicEruption(event);
    this.handlers['supervolcano'] = (event) => this.handleSupervolcano(event);
    this.handlers['asteroid_impact'] = (event) => this.handleAsteroidImpact(event);
    this.handlers['glacial_advance'] = (event) => this.handleGlacialAdvance(event);
    this.handlers['glacial_retreat'] = (event) => this.handleGlacialRetreat(event);
  }

  /** 
   * Update event system each simulation step.
   */
  update(deltaTime) {
    this.simulationTime += deltaTime;

    // Detect and trigger events based on current conditions
    this.detectVolcanicEvents(deltaTime);
    this.detectSupervolcanoEvent(deltaTime);
    this.detectImpactEvent(deltaTime);

    // Process queued events
    this.processEventQueue();
  }

  /** 
   * Detect volcanic eruptions at active subduction zones.
   */
  detectVolcanicEvents(deltaTime) {
    if (this.simulationTime - this.volcanoLastTime < this.volcanoMinCooldown) return;

    // Find active convergent boundaries
    const convergentBoundaries = this.plateSystem.boundaries.filter(b => b.type === 'convergent');

    for (const boundary of convergentBoundaries) {
      const probability = this.baseVolcanoProbability * (boundary.strength || 1.0) * deltaTime / 1000;

      if (Math.random() < probability) {
        this.scheduleEvent({
          type: 'volcanic_eruption',
          time: this.simulationTime,
          x: boundary.x,
          y: boundary.y,
          strength: boundary.strength || 1.0,
          plateId: boundary.plateB
        });

        this.volcanoLastTime = this.simulationTime;
        break; // One eruption per update cycle
      }
    }
  }

  /** 
   * Detect supervolcano eruption (rare, catastrophic).
   */
  detectSupervolcanoEvent(deltaTime) {
    if (this.simulationTime - this.supervolcanoLastTime < this.supervolcanoMinCooldown) return;

    const probability = this.supervolcanoProbability * deltaTime / 1000;

    if (Math.random() < probability) {
      // Pick random location (typically hotspot or caldera region)
      const x = Math.floor(Math.random() * this.fields.elevationField.width);
      const y = Math.floor(Math.random() * this.fields.elevationField.height);

      this.scheduleEvent({
        type: 'supervolcano',
        time: this.simulationTime,
        x, y,
        strength: 3.0 + Math.random() * 2.0, // Very strong
        duration: 10 // years of activity
      });

      this.supervolcanoLastTime = this.simulationTime;
    }
  }

  /** 
   * Detect asteroid impact (very rare, optional feature).
   */
  detectImpactEvent(deltaTime) {
    if (this.simulationTime - this.impactLastTime < this.impactMinCooldown) return;

    const probability = this.impactProbability * deltaTime / 1000;

    if (Math.random() < probability) {
      const x = Math.floor(Math.random() * this.fields.elevationField.width);
      const y = Math.floor(Math.random() * this.fields.elevationField.height);
      const size = 3 + Math.floor(Math.random() * 8); // Impact crater size in cells

      this.scheduleEvent({
        type: 'asteroid_impact',
        time: this.simulationTime,
        x, y,
        craterSize: size,
        energyRelease: size * size * 100
      });

      this.impactLastTime = this.simulationTime;
    }
  }

  /** 
   * Schedule an event to occur (optionally with delay).
   */
  scheduleEvent(event, delayYears = 0) {
    event.scheduledTime = this.simulationTime + delayYears;
    this.eventQueue.push(event);
  }

  /** 
   * Process all events ready to fire.
   */
  processEventQueue() {
    for (let i = this.eventQueue.length - 1; i >= 0; i--) {
      const event = this.eventQueue[i];

      if (event.scheduledTime <= this.simulationTime) {
        // Trigger event
        if (this.handlers[event.type]) {
          this.handlers[event.type](event);
        }

        // Record in history
        this.eventHistory.push(event);

        // Remove from queue
        this.eventQueue.splice(i, 1);
      }
    }
  }

  /** 
   * Handle volcanic eruption event.
   */
  handleVolcanicEruption(event) {
    const { x, y, strength } = event;
    const W = this.fields.elevationField.width;
    const H = this.fields.elevationField.height;

    if (x < 0 || x >= W || y < 0 || y >= H) return;

    // Build a cone
    const coneRadius = Math.ceil(2 + strength);
    for (let dy = -coneRadius; dy <= coneRadius; dy++) {
      for (let dx = -coneRadius; dx <= coneRadius; dx++) {
        const cx = x + dx, cy = y + dy;
        if (cx < 0 || cx >= W || cy < 0 || cy >= H) continue;

        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist <= coneRadius) {
          // Cone profile: triangular from base to summit
          const height = strength * 0.03 * (1 - (dist / coneRadius));
          this.fields.elevationField.adjustElevation(cx, cy, height);

          // Add basalt
          this.fields.materialField.addMaterial(cx, cy, 'basalt', 0.08 * (1 - dist / coneRadius));

          // Heat the region
          const tempIdx = this.fields.climateField.getIndex(cx, cy);
          if (tempIdx >= 0) {
            this.fields.climateField.temperature[tempIdx] += 100 * (1 - dist / coneRadius);
          }
        }
      }
    }

    console.log(`[EventManager] Volcanic eruption at (${x},${y}) strength=${strength.toFixed(2)}`);
  }

  /** 
   * Handle supervolcano eruption (massive, affects global climate).
   */
  handleSupervolcano(event) {
    const { x, y, strength, duration } = event;
    const W = this.fields.elevationField.width;
    const H = this.fields.elevationField.height;

    // Create massive caldera (subsidence)
    const caldRadius = Math.ceil(5 + strength * 2);
    for (let dy = -caldRadius; dy <= caldRadius; dy++) {
      for (let dx = -caldRadius; dx <= caldRadius; dx++) {
        const cx = x + dx, cy = y + dy;
        if (cx < 0 || cx >= W || cy < 0 || cy >= H) continue;

        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist <= caldRadius) {
          // Caldera subsidence (negative elevation change)
          const subsidence = -0.15 * strength * (1 - (dist / caldRadius) * 0.5);
          this.fields.elevationField.adjustElevation(cx, cy, subsidence);

          // Add ash (represented as fine sediment/soil)
          this.fields.materialField.addMaterial(cx, cy, 'soil', 0.15 * (1 - dist / caldRadius));
        }
      }
    }

    // Pyroclastic flows extend further
    const flowRadius = caldRadius * 1.5;
    for (let dy = -flowRadius; dy <= flowRadius; dy++) {
      for (let dx = -flowRadius; dx <= flowRadius; dx++) {
        const cx = x + dx, cy = y + dy;
        if (cx < 0 || cx >= W || cy < 0 || cy >= H) continue;

        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > caldRadius && dist <= flowRadius) {
          // Deposit ash/tephra
          this.fields.materialField.addMaterial(cx, cy, 'basalt', 0.03);
          this.fields.materialField.addMaterial(cx, cy, 'soil', 0.02);
        }
      }
    }

    // Global climate impact: temporary cooling (volcanic aerosols)
    this.globalTemperature -= 5 * strength; // Massive cooling

    // Schedule gradual recovery over years
    for (let year = 0; year < Math.ceil(duration); year += 10) {
      this.scheduleEvent({
        type: 'volcanic_aerosol_decay',
        time: this.simulationTime + year,
        cooling: 5 * strength / (duration / 10)
      });
    }

    console.log(`[EventManager] SUPERVOLCANO eruption at (${x},${y}) strength=${strength.toFixed(2)}`);
  }

  /** 
   * Handle asteroid impact (crater formation, ejecta).
   */
  handleAsteroidImpact(event) {
    const { x, y, craterSize, energyRelease } = event;
    const W = this.fields.elevationField.width;
    const H = this.fields.elevationField.height;

    if (x < 0 || x >= W || y < 0 || y >= H) return;

    // Create impact crater
    const craterRadius = craterSize;
    for (let dy = -craterRadius; dy <= craterRadius; dy++) {
      for (let dx = -craterRadius; dx <= craterRadius; dx++) {
        const cx = x + dx, cy = y + dy;
        if (cx < 0 || cx >= W || cy < 0 || cy >= H) continue;

        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist <= craterRadius) {
          // Crater depression (bowl shape)
          const depth = -0.08 * (1 - (dist / craterRadius) * 0.7);
          this.fields.elevationField.adjustElevation(cx, cy, depth);

          // Mix up material (impact mixing)
          const mat = this.fields.materialField.getDominantType(cx, cy);
          this.fields.materialField.addMaterial(cx, cy, 'soil', 0.05);
        }
      }
    }

    // Ejecta blanket (rim)
    const rimRadius = craterRadius * 2;
    for (let dy = -rimRadius; dy <= rimRadius; dy++) {
      for (let dx = -rimRadius; dx <= rimRadius; dx++) {
        const cx = x + dx, cy = y + dy;
        if (cx < 0 || cx >= W || cy < 0 || cy >= H) continue;

        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > craterRadius && dist <= rimRadius) {
          // Raised rim
          const rimHeight = 0.04 * (1 - (dist - craterRadius) / craterRadius);
          this.fields.elevationField.adjustElevation(cx, cy, rimHeight);
          this.fields.materialField.addMaterial(cx, cy, 'granite', 0.02);
        }
      }
    }

    // Global impact: temporary warming, dust in atmosphere
    this.globalTemperature -= 10; // Initially blocks sunlight
    this.scheduleEvent({
      type: 'impact_recovery',
      time: this.simulationTime + 5,
      warming: 10
    });

    console.log(`[EventManager] Asteroid impact at (${x},${y}) crater=${craterSize} energy=${energyRelease}`);
  }

  /** 
   * Handle glacial advance (ice age begins).
   */
  handleGlacialAdvance(event) {
    console.log(`[EventManager] Glacial advance begins`);
    // Details delegated to GlacialCycles
  }

  /** 
   * Handle glacial retreat (ice age ends).
   */
  handleGlacialRetreat(event) {
    console.log(`[EventManager] Glacial retreat begins`);
    // Details delegated to GlacialCycles
  }

  /** 
   * Get event summary for UI or logging.
   */
  getEventSummary() {
    return {
      queued: this.eventQueue.length,
      history: this.eventHistory.slice(-10), // Last 10 events
      globalTemperature: this.globalTemperature
    };
  }
}