import { BrushPanel } from './BrushPanel.js';
import { TierPanel } from './TierPanel.js';
import { TimeScalePanel } from './TimeScalePanel.js';
import { SimulationPanel } from './SimulationPanel.js';

/**
 * Controls
 * Main controller that orchestrates all UI panels and control systems.
 */
export class Controls {
  constructor(world, simulation, canvas) {
    this.world = world;
    this.simulation = simulation;
    this.canvas = canvas;

    // Initialize sub-panels
    this.brushPanel = new BrushPanel(world, canvas);
    this.tierPanel = new TierPanel(simulation);
    this.timeScalePanel = new TimeScalePanel(simulation);
    this.simulationPanel = new SimulationPanel(simulation, canvas);
  }
}