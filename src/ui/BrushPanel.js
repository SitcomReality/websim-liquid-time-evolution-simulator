import { PARTICLE_TYPES } from '../utils/Constants.js';
import { classifyEnvironment } from '../biology/PlantEcology.js';

/**
 * BrushPanel
 * Handles brush type selection, size, and particle drawing on canvas.
 */
export class BrushPanel {
  constructor(world, canvas) {
    this.world = world;
    this.canvas = canvas;

    this.brushType = PARTICLE_TYPES.SAND;
    this.brushSize = 5;
    this.isDrawing = false;

    this.setup();
  }

  setup() {
    // Brush type selector
    const brushTypeSelect = document.getElementById('brushType');
    if (brushTypeSelect) {
      brushTypeSelect.addEventListener('change', (e) => this.onBrushTypeChange(e));
    }

    // Brush size slider
    const brushSizeSlider = document.getElementById('brushSize');
    if (brushSizeSlider) {
      brushSizeSlider.addEventListener('input', (e) => {
        this.brushSize = parseInt(e.target.value, 10);
      });
    }

    // Canvas drawing events (use mouse down to start drawing)
    const canvasEl = this.canvas && this.canvas.canvas;
    if (!canvasEl) return;

    canvasEl.addEventListener('mousedown', (e) => this.startDrawing(e));
    canvasEl.addEventListener('mousemove', (e) => this.draw(e));
    canvasEl.addEventListener('mouseup', () => this.stopDrawing());
    canvasEl.addEventListener('mouseleave', () => this.stopDrawing());

    // Touch support
    canvasEl.addEventListener('touchstart', (e) => {
      e.preventDefault();
      if (e.touches && e.touches[0]) this.startDrawing(e.touches[0]);
    }, { passive: false });

    canvasEl.addEventListener('touchmove', (e) => {
      e.preventDefault();
      if (e.touches && e.touches[0]) this.draw(e.touches[0]);
    }, { passive: false });

    canvasEl.addEventListener('touchend', () => this.stopDrawing());
  }

  onBrushTypeChange(e) {
    const typeMap = {
      'sand': PARTICLE_TYPES.SAND,
      'water': PARTICLE_TYPES.WATER,
      'granite': PARTICLE_TYPES.GRANITE,
      'basalt': PARTICLE_TYPES.BASALT,
      'soil': PARTICLE_TYPES.SOIL,
      'lava': PARTICLE_TYPES.LAVA,
      'ice': PARTICLE_TYPES.ICE,
      'steam': PARTICLE_TYPES.STEAM,
      'plant': PARTICLE_TYPES.PLANT,
      'erase': PARTICLE_TYPES.EMPTY
    };
    this.brushType = typeMap[e.target.value] ?? PARTICLE_TYPES.SAND;
  }

  startDrawing(e) {
    this.isDrawing = true;
    this.draw(e);
  }

  stopDrawing() {
    this.isDrawing = false;
  }

  draw(e) {
    if (!this.isDrawing) return;
    if (!this.canvas || !this.canvas.canvas || !this.world) return;

    const rect = this.canvas.canvas.getBoundingClientRect();
    const scaleX = this.world.width / rect.width;
    const scaleY = this.world.height / rect.height;

    const clientX = typeof e.clientX === 'number' ? e.clientX : 0;
    const clientY = typeof e.clientY === 'number' ? e.clientY : 0;

    const x = Math.floor((clientX - rect.left) * scaleX);
    const y = Math.floor((clientY - rect.top) * scaleY);

    // Draw circle of particles
    for (let dy = -this.brushSize; dy <= this.brushSize; dy++) {
      for (let dx = -this.brushSize; dx <= this.brushSize; dx++) {
        if (dx * dx + dy * dy > this.brushSize * this.brushSize) continue;

        const px = x + dx;
        const py = y + dy;
        if (!this.world.inBounds(px, py)) continue;

        if (this.brushType === PARTICLE_TYPES.PLANT) {
          if (this.world.getParticle(px, py) !== PARTICLE_TYPES.BEDROCK) {
            const env = classifyEnvironment(this.world, px, py);
            this.world.setParticle(px, py, this.brushType, [0, 0, 0, env.colorCode]);
          }
        } else if (this.brushType !== PARTICLE_TYPES.EMPTY) {
          this.world.setParticle(px, py, this.brushType);

          // Set temperature for certain brush types
          if (this.brushType === PARTICLE_TYPES.ICE) {
            this.world.setTemperature(px, py, -10);
          } else if (this.brushType === PARTICLE_TYPES.LAVA) {
            this.world.setTemperature(px, py, 1300);
          } else if (this.brushType === PARTICLE_TYPES.STEAM) {
            this.world.setTemperature(px, py, 110);
          }
        } else {
          // Erase
          this.world.setParticle(px, py, this.brushType);
        }
      }
    }
  }
}