import { ParticleCluster } from './ParticleCluster.js';
import { PARTICLE_TYPES, PARTICLE_PROPERTIES } from '../../utils/Constants.js';

/**
 * ClusterManager
 * Manages the lifecycle of particle clusters:
 * - Scans settled regions to create clusters
 * - Merges nearby clusters of same type
 * - Breaks clusters when disturbed (flow, impact, temperature)
 * - Optimizes collision checks by treating clusters as units
 */
export class ClusterManager {
  constructor(world, config = {}) {
    this.world = world;

    // Clustering parameters
    this.minClusterSize = config.minClusterSize || 8;  // Min particles to cluster
    this.maxClusterSize = config.maxClusterSize || 200; // Max before forced split
    this.scanFrequency = config.scanFrequency || 50;   // Scans per sec
    this.mergeThreshold = config.mergeThreshold || 3;   // Max distance to merge

    // Registry
    this.clusters = new Map();    // id -> ParticleCluster
    this.clusterGrid = new Map(); // "x,y" -> cluster id (spatial hash for fast lookup)

    // Statistics
    this.updateCount = 0;
    this.particlesSaved = 0;
    this.clustersActive = 0;
  }

  /**
   * Main update loop: scan, merge, break, age.
   */
  update(deltaTime) {
    this.updateCount++;

    // Age existing clusters
    this.ageClusters(deltaTime);

    // Periodically scan for clusterable regions
    if (this.updateCount % Math.ceil(60 / this.scanFrequency) === 0) {
      this.scanForClusterableRegions();
    }

    // Merge nearby clusters of same type
    if (this.updateCount % 15 === 0) {
      this.attemptMerges();
    }

    // Check for clusters that should split
    this.checkStability();

    // Update spatial hash
    this.rebuildSpatialHash();
  }

  /**
   * Age all clusters and increase their stability.
   */
  ageClusters(deltaTime) {
    for (const cluster of this.clusters.values()) {
      if (!cluster.alive) continue;
      cluster.age_tick(deltaTime);
    }
  }

  /**
   * Scan particle grid for settled regions that can be clustered.
   * Particle is clusterable if:
   * - Same type as neighbors
   * - Not moving (stationary for N frames)
   * - Low local flow/disturbance
   * - Appropriate particle type (not living, not extreme temp)
   */
  scanForClusterableRegions() {
    const w = this.world.width;
    const h = this.world.height;
    const sampleRate = Math.max(1, Math.floor(w * h / 2000)); // Sample ~2000 cells per scan

    for (let i = 0; i < this.world.size; i += sampleRate) {
      const x = i % w;
      const y = Math.floor(i / w);

      const particle = this.world.getParticle(x, y);

      // Skip non-physical particles
      if (!this.isClusterable(particle)) continue;

      // Already in a cluster?
      if (this.getClusterAt(x, y)) continue;

      // Check if settled
      if (!this.isSettled(x, y)) continue;

      // Try to form cluster starting from this particle
      this.formCluster(x, y, particle);
    }
  }

  /**
   * Check if particle type can be clustered.
   */
  isClusterable(type) {
    // Don't cluster living things or extreme materials
    if (type === PARTICLE_TYPES.EMPTY) return false;
    if (type === PARTICLE_TYPES.PLANT || type === PARTICLE_TYPES.ANIMAL) return false;
    if (type === PARTICLE_TYPES.STEAM || type === PARTICLE_TYPES.CLOUD) return false;
    if (type === PARTICLE_TYPES.LAVA) return false; // Too dynamic
    if (type === PARTICLE_TYPES.WATER) return false; // Flows constantly

    // Clusterable: sediments, rock, ice (stable materials)
    return true;
  }

