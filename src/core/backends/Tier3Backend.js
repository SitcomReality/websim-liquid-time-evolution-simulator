import { PlateSystem } from './tier3/PlateSystem.js';
import { SeafloorSpreading } from './tier3/SeafloorSpreading.js';
import { SubductionHandler } from './tier3/SubductionHandler.js';
import { EventManager } from './tier3/EventManager.js';
import { GlacialCycles } from './tier3/GlacialCycles.js';
import { FieldGrid } from '../fields/FieldGrid.js';

/**
 * Tier3Backend
 * Tectonic-scale simulation for million-year timescales.
 * 
 * Systems:
 * - PlateSystem: Manages tectonic plates and boundaries
 * - SeafloorSpreading: Creates new crust at ridges
 * - SubductionHandler: Mountain building and volcanism
 * - EventManager: Schedules major geological events
 * - GlacialCycles: Ice ages and erosion/deposition patterns
 * 
 * Data representation: FieldGrid (coarse cells, ~32px each)
 */
export class Tier3Backend {
  constructor(world, config = {}) {
    this.world = world;
    this.simulationTime = 0;
    this.updateCount = 0;

    // Cell resolution (pixels per field cell)
    this.cellSize = config.cellSize || 32;
    this.width = Math.ceil(world.width / this.cellSize);
    this.height = Math.ceil(world.height / this.cellSize);

    // Core field grid
    this.fieldGrid = new FieldGrid(this.width, this.height, this.cellSize);

    // Tectonic systems
    this.plateSystem = new PlateSystem(
      {
        elevationField: this.fieldGrid,
        materialField: this.fieldGrid,
        climateField: this.fieldGrid
      },
      {
        cellSize: this.cellSize,
        numPlatesX: config.numPlatesX || 3,
        numPlatesY: config.numPlatesY || 2
      }
    );

    this.spreading = new SeafloorSpreading(this.plateSystem, {
      elevationField: this.fieldGrid,
      materialField: this.fieldGrid,
      climateField: this.fieldGrid
    });

    this.subduction = new SubductionHandler(this.plateSystem, {
      elevationField: this.fieldGrid,
      materialField: this.fieldGrid,
      climateField: this.fieldGrid
    });

    // Event and climate systems
    this.eventManager = new EventManager(this.plateSystem, {
      elevationField: this.fieldGrid,
      materialField: this.fieldGrid,
      climateField: this.fieldGrid
    });

    this.glacialCycles = new GlacialCycles({
      elevationField: this.fieldGrid,
      materialField: this.fieldGrid,
      climateField: this.fieldGrid
    });
  }

  /**
   * Main update loop for Tier3.
   * Run at very low frequency (typically once per 100s of sim-seconds).
   */
  update(deltaTime, fidelity) {
    this.simulationTime += deltaTime;
    this.updateCount++;

    // Move plates (geological timescale)
    this.plateSystem.updatePlatePositions(deltaTime);

    // Geological processes
    if (this.updateCount % 2 === 0) {
      this.spreading.update(deltaTime);
      this.subduction.update(deltaTime);
    }

    // Isostatic adjustment (very low frequency)
    if (this.updateCount % 4 === 0) {
      this.applyIsostasy(deltaTime);
    }

    // Climate and events
    this.eventManager.update(deltaTime);
    this.glacialCycles.update(deltaTime);

    // Recalculate flow networks after major changes
    if (this.updateCount % 5 === 0) {
      this.fieldGrid.calculateFlowNetwork?.();
    }
  }

  /**
   * Transition from Tier2 field data.
   * Copy field grid data into this backend's representation.
   */
  transitionFromTier2(tier2Fields) {
    if (!tier2Fields) return;

    // Copy elevation
    if (tier2Fields.elevation) {
      const srcElevation = tier2Fields.elevation;
      const dstElevation = this.fieldGrid.elevation;
      const copyLen = Math.min(srcElevation.length, dstElevation.length);
      for (let i = 0; i < copyLen; i++) {
        dstElevation[i] = srcElevation[i];
      }
    }

    // Copy materials
    if (tier2Fields.material) {
      const copyMats = (srcArray, dstArray) => {
        const copyLen = Math.min(srcArray.length, dstArray.length);
        for (let i = 0; i < copyLen; i++) {
          dstArray[i] = srcArray[i];
        }
      };
      if (tier2Fields.material.sand) copyMats(tier2Fields.material.sand, this.fieldGrid.rockFracSand);
      if (tier2Fields.material.soil) copyMats(tier2Fields.material.soil, this.fieldGrid.rockFracSoil);
      if (tier2Fields.material.granite) copyMats(tier2Fields.material.granite, this.fieldGrid.rockFracGranite);
      if (tier2Fields.material.basalt) copyMats(tier2Fields.material.basalt, this.fieldGrid.rockFracBasalt);
    }

    // Reinitialize plate system to match new field data
    this.plateSystem = new PlateSystem(
      {
        elevationField: this.fieldGrid,
        materialField: this.fieldGrid,
        climateField: this.fieldGrid
      },
      { cellSize: this.cellSize, numPlatesX: 3, numPlatesY: 2 }
    );
    // Detect initial boundaries from the inherited field mosaic
    this.plateSystem.detectBoundaries();

    console.log('[Tier3Backend] Transitioned from Tier2 data');
  }

