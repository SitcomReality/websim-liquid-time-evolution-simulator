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
        return ty * this.thermalWidth + tx;
    }

    getTemperature(x, y) {
        if (!this.world.inBounds(x, y)) return TEMPERATURE.AMBIENT;
        return this.temperature[this.getThermalIndex(x, y)];
    }

    setTemperature(x, y, temp) {
        if (!this.world.inBounds(x, y)) return;
        this.temperature[this.getThermalIndex(x, y)] = temp;
    }

    getPressure(x, y) {
        if (!this.world.inBounds(x, y)) return 1.0;
        return this.pressure[this.getThermalIndex(x, y)];
    }

    setPressure(x, y, p) {
        if (!this.world.inBounds(x, y)) return;
        this.pressure[this.getThermalIndex(x, y)] = p;
    }
}