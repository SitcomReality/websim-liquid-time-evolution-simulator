import { TierManager } from './TierManager.js';
import { Tier1Backend } from './backends/Tier1Backend.js';
import { TransitionCoordinator } from './state/TransitionCoordinator.js';

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
        this.renderInterval = 1;
        this.updatesSinceRender = 0;
        
        // Tier management and backend routing
        this.tierManager = new TierManager({
            getBackendForTier: (_tier) => {
                return new Tier1Backend(this.world);
            }
        });
        this.tierManager.transitionToTier(this.tierManager.getCurrentTier(this.timeScale));
        this.backend = this.tierManager.activeBackend;

        // Transition coordinator for smooth tier changes
        this.transitionCoordinator = new TransitionCoordinator(this, this.tierManager, {
            enableSmoothTransitions: true,
            validateStateOnTransition: true,
            preserveVisualContinuity: true,
            enableLogging: false // Set to true for debugging
        });
    }
    
    setTimeScale(scale) {
        this.timeScale = scale;
        // Coordinator will detect tier change in update() and manage transition
    }

    setFidelity(fidelity) {
        this.fidelity = fidelity;
    }
    
    update(frameDeltaTime) {
        // Coordinate tier transitions (handles pause/convert/resume)
        this.transitionCoordinator.update(this.timeScale);

        if (!this.running) return false;
        
        // Check for tier transition and refresh backend
        this.tierManager.updateForTimeScale(this.timeScale);
        this.backend = this.tierManager.activeBackend || this.backend;
        if (!this.backend) return true;
        
        // Calculate how many simulation steps to do based on time scale
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
        this.renderInterval = Math.max(1, Math.floor(this.timeScale / 50));
        
        if (this.updatesSinceRender >= this.renderInterval) {
            this.updatesSinceRender = 0;
            return true;
        }
        
        return false;
    }
    
    togglePause() {
        this.running = !this.running;
        return this.running;
    }
    
    getElapsedYears() {
        const days = (this.simulationTime / 1000);
        return (days / 365).toFixed(2);
    }

    /**
     * Get transition diagnostics (for UI/debugging).
     */
    getTransitionStatus() {
        return this.transitionCoordinator.getDiagnostics();
    }

    /**
     * Get conversion history for optimization insights.
     */
    getConversionHistory() {
        return this.transitionCoordinator.getConversionHistory();
    }
}