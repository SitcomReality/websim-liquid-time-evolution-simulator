/**
 * PlateSystem
 * Manages tectonic plates for Tier 3 (tectonic timescale).
 * 
 * Represents the world as a mosaic of plates that move, collide, and interact.
 * Plates carry the field grid data with them; boundaries trigger geological events.
 */
export class PlateSystem {
  constructor(fields, config = {}) {
    this.fields = fields;
    this.width = fields.elevationField.width;
    this.height = fields.elevationField.height;
    
    // Configuration
    this.cellSize = config.cellSize || 32;
    this.numPlatesX = config.numPlatesX || Math.max(2, Math.floor(this.width / 8));
    this.numPlatesY = config.numPlatesY || Math.max(2, Math.floor(this.height / 8));
    
    // Plate storage
    this.plates = [];
    this.plateIdField = new Uint16Array(this.width * this.height);
    this.plateAgeField = new Float32Array(this.width * this.height); // Age of crust in each cell
    
    this.boundaries = []; // Active boundary segments
    this.updateCount = 0;
    
    this.initializePlates();
  }

  /**
   * Initialize plate mosaic by dividing world into rectangular plates.
   */
  initializePlates() {
    const w = this.numPlatesX;
    const h = this.numPlatesY;
    const cellW = this.width / w;
    const cellH = this.height / h;
    
    let plateId = 0;
    
    for (let py = 0; py < h; py++) {
      for (let px = 0; px < w; px++) {
        const plate = {
          id: plateId++,
          // Center of plate
          centerX: (px + 0.5) * cellW,
          centerY: (py + 0.5) * cellH,
          // Velocity (mm/year equivalent, scaled to sim units)
          velocityX: (Math.random() - 0.5) * 0.3,
          velocityY: (Math.random() - 0.5) * 0.3,
          // Type: oceanic (density 3.0) or continental (density 2.7)
          // Roughly: odd IDs are oceanic, even are continental
          type: (plateId % 2 === 0) ? 'continental' : 'oceanic',
          density: (plateId % 2 === 0) ? 2.7 : 3.0,
          // Bounds
          minX: Math.floor(px * cellW),
          maxX: Math.floor((px + 1) * cellW),
          minY: Math.floor(py * cellH),
          maxY: Math.floor((py + 1) * cellH)
        };
        
        this.plates.push(plate);
        
        // Assign cells to this plate
        for (let y = plate.minY; y < plate.maxY; y++) {
          for (let x = plate.minX; x < plate.maxX; x++) {
            const idx = this.getIndex(x, y);
            this.plateIdField[idx] = plate.id;
            this.plateAgeField[idx] = Math.random() * 100; // Random initial crust age
          }
        }
      }
    }
  }

  getIndex(x, y) {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return -1;
    return y * this.width + x;
  }

  /**
   * Move plates according to their velocity vectors.
   * This is simplified: we track which plate "owns" each cell and detect boundaries.
   */
  updatePlatePositions(deltaTime) {
    this.updateCount++;
    
    // Move plate centers
    for (const plate of this.plates) {
      plate.centerX += plate.velocityX * deltaTime * 0.01; // Scale for visualization
      plate.centerY += plate.velocityY * deltaTime * 0.01;
      
      // Wrap around world edges (toroidal topology, optional)
      if (plate.centerX < 0) plate.centerX += this.width;
      if (plate.centerX >= this.width) plate.centerX -= this.width;
      if (plate.centerY < 0) plate.centerY += this.height;
      if (plate.centerY >= this.height) plate.centerY -= this.height;
    }
    
    // Age the crust: older crust becomes denser
    for (let i = 0; i < this.plateAgeField.length; i++) {
      this.plateAgeField[i] += deltaTime * 0.001; // Slow aging
    }
    
    // Reassign cell ownership based on nearest plate (simplified approach)
    // In reality, plates deform and shear; here we use nearest-neighbor for simplicity
    if (this.updateCount % 10 === 0) {
      this.reassignCells();
    }
  }

