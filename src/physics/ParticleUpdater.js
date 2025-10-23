import { PARTICLE_TYPES } from '../utils/Constants.js';
import { FallingSolidUpdater } from './updaters/FallingSolidUpdater.js';
import { LiquidUpdater } from './updaters/LiquidUpdater.js';
import { LavaUpdater } from './updaters/LavaUpdater.js';
import { SteamUpdater } from './updaters/SteamUpdater.js';
import { SoilUpdater } from './updaters/SoilUpdater.js';
import { PlantUpdater } from './updaters/PlantUpdater.js';
import { ErosionUpdater } from './updaters/ErosionUpdater.js';
import { SlowProcessesUpdater } from './updaters/SlowProcessesUpdater.js';
import { ThermalUpdater } from './updaters/ThermalUpdater.js';
import { GeologicalUpdater } from './updaters/GeologicalUpdater.js';
import { IceUpdater } from './updaters/IceUpdater.js';
import { CloudUpdater } from './updaters/CloudUpdater.js';

export class ParticleUpdater {
    constructor(world) {
        this.world = world;
        this.erosionAccumulator = 0;
        this.weatheringAccumulator = 0;

        // instantiate small updaters
        this.fallingUpdater = new FallingSolidUpdater(world);
        this.liquidUpdater = new LiquidUpdater(world);
        this.lavaUpdater = new LavaUpdater(world, this.liquidUpdater);
        this.steamUpdater = new SteamUpdater(world);
        this.soilUpdater = new SoilUpdater(world);
        this.plantUpdater = new PlantUpdater(world);
        this.iceUpdater = new IceUpdater(world);

        // New modular updaters
        this.erosionUpdater = new ErosionUpdater(world);
        this.slowUpdater = new SlowProcessesUpdater(world);
        this.thermalUpdater = new ThermalUpdater(world);
        this.geologicalUpdater = new GeologicalUpdater(world);
        this.cloudUpdater = new CloudUpdater(world);
    }
    
    update(fidelity, deltaTime) {
        this.world.clearUpdated();
        
        // Update thermodynamics
        this.thermalUpdater.update(fidelity, deltaTime);
        
        const activeChunks = Array.from(this.world.activeChunks);
        this.world.activeChunks.clear();

        // Skip sleeping chunks for fast physics
        const awakeChunks = activeChunks.filter(id => !this.world.isChunkAsleep(id));
        
        // Shuffle chunks to avoid directional bias
        for (let i = awakeChunks.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [awakeChunks[i], awakeChunks[j]] = [awakeChunks[j], awakeChunks[i]];
        }
        
        for (const chunkId of awakeChunks) {
            const chunkX = chunkId % this.world.chunksX;
            const chunkY = Math.floor(chunkId / this.world.chunksX);

            const startX = chunkX * this.world.chunkSize;
            const startY = chunkY * this.world.chunkSize;
            const endX = Math.min(startX + this.world.chunkSize, this.world.width);
            const endY = Math.min(startY + this.world.chunkSize, this.world.height);
            
            // Update from bottom to top for falling particles
            for (let y = endY - 1; y >= startY; y--) {
                const dir = Math.random() > 0.5 ? 1 : -1;
                const xStart = dir > 0 ? startX : endX - 1;
                const xEnd = dir > 0 ? endX : startX - 1;
                
                for (let x = xStart; dir > 0 ? x < xEnd : x > xEnd; x += dir) {
                    if (this.world.isUpdated(x, y)) continue;

                    // Fidelity check - skip some particles for performance
                    if (Math.random() > fidelity) continue;
                    
                    const particle = this.world.getParticle(x, y);
                    if (particle === PARTICLE_TYPES.EMPTY) continue;
                    
                    this.updateParticle(x, y, particle, deltaTime);
                }
            }
        }
        
        this.world.updateChunkSleep();

        // Geological processes scale with time
        this.geologicalUpdater.update(deltaTime, fidelity);
        
        this.erosionAccumulator += deltaTime;
        this.weatheringAccumulator += deltaTime;
        
        // Run erosion periodically (scales with simulation time)
        if (this.erosionAccumulator > 100) {
            const erosionCount = Math.ceil((this.world.size / 5000) * fidelity);
            for (let i = 0; i < erosionCount; i++) {
                this.erosionUpdater.runOnce(fidelity);
            }
            this.erosionAccumulator = 0;
        }
        
        // Run weathering/slow processes
        if (this.weatheringAccumulator > 50) {
            const slowUpdateCount = Math.ceil((this.world.size / 2000) * fidelity);
            for (let i = 0; i < slowUpdateCount; i++) {
                this.slowUpdater.runOnce(deltaTime, fidelity);
            }
            this.weatheringAccumulator = 0;
        }
        // Primordials handled in main loop via manager
    }
    
    updateParticle(x, y, type, deltaTime) {
        switch(type) {
            case PARTICLE_TYPES.SAND:
                this.fallingUpdater.update(x, y);
                break;
            case PARTICLE_TYPES.WATER:
                this.liquidUpdater.update(x, y);
                break;
            case PARTICLE_TYPES.LAVA:
                this.lavaUpdater.update(x, y);
                break;
            case PARTICLE_TYPES.STEAM:
                this.steamUpdater.update(x, y);
                break;
            case PARTICLE_TYPES.SOIL:
                this.soilUpdater.update(x, y);
                break;
            case PARTICLE_TYPES.ICE:
                this.iceUpdater.update(x, y);
                break;
            case PARTICLE_TYPES.PLANT:
                this.plantUpdater.update(x, y, deltaTime);
                break;
            case PARTICLE_TYPES.CLOUD:
                this.cloudUpdater.update(x, y, deltaTime);
                break;
        }
    }

    updateSlowProcesses(deltaTime) {
        const x = Math.floor(Math.random() * this.world.width);
        const y = Math.floor(Math.random() * this.world.height);

        const particleType = this.world.getParticle(x, y);
        
        if (particleType === PARTICLE_TYPES.PLANT) {
            this.plantUpdater.update(x, y, deltaTime);
        } else if (particleType === PARTICLE_TYPES.STONE) {
            // Stone weathering into soil
            const above = this.world.getParticle(x, y - 1);
            if ((above === PARTICLE_TYPES.EMPTY || above === PARTICLE_TYPES.WATER) && Math.random() < 0.0001) {
                this.world.setParticle(x, y, PARTICLE_TYPES.SOIL);
            }
        }
    }
    
    updateErosion() {
        // Water erodes stone/soil over time
        const x = Math.floor(Math.random() * this.world.width);
        const y = Math.floor(Math.random() * this.world.height);
        
        if (this.world.getParticle(x, y) === PARTICLE_TYPES.WATER) {
            // Check for erodible material below or beside
            for (let dx = -1; dx <= 1; dx++) {
                for (let dy = 0; dy <= 1; dy++) {
                    const nx = x + dx;
                    const ny = y + dy;
                    const neighbor = this.world.getParticle(nx, ny);
                    
                    if (neighbor === PARTICLE_TYPES.SOIL && Math.random() < 0.01) {
                        this.world.setParticle(nx, ny, PARTICLE_TYPES.SAND);
                    } else if (neighbor === PARTICLE_TYPES.STONE && Math.random() < 0.001) {
                        this.world.setParticle(nx, ny, PARTICLE_TYPES.SOIL);
                    }
                }
            }
        }
    }
}