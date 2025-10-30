/** 
 * SubductionHandler
 * Handles convergent plate boundaries where oceanic crust subducts beneath continental crust.
 * 
 * Processes:
 * - Plate collision detection
 * - Oceanic vs continental determination
 * - Mountain building (thrust faults, uplift)
 * - Volcanic arc generation
 * - Earthquake events (for tier transition triggers)
 */
export class SubductionHandler {
  constructor(plateSystem, fields) {
    this.plateSystem = plateSystem;
    this.fields = fields;
    this.mountainBuildRate = 0.01; // Elevation gain per event
    this.volcanicArcSpacing = 8; // Cells between arc volcanoes
  }

  /** 
   * Process all convergent boundaries detected by the plate system.
   */
  update(deltaTime) {
    this.plateSystem.detectBoundaries(); 
    
    for (const boundary of this.plateSystem.boundaries) {
      if (boundary.type === 'convergent') {
        this.handleConvergence(boundary, deltaTime);
      }
    }
  }

  /** 
   * Handle a single convergent boundary.
   */
  handleConvergence(boundary, deltaTime) {
    const { x, y, plateA: idA, plateB: idB, strength } = boundary;
    const plateA = this.plateSystem.plates[idA];
    const plateB = this.plateSystem.plates[idB]; 
    
    if (!plateA || !plateB) return;
    
    // Determine which plate is subducting (oceanic plate subducts)
    let underThrust, overRide;
    if (plateA.type === 'oceanic' && plateB.type === 'continental') {
      underThrust = plateA;
      overRide = plateB;
    } else if (plateB.type === 'oceanic' && plateA.type === 'continental') {
      underThrust = plateB;
      overRide = plateA;
    } else if (plateA.type === 'oceanic' && plateB.type === 'oceanic') {
      // Ocean-ocean collision: younger subducts
      const ageA = this.plateSystem.plateAgeField[this.plateSystem.getIndex(x, y)];
      const ageB = this.plateSystem.plateAgeField[this.plateSystem.getIndex(x + 1, y)];
      underThrust = ageA > ageB ? plateA : plateB;
      overRide = ageA > ageB ? plateB : plateA;
    } else {
      // Continent-continent collision: no subduction, just uplift
      this.buildMountainRange(x, y, strength, deltaTime);
      return;
    }
    
    // Subduction zone: create mountain on overriding plate
    this.buildSubductionZoneMountains(x, y, overRide, strength, deltaTime);
    
    // Create volcanic arc behind the thrust front
    if (Math.random() < 0.3 * strength * deltaTime) {
      this.createVolcanicArc(x, y, overRide, deltaTime);
    }
  }

  /** 
   * Build mountains along a subduction zone.
   */
  buildSubductionZoneMountains(x, y, overridingPlate, strength, deltaTime) {
    // Uplift near the boundary on the overriding plate side
    const upliftWidth = 3 + Math.floor(strength * 5);
    const upliftHeight = Math.floor(strength * 0.008 * deltaTime);
    
    for (let dx = 0; dx < upliftWidth; dx++) {
      for (let dy = -2; dy <= 0; dy++) {
        const ux = x + dx;
        const uy = y + dy;
        
        if (!this.fields.elevationField.getIndex || ux < 0 || ux >= this.fields.elevationField.width) continue;
        
        // Check if cell belongs to overriding plate
        const plate = this.plateSystem.getPlateAt(ux, uy);
        if (plate && plate.id === overridingPlate.id) {
          // Decrease uplift with distance from boundary
          const distFromBoundary = dx;
          const localUplift = upliftHeight * Math.max(0, 1 - distFromBoundary / upliftWidth);
          this.fields.elevationField.adjustElevation(ux, uy, localUplift);
          
          // Harden overriding plate rock (more granite)
          const ratio = this.fields.materialField.getMaterialRatio(ux, uy, 'granite');
          if (ratio < 0.8) {
            this.fields.materialField.addMaterial(ux, uy, 'granite', 0.02);
          }
        }
      }
    }
  }

  /** 
   * Build a mountain range from continent-continent collision.
   */
  buildMountainRange(x, y, strength, deltaTime) {
    const upliftHeight = Math.floor(strength * 0.015 * deltaTime);
    const width = 2 + Math.floor(strength * 8);
    
    for (let dx = -width; dx <= width; dx++) {
      const ux = x + dx;
      if (ux < 0 || ux >= this.fields.elevationField.width) continue;
      
      // Gaussian falloff from center
      const dist = Math.abs(dx);
      const factor = Math.exp(-(dist * dist) / (width * width / 4));
      const localUplift = upliftHeight * factor;
      
      this.fields.elevationField.adjustElevation(ux, y, localUplift);
      
      // Add granite (continental crust thickening)
      this.fields.materialField.addMaterial(ux, y, 'granite', 0.03 * factor);
    }
  }

  /** 
   * Create volcanic arc volcanoes on the overriding plate, landward of the trench.
   */
  createVolcanicArc(x, y, overridingPlate, deltaTime) {
    // Arc is ~30-50 km landward; simulate as 3-5 cells away
    const arcDistance = 4 + Math.floor(Math.random() * 2);
    const vx = Math.sign(overridingPlate.velocityX) * arcDistance;
    const vy = Math.sign(overridingPlate.velocityY) * arcDistance;
    
    const volcX = Math.floor(x + vx);
    const volcY = Math.floor(y + vy);
    
    if (volcX < 0 || volcX >= this.fields.elevationField.width) return;
    if (volcY < 0 || volcY >= this.fields.elevationField.height) return;
    
    // Build a small volcano: uplift + basalt/lava
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        if (dx * dx + dy * dy > 4) continue;
        
        const vy = volcY + dy;
        const vx = volcX + dx;
        if (vx < 0 || vx >= this.fields.elevationField.width) continue;
        
        // Cone shape
        const dist = Math.sqrt(dx * dx + dy * dy);
        const uplift = Math.max(0, 0.02 * (1 - dist / 2));
        this.fields.elevationField.adjustElevation(vx, vy, uplift);
        
        // Add basalt (new mafic crust from melting)
        this.fields.materialField.addMaterial(vx, vy, 'basalt', 0.05);
      }
    }
    
    // Heat the volcanic region
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const hx = volcX + dx, hy = volcY + dy;
        if (hx >= 0 && hx < this.fields.elevationField.width) {
          const temp = this.fields.climateField.getTemperature(hx, hy);
          this.fields.climateField.temperature[this.fields.climateField.getIndex(hx, hy)] = temp + 200;
        }
      }
    }
  }
}