/**
 * RenderBridge
 * Maintains particle rendering across all simulation tiers.
 *
 * For Tier 1: Uses actual particles for both simulation and rendering
 * For Tier 2/3: Uses fields for simulation, but maintains particle representation for display
 *
 * This ensures visual continuity during tier transitions and avoids jarring visual changes.
 */
export class RenderBridge {
  constructor(world, canvas, config = {}) {
    this.world = world;
    this.canvas = canvas;

    // Configuration
    this.updateFrequency = config.updateFrequency || 10; // Frames between particle updates
    this.interpolationSmoothing = config.interpolationSmoothing !== false;
    this.maxUpdateCellsPerFrame = config.maxUpdateCellsPerFrame || 1000;
    this.visibilityMargin = config.visibilityMargin || 50; // Pixels beyond viewport

    // State tracking
    this.lastUpdateFrame = 0;
    this.visibleRegion = { x: 0, y: 0, width: 0, height: 0 };
    this.lastFieldHash = 0;
    this.isTier2Or3 = false;

    // Interpolation buffers for smooth transitions
    this.particleBuffer = new Uint8Array(world.size);
    this.interpolationWeights = new Float32Array(world.size);

    // Performance tracking
    this.stats = {
      cellsUpdated: 0,
      particlesGenerated: 0,
      interpolationFrames: 0
    };

    // Cache of last field values for change detection
    this.lastFieldValues = null;
  }

  /**
   * Main update call - should be called each frame
   * Determines if particle update is needed based on tier and view changes
   */
  update(fields, currentTier) {
    this.isTier2Or3 = currentTier && currentTier.key !== 'HUMAN_SCALE';

    // Only update particles for Tier 2/3 where we're using field simulation
    if (!this.isTier2Or3) return;

    // Check if enough frames have passed
    if (this.world.updateCount - this.lastUpdateFrame < this.updateFrequency) return;

    // Check if visible region has changed significantly
    const newRegion = this.getVisibleRegion();
    if (!this.regionsEqual(newRegion, this.visibleRegion)) {
      this.visibleRegion = newRegion;
      this.updateParticlesFromFields(fields, this.visibleRegion);
      this.lastUpdateFrame = this.world.updateCount;
      this.cacheFieldValues(fields);
      return;
    }

    // Check if fields have changed (using simple hash for now)
    const fieldHash = this.hashFields(fields);
    if (fieldHash !== this.lastFieldHash) {
      this.updateParticlesFromFields(fields, this.visibleRegion);
      this.lastFieldHash = fieldHash;
      this.lastUpdateFrame = this.world.updateCount;
      this.cacheFieldValues(fields);
    }
  }

  /**
   * Synchronizes display particles to current field state
   * Only updates particles within the visible region for performance
   */
  updateParticlesFromFields(fields, region) {
    const startX = Math.max(0, Math.floor(region.x / fields.cellSize));
    const startY = Math.max(0, Math.floor(region.y / fields.cellSize));
    const endX = Math.min(fields.width, Math.ceil((region.x + region.width) / fields.cellSize));
    const endY = Math.min(fields.height, Math.ceil((region.y + region.height) / fields.cellSize));

    this.stats.cellsUpdated = 0;

    // Process cells in batches to avoid blocking
    const cellsToProcess = (endX - startX) * (endY - startY);
    const batchSize = Math.min(this.maxUpdateCellsPerFrame, cellsToProcess);

    for (let cy = startY; cy < endY && this.stats.cellsUpdated < batchSize; cy++) {
      for (let cx = startX; cx < endX && this.stats.cellsUpdated < batchSize; cx++) {
        const fieldIdx = cy * fields.width + cx;

        // Skip if this cell hasn't changed significantly
        if (!this.hasFieldCellChanged(fields, cx, cy, fieldIdx)) continue;

        // Convert field cell to particles
        this.convertFieldCellToParticles(fields, cx, cy, fieldIdx);
        this.stats.cellsUpdated++;
      }
    }

    this.stats.particlesGenerated += this.stats.cellsUpdated * (fields.cellSize * fields.cellSize);
  }

