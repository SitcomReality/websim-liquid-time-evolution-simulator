/**
 * CollisionOptimizer
 * Uses spatial hashing (grid-based partitioning) for fast collision detection.
 * Dramatically reduces collision checks from O(n²) to O(n).
 * 
 * World is divided into grid cells; particles in the same or adjacent cells are checked.
 * Much faster than brute-force all-pairs checking, especially with many particles.
 */
export class CollisionOptimizer {
  constructor(world, config = {}) {
    this.world = world;
    
    // Grid configuration
    this.cellSize = config.cellSize || 16; // pixels per grid cell
    this.gridWidth = Math.ceil(world.width / this.cellSize);
    this.gridHeight = Math.ceil(world.height / this.cellSize);
    this.gridSize = this.gridWidth * this.gridHeight;
    
    // Hash grid: cell index -> array of particle indices
    this.grid = new Array(this.gridSize);
    for (let i = 0; i < this.gridSize; i++) {
      this.grid[i] = [];
    }
    
    // Diagnostics
    this.stats = {
      checksPerformed: 0,
      collisionsDetected: 0,
      checksSavedVsBruteForce: 0
    };
  }

  /**
   * Get grid cell index for world coordinates.
   */
  getCellIndex(x, y) {
    const cx = Math.floor(x / this.cellSize);
    const cy = Math.floor(y / this.cellSize);
    
    // Clamp to grid bounds
    const clampX = Math.max(0, Math.min(this.gridWidth - 1, cx));
    const clampY = Math.max(0, Math.min(this.gridHeight - 1, cy));
    
    return clampY * this.gridWidth + clampX;
  }

  /**
   * Rebuild spatial hash grid with current particle positions.
   * Should be called once per frame before collision checks.
   */
  rebuildGrid() {
    // Clear grid
    for (let i = 0; i < this.gridSize; i++) {
      this.grid[i].length = 0;
    }
    
    // Insert particles into grid cells
    for (let i = 0; i < this.world.size; i++) {
      const x = i % this.world.width;
      const y = Math.floor(i / this.world.width);
      const particle = this.world.getParticle(x, y);
      
      if (particle === 0) continue; // Skip empty cells
      
      const cellIdx = this.getCellIndex(x, y);
      this.grid[cellIdx].push(i);
    }
  }

  /**
   * Get all particles in a cell and its 8 neighbors (3x3 region).
   */
  getNearbyCells(cellIndex) {
    const nearby = [];
    
    const cx = cellIndex % this.gridWidth;
    const cy = Math.floor(cellIndex / this.gridWidth);
    
    // Check 3x3 neighborhood
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const nx = cx + dx;
        const ny = cy + dy;
        
        if (nx >= 0 && nx < this.gridWidth && ny >= 0 && ny < this.gridHeight) {
          const nIdx = ny * this.gridWidth + nx;
          nearby.push(...this.grid[nIdx]);
        }
      }
    }
    
    return nearby;
  }

  /**
   * Check collisions between particles in a region.
   * Returns array of collision pairs: { i, j, distance }
   */
  checkCollisions() {
    this.stats.checksPerformed = 0;
    this.stats.collisionsDetected = 0;
    
    const collisions = [];
    
    // We switch to O(N) direct neighbor checks to prevent the Set from exceeding 
    // maximum size limit in dense worlds (where spatial hashing is inefficient 
    // for collision radii of 1 pixel).
    
    for (let i = 0; i < this.world.size; i++) {
      const x1 = i % this.world.width;
      const y1 = Math.floor(i / this.world.width);
      const p1 = this.world.getParticle(x1, y1);
      
      if (p1 === 0) continue; // Skip empty
      
      // Check 8 immediate grid neighbors (dx, dy)
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          
          const x2 = x1 + dx;
          const y2 = y1 + dy;
          
          if (!this.world.inBounds(x2, y2)) continue;
          
          const j = this.world.getIndex(x2, y2);
          
          if (i >= j) continue; // Critical: only check pairs where i < j to prevent duplicates
          
          this.stats.checksPerformed++;
          
          const p2 = this.world.getParticle(x2, y2);
          
          if (p2 === 0) continue; // Skip empty
          
          // Collision detected (they are adjacent 1x1 particles)
          const dx_dist = x2 - x1;
          const dy_dist = y2 - y1;
          const distance = Math.sqrt(dx_dist * dx_dist + dy_dist * dy_dist);

          this.stats.collisionsDetected++;
          collisions.push({ i, j, distance });
        }
      }
    }
    
    // Estimate savings vs brute force
    const bruteForceComplexity = (this.world.size * (this.world.size - 1)) / 2;
    this.stats.checksSavedVsBruteForce = Math.max(0, bruteForceComplexity - this.stats.checksPerformed);
    
    return collisions;
  }

  /**
   * Get particles within a specific radius of a point (useful for effects, queries).
   * Uses spatial hash for speed.
   */
  getParticlesInRadius(cx, cy, radius) {
    const result = [];
    const radiusSq = radius * radius;
    
    // Get cells covering the radius
    const minCellX = Math.floor((cx - radius) / this.cellSize);
    const maxCellX = Math.floor((cx + radius) / this.cellSize);
    const minCellY = Math.floor((cy - radius) / this.cellSize);
    const maxCellY = Math.floor((cy + radius) / this.cellSize);
    
    const cellsToCheck = new Set();
    
    for (let cy = minCellY; cy <= maxCellY; cy++) {
      for (let cx = minCellX; cx <= maxCellX; cx++) {
        if (cx >= 0 && cx < this.gridWidth && cy >= 0 && cy < this.gridHeight) {
          const cellIdx = cy * this.gridWidth + cx;
          for (const idx of this.grid[cellIdx]) {
            cellsToCheck.add(idx);
          }
        }
      }
    }
    
    // Check distance for each particle
    for (const idx of cellsToCheck) {
      const x = idx % this.world.width;
      const y = Math.floor(idx / this.world.width);
      const dx = x - cx;
      const dy = y - cy;
      
      if (dx * dx + dy * dy <= radiusSq) {
        result.push(idx);
      }
    }
    
    return result;
  }

  /**
   * Visualize grid coverage (for debugging).
   * Returns array of cell centers and fill status.
   */
  getGridDebugInfo() {
    const info = [];
    
    for (let y = 0; y < this.gridHeight; y++) {
      for (let x = 0; x < this.gridWidth; x++) {
        const cellIdx = y * this.gridWidth + x;
        const count = this.grid[cellIdx].length;
        
        if (count > 0) {
          info.push({
            x: x * this.cellSize + this.cellSize / 2,
            y: y * this.cellSize + this.cellSize / 2,
            count,
            density: Math.min(1.0, count / 10) // Normalize to 0..1
          });
        }
      }
    }
    
    return info;
  }

  /**
   * Get diagnostic statistics.
   */
  getStats() {
    const totalParticles = Array.from(this.grid)
      .reduce((sum, cell) => sum + cell.length, 0);
    
    return {
      ...this.stats,
      totalParticles,
      gridDimensions: `${this.gridWidth}x${this.gridHeight}`,
      cellSize: this.cellSize,
      occupiedCells: this.grid.filter(cell => cell.length > 0).length,
      avgParticlesPerCell: totalParticles > 0 ? 
        (totalParticles / this.grid.filter(cell => cell.length > 0).length).toFixed(1) : 0
    };
  }

  /**
   * Reset statistics counters.
   */
  resetStats() {
    this.stats = {
      checksPerformed: 0,
      collisionsDetected: 0,
      checksSavedVsBruteForce: 0
    };
  }
}