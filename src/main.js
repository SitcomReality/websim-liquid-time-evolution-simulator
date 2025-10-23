import { World } from './core/World.js';
import { Simulation } from './core/Simulation.js';
import { Canvas } from './ui/Canvas.js';
import { Controls } from './ui/Controls.js';
import { Graphs } from './ui/Graphs.js';
import { PrimordialManager } from './entities/PrimordialManager.js';

class App {
    constructor() {
        this.world = null;
        this.simulation = null;
        this.canvas = null;
        this.controls = null;
        this.graphs = null;
        this.primordials = null;
        
        this.fps = 0;
        this.frameCount = 0;
        this.lastFpsUpdate = performance.now();
        this.looping = false; // Track if the main loop is running

        this.defaultConfig = {
            stonePercent: 60,
            sandPercent: 20,
            waterPercent: 15,
            soilPercent: 5,
            width: 400,
            height: 300
        };
        
        this.setupSplashScreen();
        this.setupNewGameModal();
    }
    
    setupSplashScreen() {
        const splashScreen = document.getElementById('splashScreen');
        const appContainer = document.getElementById('app');
        const startDefaultGameBtn = document.getElementById('startDefaultGame');
        const openNewGameModalBtn = document.getElementById('openNewGameModal');
        const newGameModal = document.getElementById('newGameModal');

        startDefaultGameBtn.addEventListener('click', () => {
            splashScreen.classList.add('hidden');
            appContainer.classList.remove('hidden');
            this.createWorld(this.defaultConfig.width, this.defaultConfig.height, this.defaultConfig);
        });

        openNewGameModalBtn.addEventListener('click', () => {
            // Show modal over splash screen
            newGameModal.classList.remove('hidden');
        });
    }
    
    setupNewGameModal() {
        const modal = document.getElementById('newGameModal');
        const controlsNewGameBtn = document.getElementById('newGame');
        const cancelBtn = document.getElementById('cancelNewGame');
        const confirmBtn = document.getElementById('confirmNewGame');
        const splashScreen = document.getElementById('splashScreen');
        const appContainer = document.getElementById('app');
        
        // Update slider values
        ['width', 'height', 'stone', 'sand', 'water', 'soil'].forEach(id => {
            const slider = document.getElementById(`${id === 'width' ? 'worldWidth' : id === 'height' ? 'worldHeight' : id + 'Percent'}`);
            const value = document.getElementById(`${id}Value`);
            const isPercent = id !== 'width' && id !== 'height';

            slider.addEventListener('input', () => {
                value.textContent = isPercent ? 
                    slider.value + '%' : slider.value;
            });
        });
        
        // Handle 'New Game' button from controls (for mid-game restart)
        if (controlsNewGameBtn) {
             controlsNewGameBtn.addEventListener('click', () => {
                modal.classList.remove('hidden');
            });
        }
        
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
            
            // If the splash screen is visible, hide it and reveal the main app
            if (!splashScreen.classList.contains('hidden')) {
                splashScreen.classList.add('hidden');
                appContainer.classList.remove('hidden');
            }

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
        
        if (!this.controls) {
            this.controls = new Controls(this.world, this.simulation, this.canvas);
        } else {
            // Update controls references if they already exist
            this.controls.world = this.world;
            this.controls.simulation = this.simulation;
            this.controls.canvas = this.canvas;
        }
        
        if (!this.graphs) {
            const graphCanvas = document.getElementById('populationGraph');
            this.graphs = new Graphs(graphCanvas);
        }
        
        // Reset button
        document.getElementById('reset').onclick = () => {
            this.world.initialize(config);
            this.simulation.simulationTime = 0;
        };
        
        if (!this.looping) {
            this.looping = true;
            this.loop();
        }
    }
    
    loop() {
        const now = performance.now();
        const deltaTime = 16; // Fixed timestep
        
        if (!this.simulation) {
            requestAnimationFrame(() => this.loop());
            return;
        }

        // Update simulation (may skip rendering)
        const shouldRender = this.simulation.update(deltaTime);
        
        // Only render if simulation says we should
        if (shouldRender) {
            this.canvas.render();
            if (this.primordials) this.canvas.renderPrimordials(this.primordials);
        }
        
        // Always update graphs and stats
        this.graphs.update({ plants: this.world.countParticles(8), animals: 0 });
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