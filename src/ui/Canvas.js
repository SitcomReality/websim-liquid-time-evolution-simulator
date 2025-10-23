import { PARTICLE_COLORS, PARTICLE_TYPES } from '../utils/Constants.js';
import { getPlantColor } from '../biology/PlantEcology.js';

export class Canvas {
    constructor(canvas, world) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d', { alpha: false });
        this.world = world;
        
        this.imageData = null;
        this.showTemperature = false;
        this.showPressure = false;
        
        this.resize();
    }
    
    resize() {
        this.canvas.width = this.world.width;
        this.canvas.height = this.world.height;
        this.imageData = this.ctx.createImageData(this.world.width, this.world.height);
        
        // Scale canvas to fit screen
        const scaleX = window.innerWidth / this.world.width;
        const scaleY = (window.innerHeight - 200) / this.world.height;
        const scale = Math.min(scaleX, scaleY);
        this.canvas.style.width = `${this.world.width * scale}px`;
        this.canvas.style.height = `${this.world.height * scale}px`;
    }
    
    toggleTemperatureOverlay() {
        this.showTemperature = !this.showTemperature;
        if (this.showTemperature) this.showPressure = false;
    }
    
    togglePressureOverlay() {
        this.showPressure = !this.showPressure;
        if (this.showPressure) this.showTemperature = false;
    }
    
    render() {
        const data = this.imageData.data;
        
        for (let i = 0; i < this.world.size; i++) {
            const particleType = this.world.particles[i];
            const idx = i * 4;
            
            if (this.showTemperature) {
                // Temperature overlay
                const x = i % this.world.width;
                const y = Math.floor(i / this.world.width);
                const temp = this.world.getTemperature(x, y);
                
                // Color code: blue (cold) -> white (warm) -> red (hot)
                let r, g, b;
                if (temp < 0) {
                    // Ice cold: deep blue
                    r = 0;
                    g = Math.max(0, 100 + temp * 2);
                    b = 255;
                } else if (temp < 100) {
                    // Cool to warm: blue to white
                    const t = temp / 100;
                    r = Math.floor(t * 255);
                    g = Math.floor(100 + t * 155);
                    b = Math.floor(255 - t * 100);
                } else if (temp < 1000) {
                    // Hot: white to red
                    const t = (temp - 100) / 900;
                    r = 255;
                    g = Math.floor(255 - t * 255);
                    b = Math.floor(155 - t * 155);
                } else {
                    // Extreme: bright red
                    r = 255;
                    g = Math.floor(Math.max(0, 100 - (temp - 1000) / 5));
                    b = 0;
                }
                
                data[idx] = r;
                data[idx + 1] = g;
                data[idx + 2] = b;
                data[idx + 3] = 255;
            } else if (this.showPressure) {
                // Pressure overlay
                const x = i % this.world.width;
                const y = Math.floor(i / this.world.width);
                const pressure = this.world.getPressure(x, y);
                
                // Color code: low pressure (blue) -> normal (green) -> high (red)
                let r, g, b;
                if (pressure < 1.0) {
                    // Low pressure: blue
                    const t = pressure;
                    r = 0;
                    g = Math.floor(t * 255);
                    b = 255;
                } else {
                    // High pressure: green to red
                    const t = Math.min(1, (pressure - 1.0) / 2.0);
                    r = Math.floor(t * 255);
                    g = Math.floor(255 - t * 255);
                    b = 0;
                }
                
                data[idx] = r;
                data[idx + 1] = g;
                data[idx + 2] = b;
                data[idx + 3] = 255;
            } else {
                // Normal particle rendering
                const color = (particleType === PARTICLE_TYPES.PLANT)
                    ? getPlantColor(this.world.particleData[i * 4 + 3] || 0)
                    : PARTICLE_COLORS[particleType];
                data[idx] = color[0];
                data[idx + 1] = color[1];
                data[idx + 2] = color[2];
                data[idx + 3] = color[3];
            }
        }
        
        this.ctx.putImageData(this.imageData, 0, 0);
    }
    
    renderPrimordials(manager) {
        // Draw entity pixels on top
        this.ctx.save();
        for (const e of manager.entities) {
            if (!e.alive) continue;
            this.ctx.fillStyle = `rgb(${e.color[0]},${e.color[1]},${e.color[2]})`;
            const cx = Math.floor(e.x), cy = Math.floor(e.y);
            for (const off of e.pixelOffsets) {
                const x = cx + off.x, y = cy + off.y;
                if (this.world.inBounds(x, y)) this.ctx.fillRect(x, y, 1, 1);
            }
        }
        this.ctx.restore();
    }
}