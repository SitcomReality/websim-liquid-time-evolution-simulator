import { PARTICLE_COLORS } from '../utils/Constants.js';

export class Canvas {
    constructor(canvas, world) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d', { alpha: false });
        this.world = world;
        
        this.imageData = null;
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
    
    render() {
        const data = this.imageData.data;
        
        for (let i = 0; i < this.world.size; i++) {
            const particleType = this.world.particles[i];
            const color = PARTICLE_COLORS[particleType];
            const idx = i * 4;
            
            data[idx] = color[0];
            data[idx + 1] = color[1];
            data[idx + 2] = color[2];
            data[idx + 3] = color[3];
        }
        
        this.ctx.putImageData(this.imageData, 0, 0);
    }
}

