import { ParticleUpdater } from '../physics/ParticleUpdater.js';

export class Simulation {
    constructor(world) {
        this.world = world;
        this.particleUpdater = new ParticleUpdater(world);
        this.timeScale = 1;
        this.running = true;
        this.simulationTime = 0;
        
        this.lastUpdate = performance.now();
        this.updateCount = 0;
        this.ups = 0;
    }
    
    setTimeScale(scale) {
        this.timeScale = scale;
    }
    
    update(deltaTime) {
        if (!this.running) return;
        
        const updatesThisFrame = Math.floor(this.timeScale);
        
        for (let i = 0; i < updatesThisFrame; i++) {
            this.particleUpdater.update();
            this.simulationTime += deltaTime;
            this.updateCount++;
        }
        
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
        // Assume 1 second = 1 day at 1x speed
        const days = this.simulationTime / 1000;
        return (days / 365).toFixed(2);
    }
}

