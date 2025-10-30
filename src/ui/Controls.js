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
        this.setupTierControls();
        this.setupTimeScaleEnhancements();
    }
    
    setupEventListeners() {
        // Mouse/touch drawing
        this.canvas.canvas.addEventListener('mousemove', (e) => this.startDrawing(e));
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
        
        // Enhanced time scale slider
        const timeScaleSlider = document.getElementById('timeScale');
        timeScaleSlider.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            // Original: const scale = Math.pow(2, value / 10);
            // New logic: 100 maps to 2^24 (approx 16.7 million x) to cover Tectonic Scale
            const exponent = value * 0.24; 
            const scale = Math.pow(2, exponent);
            this.simulation.setTimeScale(scale);
            document.getElementById('timeScaleValue').textContent = `${scale.toFixed(1)}x`;
            
            // Update tier markers indicator
            const canvas = document.getElementById('tierMarkersCanvas');
            if (canvas) {
                this.updateSliderIndicator(canvas);
            }
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
    
    setupTierControls() {
        // Tier display
        const tierDisplay = document.getElementById('tierDisplay');
        if (!tierDisplay) {
            const controlsDiv = document.getElementById('controls');
            const tierPanel = document.createElement('div');
            tierPanel.id = 'tierDisplay';
            tierPanel.className = 'tier-panel';
            tierPanel.innerHTML = `
                <div class="tier-info">
                    <div class="tier-header">Simulation Tier</div>
                    <div id="tierName" class="tier-name">Tier 1: Human Scale</div>
                    <div id="tierDesc" class="tier-desc">Particle-based physics</div>
                    <div id="tierStats" class="tier-stats"></div>
                </div>
                <div class="tier-controls">
                    <button id="tierOverride" class="tier-override-btn" title="Force specific tier">Override</button>
                    <select id="tierSelect" class="tier-select hidden">
                        <option value="auto">Auto (recommended)</option>
                        <option value="tier1">Tier 1: Human Scale</option>
                        <option value="tier2">Tier 2: Geological</option>
                        <option value="tier3">Tier 3: Tectonic</option>
                    </select>
                </div>
            `;
            controlsDiv.insertBefore(tierPanel, controlsDiv.firstChild);
        }

        // Tier override button
        const tierOverrideBtn = document.getElementById('tierOverride');
        const tierSelect = document.getElementById('tierSelect');
        
        tierOverrideBtn.addEventListener('click', () => {
            tierSelect.classList.toggle('hidden');
            tierOverrideBtn.classList.toggle('active');
        });

        tierSelect.addEventListener('change', (e) => {
            const value = e.target.value;
            if (value !== 'auto') {
                const scaleMap = { tier1: 10, tier2: 5000, tier3: 1000000 };
                const scale = scaleMap[value];
                document.getElementById('timeScale').value = Math.log2(scale) * 10;
                this.simulation.setTimeScale(scale);
            } else {
                tierSelect.classList.add('hidden');
                tierOverrideBtn.classList.remove('active');
            }
        });

        // Update tier info periodically
        setInterval(() => this.updateTierInfo(), 500);
    }

    setupTimeScaleEnhancements() {
        const timeScaleSlider = document.getElementById('timeScale');
        const container = timeScaleSlider.parentElement;

        // Add tier markers canvas
        const canvas = document.createElement('canvas');
        canvas.id = 'tierMarkersCanvas';
        canvas.className = 'tier-markers';
        canvas.width = 300;
        canvas.height = 30;
        container.insertBefore(canvas, timeScaleSlider);

        // Add systems info
        const systemsInfo = document.createElement('div');
        systemsInfo.id = 'systemsInfo';
        systemsInfo.className = 'systems-info';
        container.appendChild(systemsInfo);

        // Draw initial state (markers + indicator)
        this.redrawTierMarkers();

        // Update systems info periodically
        setInterval(() => this.updateSystemsInfo(), 500);
    }

    _drawStaticMarkers(ctx, width, height) {
        // Constants used for log scaling in updateSliderIndicator
        const LOG_MIN = Math.log2(1);
        const LOG_MAX = Math.log2(10000000); 

        // Clear and draw background
        ctx.fillStyle = 'rgba(0,0,0,0.1)';
        ctx.fillRect(0, 0, width, height);

        // Tier boundaries (using speeds based on SimulationTiers.js)
        const tiers = [
            { name: 'T1', scale: 100 }, 
            { name: 'T2', scale: 100000 }
        ];
        
        ctx.strokeStyle = '#666';
        ctx.lineWidth = 1;
        ctx.fillStyle = '#999';
        ctx.font = '10px Space Mono';
        ctx.textAlign = 'center';

        for (const tier of tiers) {
            const logScale = Math.log2(tier.scale);
            const normalized = (logScale - LOG_MIN) / (LOG_MAX - LOG_MIN);
            const x = Math.max(0, Math.min(width, normalized * width));

            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height - 8);
            ctx.stroke();
            ctx.fillText(tier.name, x, height - 2);
        }
        
        // Mark T3 start (1,000,000x)
        const t3StartLog = Math.log2(1000000);
        const t3StartNormalized = (t3StartLog - LOG_MIN) / (LOG_MAX - LOG_MIN);
        const x3 = Math.max(0, Math.min(width, t3StartNormalized * width));
        
        ctx.strokeStyle = '#0f62fe';
        ctx.fillStyle = '#0f62fe';
        ctx.beginPath();
        ctx.moveTo(x3, 0);
        ctx.lineTo(x3, height - 8);
        ctx.stroke();
        ctx.fillText('T3', x3, height - 2);
    }

    redrawTierMarkers() {
        const canvas = document.getElementById('tierMarkersCanvas');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        this._drawStaticMarkers(ctx, canvas.width, canvas.height);
        this.updateSliderIndicator(canvas);
    }

    drawTierMarkers(canvas) {
        // Deprecated: now handled by redrawTierMarkers / _drawStaticMarkers
    }

    updateSliderIndicator(canvas) {
        // Ensure the scale is consistent with the calculation used in the input handler
        const scale = this.simulation.timeScale;
        
        const ctx = canvas.getContext('2d');
        const width = canvas.width;
        const height = canvas.height;

        // --- RENDER STATIC BACKGROUND AND MARKERS FIRST ---
        // This ensures the previous indicator is cleared every time
        this._drawStaticMarkers(ctx, width, height);
        // --- END STATIC DRAWING ---

        // Normalize scale to 0..1 (log scale)
        const logMin = Math.log2(1);
        const logMax = Math.log2(10000000);
        const logScale = Math.log2(scale);
        const normalized = (logScale - logMin) / (logMax - logMin);
        const x = Math.max(0, Math.min(width, normalized * width));

        // Draw indicator
        ctx.fillStyle = '#0f62fe';
        ctx.beginPath();
        ctx.arc(x, height / 2, 3, 0, Math.PI * 2);
        ctx.fill();
    }

    updateTierInfo() {
        const tierName = document.getElementById('tierName');
        const tierDesc = document.getElementById('tierDesc');
        const tierStats = document.getElementById('tierStats');
        
        if (!tierName) return;

        const transitionStatus = this.simulation.getTransitionStatus?.();
        const currentTier = this.simulation.tierManager?.activeTier;
        const isTransitioning = transitionStatus?.state !== 'idle';

        if (!currentTier) return;

        // Update tier name
        tierName.textContent = currentTier.name;
        tierName.classList.toggle('transitioning', isTransitioning);

        // Update description
        const descriptions = {
            'HUMAN_SCALE': 'Particle-based physics at 1-100x speed',
            'GEOLOGICAL_SCALE': 'Field-based erosion & material flow',
            'TECTONIC_SCALE': 'Plate tectonics & global events'
        };
        tierDesc.textContent = descriptions[currentTier.key] || 'Unknown tier';

        // Update stats display
        let statsHtml = '';

        if (currentTier.key === 'HUMAN_SCALE') {
            statsHtml = `
                <div class="stat">Active Systems: Particles, Fluids, Thermal, Plants</div>
                <div class="stat">Resolution: 1px per particle</div>
            `;
        } else if (currentTier.key === 'GEOLOGICAL_SCALE') {
            statsHtml = `
                <div class="stat">Active Systems: Erosion, Climate, Landforms</div>
                <div class="stat">Resolution: 16px per cell</div>
            `;
        } else if (currentTier.key === 'TECTONIC_SCALE') {
            statsHtml = `
                <div class="stat">Active Systems: Plates, Events, Glaciation</div>
                <div class="stat">Resolution: 32px per cell</div>
            `;
        }

        if (isTransitioning) {
            statsHtml += `<div class="stat transitioning">⟳ Transitioning...</div>`;
        }

        tierStats.innerHTML = statsHtml;
    }

    updateSystemsInfo() {
        const systemsInfo = document.getElementById('systemsInfo');
        if (!systemsInfo) return;

        const scale = this.simulation.timeScale;
        const timeScaleValue = document.getElementById('timeScaleValue');

        // Calculate actual simulation speed (relative to real time)
        // At 1x: 1 second real time = 1 second sim time
        // At 100x: 1 second real time = 100 seconds sim time
        const actualSpeedYears = (scale / 365) * 0.016; // 16ms per frame

        let systemsHtml = `
            <div class="system-row">
                <span class="label">Speed:</span>
                <span class="value">${scale.toFixed(0)}x (~${actualSpeedYears.toExponential(1)} years/frame)</span>
            </div>
        `;

        // Show active systems based on tier
        const activeSystems = this.getActiveSystemsForScale(scale);
        systemsHtml += `
            <div class="system-row">
                <span class="label">Active:</span>
                <span class="value">${activeSystems.join(', ')}</span>
            </div>
        `;

        systemsInfo.innerHTML = systemsHtml;
    }

    getActiveSystemsForScale(scale) {
        const systems = [];

        if (scale <= 1000) {
            systems.push('Particles', 'Fluids', 'Thermal', 'Airflow', 'Biology');
        }
        if (scale >= 1000) {
            systems.push('Erosion', 'Climate', 'Landforms');
        }
        if (scale >= 1000000) {
            systems.push('Plates', 'Tectonics', 'Events');
        }

        return systems;
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