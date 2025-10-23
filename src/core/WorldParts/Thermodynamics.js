import { TEMPERATURE } from '../../utils/Constants.js';

export class Thermodynamics {
    constructor(world) {
        this.world = world;
        this.thermalResolution = 4;
        this.thermalWidth = Math.ceil(world.width / this.thermalResolution);
        this.thermalHeight = Math.ceil(world.height / this.thermalResolution);
        this.thermalSize = this.thermalWidth * this.thermalHeight;
        this.temperature = new Float32Array(this.thermalSize);
        this.pressure = new Float32Array(this.thermalSize);
        this.tempBuffer = new Float32Array(this.thermalSize);
        this.reset();
    }

    reset() {
        this.temperature.fill(TEMPERATURE.AMBIENT);
        this.pressure.fill(1.0);
        this.tempBuffer.fill(0);
    }

    getThermalIndex(x, y) {
        const tx = Math.floor(x / this.thermalResolution);
        const ty = Math.floor(y / this.thermalResolution);
        // Clamp to valid thermal grid to avoid out-of-range indices from fractional/world-edge coords
        const cx = Math.max(0, Math.min(this.thermalWidth - 1, tx));
        const cy = Math.max(0, Math.min(this.thermalHeight - 1, ty));
        return cy * this.thermalWidth + cx;
    }

    getTemperature(x, y) {
        if (!this.world.inBounds(x, y)) return TEMPERATURE.AMBIENT;
        const idx = this.getThermalIndex(x, y);
        return this.temperature[idx] !== undefined ? this.temperature[idx] : TEMPERATURE.AMBIENT;
    }

    setTemperature(x, y, temp) {
        if (!this.world.inBounds(x, y)) return;
        const idx = this.getThermalIndex(x, y);
        if (idx >= 0 && idx < this.temperature.length) this.temperature[idx] = temp;
    }

    getPressure(x, y) {
        if (!this.world.inBounds(x, y)) return 1.0;
        const idx = this.getThermalIndex(x, y);
        return this.pressure[idx] !== undefined ? this.pressure[idx] : 1.0;
    }

    setPressure(x, y, p) {
        if (!this.world.inBounds(x, y)) return;
        const idx = this.getThermalIndex(x, y);
        if (idx >= 0 && idx < this.pressure.length) this.pressure[idx] = p;
    }
}