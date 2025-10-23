import { PARTICLE_TYPES } from '../utils/Constants.js';
import { classifyEnvironment } from '../biology/PlantEcology.js';

export class Controls {
    constructor(world, simulation, canvas) {
        this.world = world;
        this.simulation = simulation;
        this.canvas = canvas;
        
        this.brushType = PARTICLE_TYPES.SAND;
        this.brushSize = 5;
        this.isDrawing = false;
        
        this.setupEventListeners();
    }
    
    setupEventListeners() {
        // Mouse/touch drawing
        this.canvas.canvas.addEventListener('mousedown', (e) => this.startDrawing(e));
        this.canvas.canvas.addEventListener('mousemove', (e) => this.draw(e));
        this.canvas.canvas.addEventListener('mouseup', () => this.stopDrawing());
        this.canvas.canvas.addEventListener('mouseleave', () => this.stopDrawing());
        
        // Touch support
        this.canvas.canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.startDrawing(e.touches[0]);
        });
        this.canvas.canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            this.draw(e.touches[0]);
        });
        this.canvas.canvas.addEventListener('touchend', () => this.stopDrawing());
        
        // Time scale
        const timeScaleSlider = document.getElementById('timeScale');
        const timeScaleValue = document.getElementById('timeScaleValue');
        timeScaleSlider.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            const scale = Math.pow(2, value / 10);
            this.simulation.setTimeScale(scale);
            timeScaleValue.textContent = `${scale.toFixed(1)}x`;
        });
        
        // Fidelity
        const fidelitySlider = document.getElementById('fidelity');
        const fidelityValue = document.getElementById('fidelityValue');
        fidelitySlider.addEventListener('input', (e) => {
            const value = parseInt(e.target.value);
            this.simulation.setFidelity(value / 100);
            fidelityValue.textContent = `${value}%`;
        });

        // Brush type
        document.getElementById('brushType').addEventListener('change', (e) => {
            const typeMap = {
                'sand': PARTICLE_TYPES.SAND,
                'water': PARTICLE_TYPES.WATER,
                'granite': PARTICLE_TYPES.GRANITE,
                'basalt': PARTICLE_TYPES.BASALT,
                'soil': PARTICLE_TYPES.SOIL,
                'lava': PARTICLE_TYPES.LAVA,
                'ice': PARTICLE_TYPES.ICE,
                'steam': PARTICLE_TYPES.STEAM,
                'plant': PARTICLE_TYPES.PLANT,
                'erase': PARTICLE_TYPES.EMPTY
            };
            this.brushType = typeMap[e.target.value];
        });
        
        // Brush size
        document.getElementById('brushSize').addEventListener('input', (e) => {
            this.brushSize = parseInt(e.target.value);
        });
        
        // Play/Pause
        document.getElementById('playPause').addEventListener('click', () => {
            const running = this.simulation.togglePause();
            document.getElementById('playPause').textContent = running ? '⏸️ Pause' : '▶️ Play';
        });
        
        // Temperature overlay
        document.getElementById('tempOverlay').addEventListener('click', () => {
            this.canvas.toggleTemperatureOverlay();
            document.getElementById('tempOverlay').classList.toggle('active');
            document.getElementById('pressOverlay').classList.remove('active');
            document.getElementById('windOverlay').classList.remove('active');
        });
        
        // Pressure overlay
        document.getElementById('pressOverlay').addEventListener('click', () => {
            this.canvas.togglePressureOverlay();
            document.getElementById('pressOverlay').classList.toggle('active');
            document.getElementById('tempOverlay').classList.remove('active');
            document.getElementById('windOverlay').classList.remove('active');
        });

        // Wind overlay
        document.getElementById('windOverlay').addEventListener('click', () => {
            this.canvas.toggleWindOverlay();
            document.getElementById('windOverlay').classList.toggle('active');
            document.getElementById('tempOverlay').classList.remove('active');
            document.getElementById('pressOverlay').classList.remove('active');
        });
    }
    
    startDrawing(e) {
        this.isDrawing = true;
        this.draw(e);
    }
    
    stopDrawing() {
        this.isDrawing = false;
    }
    
    draw(e) {
        if (!this.isDrawing) return;
        
        const rect = this.canvas.canvas.getBoundingClientRect();
        const scaleX = this.world.width / rect.width;
        const scaleY = this.world.height / rect.height;
        
        const x = Math.floor((e.clientX - rect.left) * scaleX);
        const y = Math.floor((e.clientY - rect.top) * scaleY);
        
        // Draw circle of particles
        for (let dy = -this.brushSize; dy <= this.brushSize; dy++) {
            for (let dx = -this.brushSize; dx <= this.brushSize; dx++) {
                if (dx * dx + dy * dy <= this.brushSize * this.brushSize) {
                    const px = x + dx;
                    const py = y + dy;

                    if (this.brushType === PARTICLE_TYPES.PLANT) {
                        if (this.world.getParticle(px, py) !== PARTICLE_TYPES.BEDROCK) {
                            const env = classifyEnvironment(this.world, px, py);
                            this.world.setParticle(px, py, this.brushType, [0, 0, 0, env.colorCode]);
                        }
                    } else if (this.brushType !== PARTICLE_TYPES.EMPTY) {
                        this.world.setParticle(px, py, this.brushType);
                        // Set temperature for certain brush types
                        if (this.brushType === PARTICLE_TYPES.ICE) {
                            this.world.setTemperature(px, py, -10);
                        } else if (this.brushType === PARTICLE_TYPES.LAVA) {
                            this.world.setTemperature(px, py, 1300);
                        } else if (this.brushType === PARTICLE_TYPES.STEAM) {
                            this.world.setTemperature(px, py, 110);
                        }
                    } else {
                        // Erase
                        this.world.setParticle(px, py, this.brushType);
                    }
                }
            }
        }
    }
}