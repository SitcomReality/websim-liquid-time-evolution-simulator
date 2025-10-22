import { World } from './core/World.js';
import { Simulation } from './core/Simulation.js';
import { Canvas } from './ui/Canvas.js';
import { Controls } from './ui/Controls.js';
import { Graphs } from './ui/Graphs.js';

class App {
    constructor() {
        this.world = null;
        this.simulation = null;
        this.canvas = null;
        this.controls = null;
        this.graphs = null;
        
        this.fps = 0;
        this.frameCount = 0;
        this.lastFpsUpdate = performance.now();
        
        this.setupNewGameModal();
        this.createWorld(400, 300, {
            stonePercent: 60,
            sandPercent: 20,
            waterPercent: 15,
            soilPercent: 5
        });
    }
    
    setupNewGameModal() {
        const modal = document.getElementById('newGameModal');
        const newGameBtn = document.getElementById('newGame');
        const cancelBtn = document.getElementById('cancelNewGame');
        const confirmBtn = document.getElementById('confirmNewGame');
        
        // Update slider values
        ['width', 'height', 'stone', 'sand', 'water', 'soil'].forEach(id => {
            const slider = document.getElementById(`${id === 'width' ? 'worldWidth' : id === 'height' ? 'worldHeight' : id + 'Percent'}`);
            const value = document.getElementById(`${id}Value`);
            slider.addEventListener('input', () => {
                value.textContent = id.includes('Percent') || id === 'stone' || id === 'sand' || id === 'water' || id === 'soil' ? 
                    slider.value + '%' : slider.value;
            });
        });
        
        newGameBtn.addEventListener('click', () => {
            modal.classList.remove('hidden');
        });
        
        cancelBtn.addEventListener('click', () => {
            modal.classList.add('hidden');
        });
        
        confirmBtn.addEventListener('click', () => {
            const width = parseInt(document.getElementById('worldWidth').value);
            const height = parseInt(document.getElementById('worldHeight').value);
            const config = {
                stonePercent: parseInt(document.getElementById('stonePercent').value),
                sandPercent: parseInt(document.getElementById('sandPercent').value),
                waterPercent: parseInt(document.getElementById('waterPercent').value),
                soilPercent: parseInt(document.getElementById('soilPercent').value)
            };
            
            this.createWorld(width, height, config);
            modal.classList.add('hidden');
        });
    }
    
    createWorld(width, height, config) {
        this.world = new World(width, height);
        this.world.initialize(config);
        
        this.simulation = new Simulation(this.world);
        
        const canvasElement = document.getElementById('worldCanvas');
        this.canvas = new Canvas(canvasElement, this.world);
        
        this.controls = new Controls(this.world, this.simulation, this.canvas);
        
        const graphCanvas = document.getElementById('populationGraph');
        this.graphs = new Graphs(graphCanvas);
        
        // Reset button
        document.getElementById('reset').onclick = () => {
            this.world.initialize(config);
            this.simulation.simulationTime = 0;
        };
        
        this.loop();
    }
    
    loop() {
        const now = performance.now();
        const deltaTime = 16; // Fixed timestep
        
        // Update simulation
        this.simulation.update(deltaTime);
        
        // Render
        this.canvas.render();
        
        // Update graphs
        this.graphs.update({ plants: 0, animals: 0 }); // TODO: count actual populations
        this.graphs.render();
        
        // Update stats
        this.frameCount++;
        if (now - this.lastFpsUpdate >= 1000) {
            this.fps = this.frameCount;
            this.frameCount = 0;
            this.lastFpsUpdate = now;
            
            document.getElementById('fps').textContent = this.fps;
            document.getElementById('ups').textContent = this.simulation.ups;
            document.getElementById('elapsedTime').textContent = this.simulation.getElapsedYears();
        }
        
        requestAnimationFrame(() => this.loop());
    }
}

// Start the app
new App();

