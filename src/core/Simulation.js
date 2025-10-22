import { ParticleUpdater } from '../physics/ParticleUpdater.js';

export class Simulation {
    constructor(world) {
        this.world = world;
        this.particleUpdater = new ParticleUpdater(world);
        this.timeScale = 1;
        this.fidelity = 1.0; // Full fidelity by default
        this.running = true;
        this.simulationTime = 0;
        
        this.mediumProcessCounter = 0;
        this.slowProcessCounter = 0;
        
        this.lastUpdate = performance.now();
        this.updateCount = 0;
        this.ups = 0;
    }
    
    setTimeScale(scale) {
        this.timeScale = scale;
    }

    setFidelity(fidelity) {
        this.fidelity = fidelity;
    }
    
    update(frameDeltaTime) { // frameDeltaTime is time since last frame
        if (!this.running) return;
        
        const simulationDeltaTime = frameDeltaTime * this.timeScale;
        
        // Fast processes (physics) - always run
        this.particleUpdater.updateFastProcesses(this.fidelity, simulationDeltaTime);
        
        // Accumulate time for slower processes
        this.mediumProcessCounter += simulationDeltaTime;
        this.slowProcessCounter += simulationDeltaTime;
        
        // Medium processes (biology)
        const mediumUpdateInterval = 50; // Run every 50ms of simulation time
        if (this.mediumProcessCounter >= mediumUpdateInterval) {
            this.particleUpdater.updateMediumProcesses(this.fidelity, this.mediumProcessCounter);
            this.mediumProcessCounter = 0;
        }

        // Slow processes (geology, etc) - not yet implemented
        const slowUpdateInterval = 500; // Run every 500ms of simulation time
        if (this.slowProcessCounter >= slowUpdateInterval) {
            // this.particleUpdater.updateSlowProcesses(this.fidelity, this.slowProcessCounter);
            this.slowProcessCounter = 0;
        }
        
        this.simulationTime += simulationDeltaTime;
        this.updateCount++;
        
        // Calculate UPS
        const now = performance.now();
        if (now - this.lastUpdate >= 1000) {
            this.ups = this.updateCount;
            this.updateCount = 0;
            this.lastUpdate = now;
        }
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