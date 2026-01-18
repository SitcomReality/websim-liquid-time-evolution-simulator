import { PlateBoundaryOverlay } from './tier3/PlateBoundaryOverlay.js';
import { StressFieldOverlay } from './tier3/StressFieldOverlay.js';
import { EventPredictionOverlay } from './tier3/EventPredictionOverlay.js';

/**
 * Tier3Overlays (delegator)
 * Orchestrates rendering of plate-scale debug information by delegating
 * to specific specialized classes.
 */
export class Tier3Overlays {
  constructor(coordinator) {
    this.coordinator = coordinator;

    // Sub-overlays
    this.platesOverlay = new PlateBoundaryOverlay(coordinator);
    this.stressOverlay = new StressFieldOverlay(coordinator);
    this.eventsOverlay = new EventPredictionOverlay(coordinator);
  }

  destroy() {
    // No specific cleanup required for children currently
  }

  render(type) {
    switch (type) {
      case 'plates':
        this.platesOverlay.render();
        break;
      case 'stress':
        this.stressOverlay.render();
        break;
      case 'events':
        this.eventsOverlay.render();
        break;
      default:
        break;
    }
  }
}