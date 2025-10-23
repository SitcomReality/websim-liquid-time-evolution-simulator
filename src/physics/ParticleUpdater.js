import { PARTICLE_TYPES } from '../utils/Constants.js';
import { UnifiedFluidUpdater } from './updaters/UnifiedFluidUpdater.js';
import { PlantUpdater } from './updaters/PlantUpdater.js';
import { LavaUpdater } from './updaters/LavaUpdater.js';
import { SteamUpdater } from './updaters/SteamUpdater.js';
import { CloudUpdater } from './updaters/CloudUpdater.js';
import { ErosionUpdater } from './updaters/ErosionUpdater.js';
import { SlowProcessesUpdater } from './updaters/SlowProcessesUpdater.js';
import { ThermalUpdater } from './updaters/ThermalUpdater.js';
import { GeologicalUpdater } from './updaters/GeologicalUpdater.js';
import { IceUpdater } from './updaters/IceUpdater.js';
import { AirflowUpdater } from './updaters/AirflowUpdater.js';

export class ParticleUpdater {
    constructor(world) {
        this.world = world;
        this.erosionAccumulator = 0;
        this.weatheringAccumulator = 0;

        // Main unified fluid updater for all particles
        this.fluidUpdater = new UnifiedFluidUpdater(world);
        
        // Specialized updaters for particles with unique behaviors
        this.plantUpdater = new PlantUpdater(world);
        this.lavaUpdater = new LavaUpdater(world, this.fluidUpdater);
        this.steamUpdater = new SteamUpdater(world);
        this.cloudUpdater = new CloudUpdater(world);
        this.iceUpdater = new IceUpdater(world);
        
        // Slow/background processes
        this.erosionUpdater = new ErosionUpdater(world);
        this.slowUpdater = new SlowProcessesUpdater(world);
        this.thermalUpdater = new ThermalUpdater(world);
        this.airflowUpdater = new AirflowUpdater(world);
        this.geologicalUpdater = new GeologicalUpdater(world);
    }
    
    update(fidelity, deltaTime) {
        this.world.clearUpdated();
        
        // Update thermodynamics and airflow
        this.thermalUpdater.update(fidelity, deltaTime);
        this.airflowUpdater.update(fidelity, deltaTime);
        
        const activeChunks = Array.from(this.world.activeChunks);
        this.world.activeChunks.clear();

        // Skip sleeping chunks
        const awakeChunks = activeChunks.filter(id => !this.world.isChunkAsleep(id));
        
        // Shuffle chunks to avoid directional bias
        for (let i = awakeChunks.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [awakeChunks[i], awakeChunks[j]] = [awakeChunks[j], awakeChunks[i]];
        }
        
        const timeScale = deltaTime / 16;
        
        for (const chunkId of awakeChunks) {
            const chunkX = chunkId % this.world.chunksX;
            const chunkY = Math.floor(chunkId / this.world.chunksX);

            const startX = chunkX * this.world.chunkSize;
            const startY = chunkY * this.world.chunkSize;
            const endX = Math.min(startX + this.world.chunkSize, this.world.width);
            const endY = Math.min(startY + this.world.chunkSize, this.world.height);
            
            // Update from bottom to top for proper gravity simulation
            for (let y = endY - 1; y >= startY; y--) {
                const dir = Math.random() > 0.5 ? 1 : -1;
                const xStart = dir > 0 ? startX : endX - 1;
                const xEnd = dir > 0 ? endX : startX - 1;
                
                for (let x = xStart; dir > 0 ? x < xEnd : x > xEnd; x += dir) {
                    if (this.world.isUpdated(x, y)) continue;
                    if (Math.random() > fidelity) continue;
                    
                    const particle = this.world.getParticle(x, y);
                    if (particle === PARTICLE_TYPES.EMPTY) continue;
                    
                    this.updateParticle(x, y, particle, deltaTime, timeScale, fidelity);
                }
            }
        }
        
        this.world.updateChunkSleep();

        // Geological processes
        this.geologicalUpdater.update(deltaTime, fidelity);
        
        // Erosion
        this.erosionAccumulator += deltaTime;
        if (this.erosionAccumulator > 100) {
            const erosionCount = Math.ceil((this.world.size / 5000) * fidelity);
            for (let i = 0; i < erosionCount; i++) {
                this.erosionUpdater.runOnce(fidelity);
            }
            this.erosionAccumulator = 0;
        }
        
        // Slow weathering processes
        this.weatheringAccumulator += deltaTime;
        if (this.weatheringAccumulator > 50) {
            const slowUpdateCount = Math.ceil((this.world.size / 2000) * fidelity);
            for (let i = 0; i < slowUpdateCount; i++) {
                this.slowUpdater.runOnce(deltaTime, fidelity);
            }
            this.weatheringAccumulator = 0;
        }
    }
    
    updateParticle(x, y, type, deltaTime, timeScale, fidelity) {
        switch(type) {
            case PARTICLE_TYPES.PLANT:
                this.plantUpdater.update(x, y, deltaTime);
                break;
            case PARTICLE_TYPES.LAVA:
                // Lava has special thermal behavior but still uses fluid physics
                this.lavaUpdater.update(x, y);
                break;
            case PARTICLE_TYPES.STEAM:
                // Steam rises and spreads
                this.steamUpdater.update(x, y);
                break;
            case PARTICLE_TYPES.CLOUD:
                // Clouds have special precipitation logic
                this.cloudUpdater.update(x, y, deltaTime);
                break;
            case PARTICLE_TYPES.ICE:
                // Ice has special floating/melting behavior
                this.iceUpdater.update(x, y);
                break;
            case PARTICLE_TYPES.ANIMAL:
                // Animals don't flow
                break;
            default:
                // All other particles use unified fluid physics
                this.fluidUpdater.update(x, y, timeScale, fidelity);
                break;
        }
    }
}