  /**
   * Convert a single field cell to particle representation
   * Uses probabilistic placement based on field values
   */
  convertFieldCellToParticles(fields, cx, cy, fieldIdx) {
    const cellSize = fields.cellSize;
    const x0 = cx * cellSize;
    const y0 = cy * cellSize;
    const x1 = Math.min(this.world.width, x0 + cellSize);
    const y1 = Math.min(this.world.height, y0 + cellSize);

    // Get field values
    const elevation = fields.elevation[fieldIdx];
    const temperature = (fields.temperature && fields.temperature[fieldIdx]) ?? (fields.climate && fields.climate.temperature[fieldIdx]) ?? 20;
    const precipitation = (fields.water !== undefined) ? fields.water[fieldIdx] * 1000 : ((fields.climate && fields.climate.precipitation[fieldIdx]) || 0);

    const materialRatios = {
      sand: (fields.rockFracSand || fields.material?.sand || new Float32Array(0))[fieldIdx] || 0,
      soil: (fields.rockFracSoil || fields.material?.soil || new Float32Array(0))[fieldIdx] || 0,
      granite: (fields.rockFracGranite || fields.material?.granite || new Float32Array(0))[fieldIdx] || 0,
      basalt: (fields.rockFracBasalt || fields.material?.basalt || new Float32Array(0))[fieldIdx] || 0
    };

    // Convert normalized elevation to world coordinates
    const surfaceY = Math.floor(this.world.height * (1 - Math.min(1, elevation)));

    // Determine dominant material type
    const dominantType = this.getDominantParticleType(materialRatios);

    // Generate particles based on field data
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        const worldIdx = y * this.world.width + x;

        // Set temperature (map coarse temperature into thermo grid)
        this.world.temperature[worldIdx % this.world.temperature.length] = temperature;

        // Determine particle type based on elevation and material
        if (y >= surfaceY) {
          // Below surface: solid material
          // Use probability based on material ratios
          const rand = Math.random();
          let particleType = 0; // EMPTY default

          if (rand < materialRatios.basalt) {
            particleType = 10; // BASALT
          } else if (rand < materialRatios.basalt + materialRatios.granite) {
            particleType = 3; // GRANITE
          } else if (rand < materialRatios.basalt + materialRatios.granite + materialRatios.sand) {
            particleType = 1; // SAND
          } else {
            particleType = 4; // SOIL
          }

          this.world.particles[worldIdx] = particleType;
        } else {
          // Above surface: air or water based on precipitation
          const waterProb = Math.min(0.3, precipitation / 3000);
          this.world.particles[worldIdx] = Math.random() < waterProb ? 2 : 0; // WATER : EMPTY
        }

        // Mark as updated for rendering
        this.world.updated[worldIdx] = 1;
      }
    }
  }

  /**
   * Get the visible region of the world based on canvas viewport
   */
  getVisibleRegion() {
    const canvasRect = this.canvas.canvas.getBoundingClientRect();
    const scaleX = this.world.width / canvasRect.width;
    const scaleY = this.world.height / canvasRect.height;

    // Account for scroll position if canvas is in a scrollable container
    const container = this.canvas.canvas.parentElement;
    const scrollLeft = container ? container.scrollLeft : 0;
    const scrollTop = container ? container.scrollTop : 0;

    return {
      x: Math.max(0, scrollLeft * scaleX - this.visibilityMargin),
      y: Math.max(0, scrollTop * scaleY - this.visibilityMargin),
      width: Math.min(this.world.width, (canvasRect.width + this.visibilityMargin * 2) * scaleX),
      height: Math.min(this.world.height, (canvasRect.height + this.visibilityMargin * 2) * scaleY)
    };
  }

  /**
   * Smooth visual updates using interpolation between field states
   * Prevents jarring changes when backend updates slowly
   */
  interpolateChanges() {
    if (!this.interpolationSmoothing) return;

    const interpolationFactor = 0.1; // Smoothing factor (0-1)

    // Interpolate between current particles and buffer
    for (let i = 0; i < this.world.size; i++) {
      const current = this.world.particles[i];
      const target = this.particleBuffer[i];

      if (current !== target) {
        // Weighted average for smooth transition
        this.interpolationWeights[i] = current * (1 - interpolationFactor) + target * interpolationFactor;

        // Apply interpolation if weights are significantly different
        if (Math.abs(this.interpolationWeights[i] - current) > 0.1) {
          this.world.particles[i] = Math.round(this.interpolationWeights[i]);
          this.stats.interpolationFrames++;
        }
      }
    }
  }

  /**
   * Check if a field cell has changed significantly
   */
  hasFieldCellChanged(fields, cx, cy, fieldIdx) {
    // Simple threshold-based change detection
    const elevation = fields.elevation[fieldIdx];
    const prevElevation = this.lastFieldValues?.elevation?.[fieldIdx];

    if (prevElevation === undefined) return true;

    // Consider significant if elevation changed by more than 5% of world height
    const threshold = 0.05;
    return Math.abs(elevation - prevElevation) > threshold;
  }

  /**
   * Determine dominant particle type from material ratios
   */
  getDominantParticleType(materialRatios) {
    const { sand, soil, granite, basalt } = materialRatios;
    const total = sand + soil + granite + basalt;

    if (total === 0) return 0; // EMPTY

    const normalized = {
      sand: sand / total,
      soil: soil / total,
      granite: granite / total,
      basalt: basalt / total
    };

    // Return particle type with highest ratio
    if (normalized.basalt > normalized.granite && normalized.basalt > normalized.sand && normalized.basalt > normalized.soil) return 10; // BASALT
    if (normalized.granite > normalized.sand && normalized.granite > normalized.soil) return 3; // GRANITE
    if (normalized.sand > normalized.soil) return 1; // SAND
    return 4; // SOIL
  }

  /**
   * Compare two regions for equality
   */
  regionsEqual(region1, region2) {
    return Math.abs(region1.x - region2.x) < 1 &&
           Math.abs(region1.y - region2.y) < 1 &&
           Math.abs(region1.width - region2.width) < 1 &&
           Math.abs(region1.height - region2.height) < 1;
  }

  /**
   * Simple hash function for field state
   */
  hashFields(fields) {
    let hash = 0;
    const elev = fields.elevation || (fields.elevationField && fields.elevationField.elevation) || [];
    const sampleRate = Math.max(1, Math.floor(elev.length / 100));

    for (let i = 0; i < elev.length; i += sampleRate) {
      hash = ((hash << 5) - hash + Math.round(elev[i] * 1000)) & 0xffffffff;
    }

    return hash;
  }

  /**
   * Get rendering statistics
   */
  getStats() {
    return {
      ...this.stats,
      visibleRegion: this.visibleRegion,
      isInterpolating: this.interpolationSmoothing,
      lastUpdateFrame: this.lastUpdateFrame
    };
  }

  /**
   * Reset statistics
   */
  resetStats() {
    this.stats = {
      cellsUpdated: 0,
      particlesGenerated: 0,
      interpolationFrames: 0
    };
  }

  /**
   * Cache field values for change detection
   */
  cacheFieldValues(fields) {
    this.lastFieldValues = {
      elevation: fields.elevation ? new Float32Array(fields.elevation) : null,
      temperature: (fields.temperature || (fields.climate && fields.climate.temperature)) ? new Float32Array(fields.temperature || fields.climate.temperature) : null,
      precipitation: (fields.water || (fields.climate && fields.climate.precipitation)) ? new Float32Array(fields.water || fields.climate.precipitation) : null
    };
  }
}