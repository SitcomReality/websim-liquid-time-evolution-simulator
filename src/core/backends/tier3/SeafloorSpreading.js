/** 
 * SeafloorSpreading
 * Handles divergent plate boundaries (mid-ocean ridges).
 * 
 * Processes:
 * - Rift valley creation (subsidence)
 * - New oceanic crust generation (basalt)
 * - Symmetric spreading on both sides
 * - Crustal thickness variation
 */
export class SeafloorSpreading {
  constructor(plateSystem, fields) {
    this.plateSystem = plateSystem;
    this.fields = fields;
    this.spreadingRate = 0.01; // Relative spreading per event
    this.riftWidth = 4; // Cells
    this.newCrustBasaltAmount = 0.08; // Material per update
  }

  /** 
   * Process all divergent boundaries.
   */
  update(deltaTime) {
    this.plateSystem.detectBoundaries();
    
    for (const boundary of this.plateSystem.boundaries) {
      if (boundary.type === 'divergent') {
        this.handleSpreading(boundary, deltaTime);
      }
    }
  }

  /** 
   * Handle a single divergent boundary (mid-ocean ridge).
   */
  handleSpreading(boundary, deltaTime) {
    const { x, y, plateA: idA, plateB: idB, relVelMag } = boundary;
    const plateA = this.plateSystem.plates[idA];
    const plateB = this.plateSystem.plates[idB];
    
    if (!plateA || !plateB) return;
    
    // Create rift valley along the boundary
    this.createRiftValley(x, y, plateA, plateB, relVelMag, deltaTime);
    
    // Generate new crust symmetrically on both sides
    this.addNewCrust(x, y, -1, relVelMag, deltaTime); // Left side
    this.addNewCrust(x, y, 1, relVelMag, deltaTime);  // Right side
    
    // Reset crust age along spreading center
    this.resetSpreadingCrust(x, y, 2);
  }

  /** 
   * Create a rift valley (subsidence) at the spreading center.
   */
  createRiftValley(x, y, plateA, plateB, strength, deltaTime) {
    const valleyDepth = Math.max(-0.015, -0.005 * strength * deltaTime); // Negative = subsidence
    
    for (let dx = -this.riftWidth; dx <= this.riftWidth; dx++) {
      const rx = x + dx;
      if (rx < 0 || rx >= this.fields.elevationField.width) continue;
      
      // Deeper in the center
      const distFromCenter = Math.abs(dx);
      const factor = Math.max(0, 1 - (distFromCenter / this.riftWidth));
      const localSubsidence = valleyDepth * factor;
      
      this.fields.elevationField.adjustElevation(rx, y, localSubsidence);
      
      // Replace crust with basalt (oceanic material)
      this.fields.materialField.removeMaterial(rx, y, 'granite', 0.03 * factor);
      this.fields.materialField.addMaterial(rx, y, 'basalt', 0.03 * factor);
    }
  }

  /** 
   * Add new oceanic crust (basalt) on one side of the ridge.
   */
  addNewCrust(x, y, direction, strength, deltaTime) {
    // Direction: -1 for left, 1 for right
    const spreadWidth = Math.ceil(strength * 3);
    const newBasalt = this.newCrustBasaltAmount * deltaTime;
    
    for (let dx = 1; dx <= spreadWidth; dx++) {
      const cx = x + (dx * direction);
      if (cx < 0 || cx >= this.fields.elevationField.width) continue;
      
      // Falloff: crust freshest nearest ridge
      const age = dx / spreadWidth;
      const crustAmount = newBasalt * Math.max(0, 1 - age);
      
      // Add basalt
      this.fields.materialField.addMaterial(cx, y, 'basalt', crustAmount);
      
      // Young crust is slightly elevated (mid-ocean ridge topography)
      const elevation = 0.003 * (1 - age);
      this.fields.elevationField.adjustElevation(cx, y, elevation);
    }
  }

  /** 
   * Reset crustal age at the spreading center.
   */
  resetSpreadingCrust(x, y, width) {
    for (let dx = -width; dx <= width; dx++) {
      const cx = x + dx;
      if (cx < 0 || cx >= this.fields.elevationField.width) continue;
      this.plateSystem.resetCrustAge(cx, y);
    }
  }
}