import { Tier2Overlays } from './overlays/Tier2Overlays.js';
import { Tier3Overlays } from './overlays/Tier3Overlays.js';
import { OverlayControls } from './overlays/OverlayControls.js';

/**
 * TierDebugOverlay (coordinator)
 * Lightweight coordinator that delegates rendering and control UI to smaller modules.
 */
export class TierDebugOverlay {
  constructor(canvasWrapper, world, simulation) {
    this.canvasWrapper = canvasWrapper;
    this.world = world;
    this.simulation = simulation;

    this.overlayCanvas = null;
    this.overlayCtx = null;
    this.overlayType = 'none'; // selected overlay type

    // Submodules
    this.controls = new OverlayControls(this);
    this.tier2 = new Tier2Overlays(this);
    this.tier3 = new Tier3Overlays(this);

    this._resizeHandler = () => this._resizeOverlay();
    this._setup();
  }

  _setup() {
    const parent = this.canvasWrapper.canvas.parentElement;
    if (!parent) return;

    // Create overlay canvas and position it absolutely over the main canvas
    this.overlayCanvas = document.createElement('canvas');
    this.overlayCanvas.id = 'tierDebugOverlay';
    this.overlayCanvas.style.position = 'absolute';
    this.overlayCanvas.style.top = `${this.canvasWrapper.canvas.offsetTop}px`;
    this.overlayCanvas.style.left = `${this.canvasWrapper.canvas.offsetLeft}px`;
    this.overlayCanvas.style.pointerEvents = 'none';
    this.overlayCanvas.style.zIndex = '20';
    this.overlayCanvas.style.display = 'none';

    parent.style.position = parent.style.position || 'relative';
    parent.appendChild(this.overlayCanvas);

    this.overlayCtx = this.overlayCanvas.getContext('2d');

    // Keep size in sync
    window.addEventListener('resize', this._resizeHandler);
    this._resizeOverlay();
  }

  destroy() {
    window.removeEventListener('resize', this._resizeHandler);
    this.controls.destroy();
    this.tier2.destroy();
    this.tier3.destroy();
    if (this.overlayCanvas && this.overlayCanvas.parentElement) {
      this.overlayCanvas.parentElement.removeChild(this.overlayCanvas);
    }
  }

  _resizeOverlay() {
    if (!this.overlayCanvas || !this.canvasWrapper || !this.canvasWrapper.canvas) return;
    const main = this.canvasWrapper.canvas;
    this.overlayCanvas.width = main.width;
    this.overlayCanvas.height = main.height;
    this.overlayCanvas.style.width = main.style.width;
    this.overlayCanvas.style.height = main.style.height;
  }

  setOverlayType(type) {
    this.overlayType = type || 'none';
    if (!this.overlayCanvas) return;
    this.overlayCanvas.style.display = this.overlayType === 'none' ? 'none' : 'block';
  }

  render() {
    if (!this.overlayCanvas || !this.overlayCtx) return;
    if (this.overlayType === 'none') return;

    // Resize if needed before drawing
    this._resizeOverlay();

    // Clear
    this.overlayCtx.clearRect(0, 0, this.overlayCanvas.width, this.overlayCanvas.height);

    const tier = this.simulation.tierManager?.activeTier;
    if (!tier) return;

    if (tier.key === 'GEOLOGICAL_SCALE') {
      this.tier2.render(this.overlayType);
    } else if (tier.key === 'TECTONIC_SCALE') {
      this.tier3.render(this.overlayType);
    } else {
      this._drawMessage('Tier 1: use particle-level debug tools');
    }
  }

  // simple helper reused by modules
  _drawMessage(msg) {
    const ctx = this.overlayCtx;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(6, 6, 260, 32);
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.font = '12px Space Mono';
    ctx.fillText(msg, 12, 28);
    ctx.restore();
  }

  // small helper to expose ctx/canvas/world/backend to modules
  get context() { return this.overlayCtx; }
  get canvas() { return this.overlayCanvas; }
  get worldRef() { return this.world; }
  get simulationRef() { return this.simulation; }
}