import { PARTICLE_TYPES, PARTICLE_PROPERTIES } from '../../utils/Constants.js';

/**
 * ParticleCluster
 * Represents a merged group of stable, adjacent particles of the same type.
 * Reduces simulation cost by treating multiple settled particles as a single entity.
 * 
 * When disturbed (impact, flow, etc.), clusters split back into particles.
 */
export class ParticleCluster {
  constructor(x, y, type, size = 1) {
    this.id = Math.random() * 0x100000000 | 0; // Unique ID
    this.x = x;           // Centroid x
    this.y = y;           // Centroid y
    this.type = type;
    this.size = size;     // Number of particles merged into this cluster
    this.mass = size;     // Total mass equivalent
    this.age = 0;         // Age in updates (increases stability)
    this.stability = 0.1; // 0..1, increases with age
    this.temperature = 20; // Average temperature of particles

    // Bounding box (approximate, for fast checks)
    this.minX = x;
    this.maxX = x;
    this.minY = y;
    this.maxY = y;

    // Flags
    this.alive = true;
    this.shouldSplit = false;
  }

  /**
   * Add mass to this cluster (merge another particle or cluster).
   */
  absorbParticle(x, y, temp = 20) {
    // Weighted average position
    const newMass = this.mass + 1;
    this.x = (this.x * this.mass + x) / newMass;
    this.y = (this.y * this.mass + y) / newMass;
    this.mass = newMass;
    this.size += 1;

    // Update bounds
    this.minX = Math.min(this.minX, x);
    this.maxX = Math.max(this.maxX, x);
    this.minY = Math.min(this.minY, y);
    this.maxY = Math.max(this.maxY, y);

    // Weighted temperature average
    this.temperature = (this.temperature * (this.mass - 1) + temp) / this.mass;
  }

  /**
   * Check if this cluster is still stable (not disturbed).
   * Returns true if cluster should remain merged; false if it should split.
   */
  isStable(world, nearbyFlow = 0) {
    // Very young clusters are fragile
    if (this.age < 5) return false;

    // Nearby flow destabilizes the cluster
    if (nearbyFlow > 2) {
      this.shouldSplit = true;
      return false;
    }

    // Check temperature: extreme heat destabilizes
    const temp = world.getTemperature(this.x, this.y);
    if (Math.abs(temp - 20) > 200) return false;

    // Pressure changes destabilize
    const pressure = world.getPressure(this.x, this.y);
    if (pressure > 2.5 || pressure < 0.5) return false;

    return true;
  }

  /**
   * Mark this cluster for splitting (happens next update).
   */
  markForSplit() {
    this.shouldSplit = true;
  }

  /**
   * Age the cluster (increases stability).
   */
  age_tick(deltaTime) {
    this.age += 1;
    // Stability increases logarithmically with age
    this.stability = Math.min(0.95, Math.log(this.age + 1) / 10);
  }

  /**
   * Get the radius (approximate size in pixels).
   */
  getRadius() {
    // Radius increases with sqrt(mass) to approximate area
    return Math.sqrt(this.size) * 1.5;
  }

  /**
   * Check if a point is within cluster bounds.
   */
  contains(x, y) {
    const r = this.getRadius();
    const dx = x - this.x;
    const dy = y - this.y;
    return dx * dx + dy * dy <= r * r;
  }

  /**
   * Check if two clusters can merge (same type, close proximity).
   */
  canMergeWith(other) {
    if (this.type !== other.type) return false;
    if (!this.alive || !other.alive) return false;
    if (this.shouldSplit || other.shouldSplit) return false;

    // Must be close enough (touching or overlapping bounds)
    const dx = this.x - other.x;
    const dy = this.y - other.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const minDist = this.getRadius() + other.getRadius() + 2;

    return dist <= minDist;
  }

  /**
   * Merge another cluster into this one.
   */
  mergeWith(other) {
    const newMass = this.mass + other.mass;
    this.x = (this.x * this.mass + other.x * other.mass) / newMass;
    this.y = (this.y * this.mass + other.y * other.mass) / newMass;
    this.mass = newMass;
    this.size += other.size;

    // Update bounds
    this.minX = Math.min(this.minX, other.minX);
    this.maxX = Math.max(this.maxX, other.maxX);
    this.minY = Math.min(this.minY, other.minY);
    this.maxY = Math.max(this.maxY, other.maxY);

    // Average stability (older cluster wins)
    this.stability = (this.stability + other.stability) / 2;
    this.age = Math.min(this.age, other.age); // Don't gain age from merge

    other.alive = false;
  }

  /**
   * Get state for serialization.
   */
  getState() {
    return {
      id: this.id,
      x: this.x,
      y: this.y,
      type: this.type,
      size: this.size,
      mass: this.mass,
      age: this.age,
      stability: this.stability,
      temperature: this.temperature,
      minX: this.minX,
      maxX: this.maxX,
      minY: this.minY,
      maxY: this.maxY
    };
  }
}