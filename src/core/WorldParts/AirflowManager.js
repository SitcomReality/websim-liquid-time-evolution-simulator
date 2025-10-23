export class AirflowManager {
    constructor(world) {
        this.world = world;
        
        // Wind field at thermal resolution
        this.windResolution = Math.max(4, world.thermo.thermalResolution * 2);
        this.windWidth = Math.ceil(world.width / this.windResolution);
        this.windHeight = Math.ceil(world.height / this.windResolution);
        this.windSize = this.windWidth * this.windHeight;
        
        this.windVx = new Float32Array(this.windSize);
        this.windVy = new Float32Array(this.windSize);
        this.windBuffer = new Float32Array(this.windSize);
        
        // Track which cells are "open air" vs underground/filled
        this.isAirCell = new Uint8Array(this.windSize);
        this.airCheckCounter = 0;
        this.airCheckInterval = 20; // Check more frequently
        
        this.reset();
    }

    reset() {
        this.windVx.fill(0);
        this.windVy.fill(0);
        this.windBuffer.fill(0);
        this.isAirCell.fill(0); // Start with no air cells
        this.initialAirCellCheck(); // Run a full check at the start
        this.airCheckCounter = 0;
    }

    initialAirCellCheck() {
        // A full, non-sampled check for the initial state.
        for (let idx = 0; idx < this.windSize; idx++) {
            const wx = idx % this.windWidth;
            const wy = Math.floor(idx / this.windWidth);

            const cx = Math.floor(wx * this.windResolution + this.windResolution / 2);
            const cy = Math.floor(wy * this.windResolution + this.windResolution / 2);

            if (!this.world.inBounds(cx, cy)) {
                this.isAirCell[idx] = 0;
                continue;
            }

            // Sample a 3x3 grid within this wind cell
            let airCount = 0;
            let totalCount = 0;
            const sampleSize = Math.max(2, Math.floor(this.windResolution / 2));
            
            for (let dy = -sampleSize; dy <= sampleSize; dy += sampleSize) {
                for (let dx = -sampleSize; dx <= sampleSize; dx += sampleSize) {
                    const px = cx + dx;
                    const py = cy + dy;
                    
                    if (this.world.inBounds(px, py)) {
                        totalCount++;
                        const particle = this.world.getParticle(px, py);
                        // Count as "air" if particle is empty, steam, or cloud.
                        if (particle === 0 || particle === 7 || particle === 13) {
                            airCount++;
                        }
                    }
                }
            }
            
            // Cell is "air" if at least 50% is open
            this.isAirCell[idx] = (airCount / Math.max(1, totalCount)) >= 0.5 ? 1 : 0;
        }
    }

    getWindIndex(x, y) {
        const wx = Math.floor(x / this.windResolution);
        const wy = Math.floor(y / this.windResolution);
        return Math.max(0, Math.min(this.windSize - 1, wy * this.windWidth + wx));
    }

    getWind(x, y) {
        const idx = this.getWindIndex(x, y);
        return {
            vx: this.windVx[idx],
            vy: this.windVy[idx],
            magnitude: Math.sqrt(this.windVx[idx] * this.windVx[idx] + this.windVy[idx] * this.windVy[idx])
        };
    }

    setWind(x, y, vx, vy) {
        const idx = this.getWindIndex(x, y);
        this.windVx[idx] = vx;
        this.windVy[idx] = vy;
    }

    updateAirCells() {
        // Periodically check which cells are open air vs underground
        const sampleCount = Math.ceil(this.windSize / 10); // Check more cells per update
        
        for (let i = 0; i < sampleCount; i++) {
            const idx = Math.floor(Math.random() * this.windSize);
            const wx = idx % this.windWidth;
            const wy = Math.floor(idx / this.windWidth);
            
            // Check a 3x3 area in world space centered on this wind cell
            const cx = wx * this.windResolution + this.windResolution * 0.5;
            const cy = wy * this.windResolution + this.windResolution * 0.5;
            
            let emptyCount = 0;
            let totalCount = 0;
            const checkRadius = this.windResolution * 1.5;
            
            for (let dy = -checkRadius; dy <= checkRadius; dy += this.windResolution) {
                for (let dx = -checkRadius; dx <= checkRadius; dx += this.windResolution) {
                    const px = Math.floor(cx + dx);
                    const py = Math.floor(cy + dy);
                    
                    if (this.world.inBounds(px, py)) {
                        totalCount++;
                        const particle = this.world.getParticle(px, py);
                        // Count as "empty air" if particle is empty, steam, or cloud
                        if (particle === 0 || particle === 7 || particle === 13) {
                            emptyCount++;
                        }
                    }
                }
            }
            
            // Cell is "air" if at least 50% of sampled area is empty/air-like
            const airThreshold = 0.5; // Reduced from 0.6 to be more inclusive
            this.isAirCell[idx] = (emptyCount / Math.max(1, totalCount)) > airThreshold ? 1 : 0;
        }
    }

    isOpenAir(idx) {
        return this.isAirCell[idx] === 1;
    }
}