  /**
   * Reassign cells to nearest plate center (simplified deformation).
   */
  reassignCells() {
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        let closest = null;
        let minDist = Infinity;
        
        for (const plate of this.plates) {
          const dx = (x - plate.centerX);
          const dy = (y - plate.centerY);
          const dist = dx * dx + dy * dy;
          
          if (dist < minDist) {
            minDist = dist;
            closest = plate;
          }
        }
        
        if (closest) {
          const idx = this.getIndex(x, y);
          this.plateIdField[idx] = closest.id;
        }
      }
    }
  }

  /**
   * Detect plate boundaries by scanning for adjacent cells with different plate IDs.
   */
  detectBoundaries() {
    this.boundaries = [];
    
    for (let y = 0; y < this.height - 1; y++) {
      for (let x = 0; x < this.width - 1; x++) {
        const idx = this.getIndex(x, y);
        const idA = this.plateIdField[idx];
        
        // Check right neighbor
        const idRight = this.plateIdField[this.getIndex(x + 1, y)];
        if (idRight !== idA) {
          const boundary = this.classifyBoundary(x, y, idA, idRight);
          if (boundary) this.boundaries.push(boundary);
        }
        
        // Check down neighbor
        const idDown = this.plateIdField[this.getIndex(x, y + 1)];
        if (idDown !== idA) {
          const boundary = this.classifyBoundary(x, y, idA, idDown);
          if (boundary) this.boundaries.push(boundary);
        }
      }
    }
  }

  /**
   * Classify boundary type based on relative plate velocities and types.
   */
  classifyBoundary(x, y, idA, idB) {
    const plateA = this.plates[idA];
    const plateB = this.plates[idB];
    
    if (!plateA || !plateB) return null;
    
    // Relative velocity
    const relVx = plateB.velocityX - plateA.velocityX;
    const relVy = plateB.velocityY - plateA.velocityY;
    const relMag = Math.sqrt(relVx * relVx + relVy * relVy);
    
    if (relMag < 0.001) {
      return { x, y, type: 'transform', plateA: idA, plateB: idB, strength: 0 };
    }
    
    // Dot product with boundary normal (approximate: vertical)
    // Positive = plates moving apart (divergent), negative = converging (convergent)
    const boundaryNormalX = 1; // Rough approximation
    const dot = relVx * boundaryNormalX;
    
    let boundaryType = 'transform';
    if (dot > 0.05) {
      boundaryType = 'divergent'; // Spreading ridge
    } else if (dot < -0.05) {
      boundaryType = 'convergent'; // Subduction/collision
    }
    
    return {
      x, y,
      type: boundaryType,
      plateA: idA,
      plateB: idB,
      strength: Math.abs(dot),
      relVelMag: relMag
    };
  }

  /**
   * Get the plate at a given cell.
   */
  getPlateAt(x, y) {
    const idx = this.getIndex(x, y);
    if (idx < 0) return null;
    const id = this.plateIdField[idx];
    return this.plates[id];
  }

  /**
   * Get crust age at a cell (used to determine density and behavior).
   */
  getCrustAge(x, y) {
    const idx = this.getIndex(x, y);
    if (idx < 0) return 0;
    return this.plateAgeField[idx];
  }

  /**
   * Reset crust age at a location (for new crust created at ridges).
   */
  resetCrustAge(x, y) {
    const idx = this.getIndex(x, y);
    if (idx >= 0) this.plateAgeField[idx] = 0;
  }

  /**
   * Get a snapshot of plate data for state preservation.
   */
  getState() {
    return {
      plates: this.plates.map(p => ({ ...p })),
      plateIdField: this.plateIdField.slice(0),
      plateAgeField: this.plateAgeField.slice(0)
    };
  }

  /**
   * Restore plate data from a snapshot.
   */
  setState(state) {
    if (!state || !state.plates) return;
    this.plates = state.plates.map(p => ({ ...p }));
    if (state.plateIdField) this.plateIdField.set(state.plateIdField);
    if (state.plateAgeField) this.plateAgeField.set(state.plateAgeField);
  }
}