  /**
   * Transition to Tier2 field data.
   * Export current field state for downgrade to Tier2.
   */
  transitionToTier2() {
    return {
      kind: 'field_world',
      cellSize: this.cellSize,
      width: this.width,
      height: this.height,
      elevation: {
        base: this.fieldGrid.elevation.slice(0)
      },
      material: {
        sand: this.fieldGrid.rockFracSand.slice(0),
        soil: this.fieldGrid.rockFracSoil.slice(0),
        granite: this.fieldGrid.rockFracGranite.slice(0),
        basalt: this.fieldGrid.rockFracBasalt.slice(0)
      }
    };
  }

  /**
   * Get current state for serialization.
   */
  getState() {
    return {
      kind: 'tectonic_world',
      cellSize: this.cellSize,
      width: this.width,
      height: this.height,
      simulationTime: this.simulationTime,
      fieldGrid: {
        elevation: this.fieldGrid.elevation.slice(0),
        rockFracSand: this.fieldGrid.rockFracSand.slice(0),
        rockFracSoil: this.fieldGrid.rockFracSoil.slice(0),
        rockFracGranite: this.fieldGrid.rockFracGranite.slice(0),
        rockFracBasalt: this.fieldGrid.rockFracBasalt.slice(0)
      },
      plateSystem: this.plateSystem.getState(),
      glacialCycles: {
        globalTemperature: this.glacialCycles.globalTemperature,
        glacierThickness: this.glacialCycles.glacierThickness.slice(0)
      },
      eventHistory: this.eventManager.eventHistory.slice(-20)
    };
  }

  /**
   * Restore state from serialization.
   */
  setState(state) {
    if (!state || state.kind !== 'tectonic_world') return;

    this.simulationTime = state.simulationTime || 0;

    if (state.fieldGrid) {
      if (state.fieldGrid.elevation) this.fieldGrid.elevation.set(state.fieldGrid.elevation);
      if (state.fieldGrid.rockFracSand) this.fieldGrid.rockFracSand.set(state.fieldGrid.rockFracSand);
      if (state.fieldGrid.rockFracSoil) this.fieldGrid.rockFracSoil.set(state.fieldGrid.rockFracSoil);
      if (state.fieldGrid.rockFracGranite) this.fieldGrid.rockFracGranite.set(state.fieldGrid.rockFracGranite);
      if (state.fieldGrid.rockFracBasalt) this.fieldGrid.rockFracBasalt.set(state.fieldGrid.rockFracBasalt);
    }

    if (state.plateSystem) {
      this.plateSystem.setState(state.plateSystem);
    }

    if (state.glacialCycles) {
      this.glacialCycles.globalTemperature = state.glacialCycles.globalTemperature;
      if (state.glacialCycles.glacierThickness) {
        this.glacialCycles.glacierThickness.set(state.glacialCycles.glacierThickness);
      }
    }
  }

  // Light isostatic compensation: heavy crust sinks slightly; light crust rebounds
  applyIsostasy(deltaTime) {
    const g = this.fieldGrid;
    const n = g.size;
    let totalLoad = 0;
    for (let i = 0; i < n; i++) {
      // Effective "load" from rock mix; heavier rocks count more
      const load = g.rockFracBasalt[i] * 3.0 + g.rockFracGranite[i] * 2.7 + g.rockFracSand[i] * 1.5 + g.rockFracSoil[i] * 1.3;
      totalLoad += load;
    }
    const avgLoad = totalLoad / Math.max(1, n);
    const rate = 0.0002 * deltaTime; // very slow adjustment
    for (let i = 0; i < n; i++) {
      const load = g.rockFracBasalt[i] * 3.0 + g.rockFracGranite[i] * 2.7 + g.rockFracSand[i] * 1.5 + g.rockFracSoil[i] * 1.3;
      const delta = (avgLoad - load) * rate; // heavy (load>avg) → negative (subsidence), light → positive (rebound)
      g.elevation[i] = Math.max(0, Math.min(1, g.elevation[i] + delta));
    }
  }
}