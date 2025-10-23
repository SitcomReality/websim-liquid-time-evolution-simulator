export class AirflowManager {
    constructor(world) {
        this.world = world;
        
        // Wind field at thermal resolution
        this.windResolution = Math.max(4, world.thermo.thermalResolution * 2); // Coarser than thermal
        this.windWidth = Math.ceil(world.width / this.windResolution);
        this.windHeight = Math.ceil(world.height / this.windResolution);
        this.windSize = this.windWidth * this.windHeight;
        
        this.windVx = new Float32Array(this.windSize);
        this.windVy = new Float32Array(this.windSize);
        this.windBuffer = new Float32Array(this.windSize);
        
        this.reset();
    }

    reset() {
        this.windVx.fill(0);
        this.windVy.fill(0);
        this.windBuffer.fill(0);
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
}