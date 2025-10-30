import { World } from '../core/World.js';
import { Simulation } from '../core/Simulation.js';
import { Canvas } from '../ui/Canvas.js';
import { Controls } from '../ui/Controls.js';
import { Graphs } from '../ui/Graphs.js';
import { PrimordialManager } from '../entities/PrimordialManager.js';

export default class App {
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
        this.looping = false;

        this.defaultConfig = {
            stonePercent: 60,
            sandPercent: 20,
            waterPercent: 15,
            soilPercent: 5,
            width: 600,
            height: 400
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

        ['width', 'height', 'stone', 'sand', 'water', 'soil'].forEach(id => {
            const slider = document.getElementById(`${id === 'width' ? 'worldWidth' : id === 'height' ? 'worldHeight' : id + 'Percent'}`);
            const value = document.getElementById(`${id}Value`);
            const isPercent = id !== 'width' && id !== 'height';

            slider.addEventListener('input', () => {
                value.textContent = isPercent ? 
                    slider.value + '%' : slider.value;
            });
        });

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
        
        // Initialize debug overlay
        this.canvas.setSimulation(this.simulation);

        this.primordials = new PrimordialManager(this.world);
        this.setupPrimordialControls();

        if (!this.controls) {
            this.controls = new Controls(this.world, this.simulation, this.canvas);
        } else {
            this.controls.world = this.world;
            this.controls.simulation = this.simulation;
            this.controls.canvas = this.canvas;
        }

        if (!this.graphs) {
            const graphCanvas = document.getElementById('populationGraph');
            this.graphs = new Graphs(graphCanvas);
        }

        document.getElementById('reset').onclick = () => {
            this.world.initialize(config);
            this.simulation.simulationTime = 0;
            this.primordials = new PrimordialManager(this.world);
            this.updatePrimordialList();
        };

        if (!this.looping) {
            this.looping = true;
            this.loop();
        }
    }

    setupPrimordialControls() {
        const addBtn = document.getElementById('addPrimordial');
        const removeBtn = document.getElementById('removePrimordial');
        const domainSelect = document.getElementById('primordialDomain');
        const colorInput = document.getElementById('primordialColor');
        const sizeSlider = document.getElementById('primordialSize');
        const listSelect = document.getElementById('primordialList');

        addBtn.addEventListener('click', () => {
            const domain = domainSelect.value;
            const colorHex = colorInput.value;
            const r = parseInt(colorHex.slice(1, 3), 16);
            const g = parseInt(colorHex.slice(3, 5), 16);
            const b = parseInt(colorHex.slice(5, 7), 16);
            const size = parseInt(sizeSlider.value);

            const id = this.primordials.add(domain, [r, g, b], size);
            this.updatePrimordialList();
        });

        removeBtn.addEventListener('click', () => {
            const selected = listSelect.value;
            if (selected) {
                this.primordials.remove(parseInt(selected));
                this.updatePrimordialList();
            }
        });

        this.updatePrimordialList();
    }

    updatePrimordialList() {
        const listSelect = document.getElementById('primordialList');
        listSelect.innerHTML = '';

        for (const entity of this.primordials.entities) {
            if (entity.alive) {
                const option = document.createElement('option');
                option.value = entity.id;
                option.textContent = `${entity.domain} (#${entity.id})`;
                listSelect.appendChild(option);
            }
        }
    }

    loop() {
        const now = performance.now();
        const deltaTime = 16;

        if (!this.simulation) {
            requestAnimationFrame(() => this.loop());
            return;
        }

        const shouldRender = this.simulation.update(deltaTime);

        if (this.primordials) {
            this.primordials.update();
        }

        if (shouldRender) {
            this.canvas.render();
            if (this.primordials) this.canvas.renderPrimordials(this.primordials);
        }

        this.graphs.update({ plants: this.world.countParticles(8), animals: 0 });
        this.graphs.render();

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