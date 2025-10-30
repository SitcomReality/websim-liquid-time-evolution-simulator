import { MaterialField } from '../fields/MaterialField.js';
import { ElevationField } from '../fields/ElevationField.js';
import { ClimateField } from '../fields/ClimateField.js';
import { ErosionCalculator } from './tier2/ErosionCalculator.js';
import { MaterialFlowSimulator } from './tier2/MaterialFlowSimulator.js';
import { LandformEvolver } from './tier2/LandformEvolver.js';
import { ViscousRockFlow } from './tier2/ViscousRockFlow.js';
import { PARTICLE_TYPES } from '../../utils/Constants.js';

export class Tier2Backend {
  constructor(world, config = {}) {
    this.world = world;
    this.cellSize = config.cellSize || 16;
    this.width = Math.ceil(world.width / this.cellSize);
    this.height = Math.ceil(world.height / this.cellSize);

    // Create field grids
    this.materialField = new MaterialField(this.width, this.height, this.cellSize);
    this.elevationField = new ElevationField(this.width, this.height, this.cellSize);
    this.climateField = new ClimateField(this.width, this.height, this.cellSize);

    const fields = {
      material: this.materialField,
      elevation: this.elevationField,
      climate: this.climateField
    };

    // Initialize subsystems
    this.erosion = new ErosionCalculator(fields);
    this.flow = new MaterialFlowSimulator(fields);
    this.landform = new LandformEvolver(fields);
    this.rockFlow = new ViscousRockFlow(fields);
  }

  update(deltaTime, fidelity) {
    // Run erosion calculator
    this.erosion.update(deltaTime);

    // Apply material flow (deposition/transport)
    this.flow.update(deltaTime);

    // Update landforms (uplift/subsidence)
    this.landform.update(deltaTime);
    
    // Apply slow rock deformation
    this.rockFlow.update(deltaTime);

    // Recalculate flow networks after elevation changes
    this.elevationField.calculateFlowNetwork();

    // Update climate based on new topography
    this.climateField.updateClimate(this.elevationField);
  }

  /**
   * Samples the particle grid to build initial field representations.
   */
  transitionFromTier1(world) {
    const cs = this.cellSize;
    const { width: cellsX, height: cellsY } = this;

    for (let cy = 0; cy < cellsY; cy++) {
      for (let cx = 0; cx < cellsX; cx++) {
        const x0 = cx * cs;
        const y0 = cy * cs;
        const x1 = Math.min(world.width, x0 + cs);
        const y1 = Math.min(world.height, y0 + cs);

        let solidMass = 0, highestSolidY = world.height;
        let sand = 0, soil = 0, granite = 0, basalt = 0;

        for (let y = y0; y < y1; y++) {
          for (let x = x0; x < x1; x++) {
            const p = world.getParticle(x, y);
            const isSolid = p !== PARTICLE_TYPES.EMPTY && p !== PARTICLE_TYPES.WATER && p !== PARTICLE_TYPES.STEAM && p !== PARTICLE_TYPES.CLOUD;
            
            if (isSolid) {
                solidMass++;
                highestSolidY = Math.min(highestSolidY, y);
            }
            if (p === PARTICLE_TYPES.SAND) sand++;
            else if (p === PARTICLE_TYPES.SOIL) soil++;
            else if (p === PARTICLE_TYPES.GRANITE) granite++;
            else if (p === PARTICLE_TYPES.BASALT) basalt++;
          }
        }

        // Set elevation based on highest solid particle
        this.elevationField.baseElevation[cy * cellsX + cx] = solidMass > 0 ? (world.height - highestSolidY) : 0;
        
        // Add materials to material field
        this.materialField.addMaterial(cx, cy, 'sand', sand);
        this.materialField.addMaterial(cx, cy, 'soil', soil);
        this.materialField.addMaterial(cx, cy, 'granite', granite);
        this.materialField.addMaterial(cx, cy, 'basalt', basalt);
      }
    }
    
    // Calculate initial slopes and flow networks
    this.elevationField.calculateFlowNetwork();
    this.climateField.updateClimate(this.elevationField);
  }
  
  /**
   * Projects field data back into the particle world.
   */
  transitionToTier1(world) {
    const cs = this.cellSize;
    const { width: cellsX, height: cellsY } = this;

    for (let cy = 0; cy < cellsY; cy++) {
      for (let cx = 0; cx < cellsX; cx++) {
        const x0 = cx * cs;
        const y0 = cy * cs;
        const x1 = Math.min(world.width, x0 + cs);
        const y1 = Math.min(world.height, y0 + cs);

        const elev = this.elevationField.getElevation(cx, cy);
        const surfaceY = world.height - Math.floor(elev);
        const dominantType = this.materialField.getDominantType(cx, cy);

        for (let y = y0; y < y1; y++) {
          for (let x = x0; x < x1; x++) {
            if (y > surfaceY) {
              world.setParticle(x, y, dominantType);
            } else {
              world.setParticle(x, y, PARTICLE_TYPES.EMPTY);
            }
          }
        }
      }
    }
  }

  // getState/setState for serialization across tiers
  getState() {
    return {
      kind: 'field_world',
      cellSize: this.cellSize,
      width: this.width,
      height: this.height,
      material: {
        mass: this.materialField.mass,
        sand: this.materialField.sand,
        soil: this.materialField.soil,
        granite: this.materialField.granite,
        basalt: this.materialField.basalt
      },
      elevation: {
        base: this.elevationField.baseElevation,
        sediment: this.elevationField.sedimentDepth
      }
    };
  }

  setState(state) {
    if (!state || state.kind !== 'field_world') {
      console.warn("Tier2Backend received incompatible state.");
      return;
    }
    // For now, this is a simple copy. Later, this would handle resolution changes.
    this.materialField.mass.set(state.material.mass);
    this.materialField.sand.set(state.material.sand);
    this.materialField.soil.set(state.material.soil);
    this.materialField.granite.set(state.material.granite);
    this.materialField.basalt.set(state.material.basalt);
    
    this.elevationField.baseElevation.set(state.elevation.base);
    this.elevationField.sedimentDepth.set(state.elevation.sediment);
  }
}