  /**
   * Check if a particle is settled (not moving, low disturbance).
   */
  isSettled(x, y) {
    const particle = this.world.getParticle(x, y);
    const props = PARTICLE_PROPERTIES[particle];
    if (!props) return false;

    // Check temperature extremes
    const temp = this.world.getTemperature(x, y);
    if (Math.abs(temp - 20) > 150) return false;

    // Check pressure extremes
    const pressure = this.world.getPressure(x, y);
    if (pressure < 0.7 || pressure > 2.0) return false;

    // Check for nearby flow or movement
    let disturbance = 0;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy;
        if (!this.world.inBounds(nx, ny)) continue;

        const neighbor = this.world.getParticle(nx, ny);
        // Flow into/out of this cell is disturbance
        if (neighbor === PARTICLE_TYPES.WATER || neighbor === PARTICLE_TYPES.STEAM) {
          disturbance++;
        }
      }
    }

    return disturbance < 3;
  }

  /**
   * Form a cluster around a settled particle.
   * Flood-fill to adjacent same-type settled particles.
   */
  formCluster(startX, startY, type) {
    const visited = new Set();
    const queue = [[startX, startY]];
    const particles = [];

    while (queue.length > 0 && particles.length < this.maxClusterSize) {
      const [x, y] = queue.shift();
      const key = `${x},${y}`;

      if (visited.has(key)) continue;
      visited.add(key);

      // Check bounds and type match
      if (!this.world.inBounds(x, y)) continue;
      if (this.world.getParticle(x, y) !== type) continue;
      if (!this.isSettled(x, y)) continue;

      // Already in another cluster?
      if (this.getClusterAt(x, y)) continue;

      particles.push([x, y]);

      // Queue neighbors
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx, ny = y + dy;
          const nkey = `${nx},${ny}`;
          if (!visited.has(nkey)) {
            queue.push([nx, ny]);
          }
        }
      }
    }

    // Only create cluster if large enough
    if (particles.length >= this.minClusterSize) {
      const cluster = new ParticleCluster(startX, startY, type, particles.length);

      // Average position
      let sumX = 0, sumY = 0;
      for (const [px, py] of particles) {
        sumX += px;
        sumY += py;
      }
      cluster.x = sumX / particles.length;
      cluster.y = sumY / particles.length;

      // Remove original particles from world
      for (const [px, py] of particles) {
        this.world.setParticle(px, py, PARTICLE_TYPES.EMPTY);
      }

      // Register cluster
      this.clusters.set(cluster.id, cluster);
      this.clustersActive = this.clusters.size;
      this.particlesSaved += particles.length;
    }
  }

  /**
   * Attempt to merge nearby clusters of the same type.
   */
  attemptMerges() {
    const clusterArray = Array.from(this.clusters.values());

    for (let i = 0; i < clusterArray.length; i++) {
      const c1 = clusterArray[i];
      if (!c1.alive) continue;

      for (let j = i + 1; j < clusterArray.length; j++) {
        const c2 = clusterArray[j];
        if (!c2.alive) continue;

        if (c1.canMergeWith(c2)) {
          c1.mergeWith(c2);
          this.clusters.delete(c2.id);
        }
      }
    }

    // Clean dead clusters
    for (const [id, cluster] of this.clusters) {
      if (!cluster.alive) {
        this.clusters.delete(id);
      }
    }

    this.clustersActive = this.clusters.size;
  }

  /**
   * Check cluster stability and split if needed.
   */
  checkStability() {
    for (const cluster of this.clusters.values()) {
      if (!cluster.alive) continue;

      // Sample local flow concentration
      let flowNeighbors = 0;
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          const nx = Math.floor(cluster.x + dx);
          const ny = Math.floor(cluster.y + dy);
          if (this.world.inBounds(nx, ny)) {
            const p = this.world.getParticle(nx, ny);
            if (p === PARTICLE_TYPES.WATER || p === PARTICLE_TYPES.STEAM) {
              flowNeighbors++;
            }
          }
        }
      }

      // Check stability
      if (!cluster.isStable(this.world, flowNeighbors)) {
        this.splitCluster(cluster);
      }
    }
  }

  /**
   * Split a cluster back into individual particles.
   */
  splitCluster(cluster) {
    if (!cluster.alive) return;

    // Distribute particles around cluster centroid
    const count = Math.min(cluster.size, cluster.size); // Split all back
    const radius = Math.sqrt(cluster.size) * 2;

    for (let i = 0; i < count; i++) {
      // Distribute particles in a circle around centroid
      const angle = (i / count) * Math.PI * 2;
      const dist = Math.random() * radius;
      const px = Math.floor(cluster.x + Math.cos(angle) * dist);
      const py = Math.floor(cluster.y + Math.sin(angle) * dist);

      if (this.world.inBounds(px, py)) {
        // Only place if empty (to avoid destroying existing particles)
        if (this.world.getParticle(px, py) === PARTICLE_TYPES.EMPTY) {
          this.world.setParticle(px, py, cluster.type);
          this.world.setTemperature(px, py, cluster.temperature);
        }
      }
    }

    cluster.alive = false;
    this.clusters.delete(cluster.id);
  }

  /**
   * Get cluster at a position, if any.
   */
  getClusterAt(x, y) {
    for (const cluster of this.clusters.values()) {
      if (cluster.contains(x, y)) {
        return cluster;
      }
    }
    return null;
  }

  /**
   * Rebuild spatial hash for fast cluster lookup.
   */
  rebuildSpatialHash() {
    this.clusterGrid.clear();
    for (const cluster of this.clusters.values()) {
      if (!cluster.alive) continue;
      const gridX = Math.floor(cluster.x / 16);
      const gridY = Math.floor(cluster.y / 16);
      const key = `${gridX},${gridY}`;
      this.clusterGrid.set(key, cluster.id);
    }
  }

  /**
   * Force split all clusters (e.g., for tier transition).
   */
  splitAll() {
    for (const cluster of this.clusters.values()) {
      if (cluster.alive) {
        this.splitCluster(cluster);
      }
    }
    this.clusters.clear();
  }

  /**
   * Get diagnostic stats.
   */
  getStats() {
    return {
      clustersActive: this.clustersActive,
      totalMergedParticles: this.particlesSaved,
      effectiveParticleReduction: this.particlesSaved > 0 ? 
        (this.particlesSaved / (this.particlesSaved + this.world.size)) * 100 : 0
    };
  }

  /**
   * Get state for serialization.
   */
  getState() {
    return {
      clusters: Array.from(this.clusters.values()).map(c => c.getState())
    };
  }

  /**
   * Restore state from serialization.
   */
  setState(state) {
    if (!state || !state.clusters) return;

    this.clusters.clear();
    for (const clusterState of state.clusters) {
      const cluster = new ParticleCluster(clusterState.x, clusterState.y, clusterState.type, clusterState.size);
      Object.assign(cluster, clusterState);
      this.clusters.set(cluster.id, cluster);
    }
  }
}