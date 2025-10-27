import { TierManager } from './TierManager.js';
import { Tier1Backend } from './backends/Tier1Backend.js';

export class Simulation {
    constructor(world) {
        this.world = world;
        this.timeScale = 1;
        this.fidelity = 1.0;
        this.running = true;
        this.simulationTime = 0;
        this.simulationSteps = 0;
        
        this.lastUpdate = performance.now();
        this.updateCount = 0;
        this.ups = 0;
        
        // Separate render rate from update rate
        this.renderInterval = 1; // Render every N updates
        this.updatesSinceRender = 0;
        
        // Tier management and backend routing
        this.tierManager = new TierManager({
            getBackendForTier: (_tier) => {
                // For now, all tiers route to Tier1Backend until others are implemented
                return new Tier1Backend(this.world);
            }
        });
        // Initialize active backend for current timeScale
        this.tierManager.transitionToTier(this.tierManager.getCurrentTier(this.timeScale));
        this.backend = this.tierManager.activeBackend;
    }
    
    setTimeScale(scale) {
        this.timeScale = scale;
    }

    setFidelity(fidelity) {
        this.fidelity = fidelity;
    }
    
    update(frameDeltaTime) {
        if (!this.running) return false; // Return false = don't render
        
        // Check for tier transition and refresh backend
        this.tierManager.updateForTimeScale(this.timeScale);
        this.backend = this.tierManager.activeBackend || this.backend;
        if (!this.backend) return true;
        
        // Calculate how many simulation steps to do based on time scale
        // At high time scales, do multiple updates per frame
        const stepsToRun = Math.max(1, Math.floor(this.timeScale / 10));
        const simulationDeltaTime = frameDeltaTime * this.timeScale / stepsToRun;
        
        for (let i = 0; i < stepsToRun; i++) {
            this.backend.update(simulationDeltaTime, this.fidelity);
            this.simulationTime += simulationDeltaTime;
            this.updateCount++;
            this.simulationSteps++;
        }
        
        // Calculate UPS
        const now = performance.now();
        if (now - this.lastUpdate >= 1000) {
            this.ups = this.updateCount;
            this.updateCount = 0;
            this.lastUpdate = now;
        }
        
        // Decide if we should render this frame
        this.updatesSinceRender++;
        
        // At high time scales, render less frequently
        this.renderInterval = Math.max(1, Math.floor(this.timeScale / 50));
        
        if (this.updatesSinceRender >= this.renderInterval) {
            this.updatesSinceRender = 0;
            return true; // Render this frame
        }
        
        return false; // Skip rendering
    }
    
    togglePause() {
        this.running = !this.running;
        return this.running;
    }
    
    getElapsedYears() {
        // Assume 1 second of simulation time at 1x speed = 1 day
        const days = (this.simulationTime / 1000);
        return (days / 365).toFixed(2);
    }
}