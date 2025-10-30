export class ElevationField {
  constructor(width, height, cellSize = 16) {
    this.width = width;
    this.height = height;
    this.cellSize = cellSize;
    this.size = width * height;

    // Base elevation (bedrock level) and sediment depth (deposited material thickness)
    this.baseElevation = new Float32Array(this.size);   // meters or normalized units
    this.sedimentDepth = new Float32Array(this.size);   // meters or units

    // Cached slope and flow directions
    this.slopeMag = new Float32Array(this.size);        // gradient magnitude
    this.slopeDirX = new Float32Array(this.size);       // slope direction unit vector
    this.slopeDirY = new Float32Array(this.size);
    this.flowDirX = new Float32Array(this.size);        // steepest descent unit vector
    this.flowDirY = new Float32Array(this.size);

    this.reset();
  }

  reset() {
    this.baseElevation.fill(0);
    this.sedimentDepth.fill(0);
    this.slopeMag.fill(0);
    this.slopeDirX.fill(0);
    this.slopeDirY.fill(0);
    this.flowDirX.fill(0);
    this.flowDirY.fill(0);
  }

  getIndex(x, y) {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return -1;
    return y * this.width + x;
  }

  getElevation(x, y) {
    const idx = this.getIndex(x, y);
    if (idx < 0) return 0;
    return this.baseElevation[idx] + this.sedimentDepth[idx];
  }

  adjustElevation(x, y, delta) {
    const idx = this.getIndex(x, y);
    if (idx < 0 || delta === 0) return;
    // Prefer modifying sediment; base elevation changes are rarer (handled externally)
    this.sedimentDepth[idx] = Math.max(0, this.sedimentDepth[idx] + delta);
  }

  getSlope(x, y) {
    const idx = this.getIndex(x, y);
    if (idx < 0) return { mag: 0, dx: 0, dy: 0 };
    return { mag: this.slopeMag[idx], dx: this.slopeDirX[idx], dy: this.slopeDirY[idx] };
  }

  calculateFlowNetwork() {
    // Compute slope and flow directions using a simple 8-neighbor steepest descent
    const W = this.width, H = this.height;

    const elev = (cx, cy) => {
      if (cx < 0 || cy < 0 || cx >= W || cy >= H) return Infinity;
      return this.getElevation(cx, cy);
    };

    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const idx = this.getIndex(x, y);
        const e0 = elev(x, y);

        let bestDx = 0, bestDy = 0, bestDrop = 0;
        let gx = 0, gy = 0; // gradient estimate
        // Sample neighbors
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const en = elev(x + dx, y + dy);
            const drop = e0 - en; // positive if neighbor lower
            if (drop > bestDrop) {
              bestDrop = drop;
              bestDx = dx;
              bestDy = dy;
            }
            // Accumulate simple central-difference gradient
            gx += dx * (en - e0);
            gy += dy * (en - e0);
          }
        }

        // Slope magnitude and direction (normalize)
        const gMag = Math.sqrt(gx * gx + gy * gy);
        const sdx = gMag > 0 ? (gx / gMag) : 0;
        const sdy = gMag > 0 ? (gy / gMag) : 0;
        this.slopeMag[idx] = gMag;
        this.slopeDirX[idx] = sdx;
        this.slopeDirY[idx] = sdy;

        // Flow direction as unit vector toward steepest descent neighbor
        if (bestDrop > 0) {
          const fMag = Math.sqrt(bestDx * bestDx + bestDy * bestDy) || 1;
          this.flowDirX[idx] = bestDx / fMag;
          this.flowDirY[idx] = bestDy / fMag;
        } else {
          this.flowDirX[idx] = 0;
          this.flowDirY[idx] = 0;
        }
      }
    }
  }
}