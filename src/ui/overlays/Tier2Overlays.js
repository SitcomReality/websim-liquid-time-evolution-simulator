import { PARTICLE_TYPES } from '../../utils/Constants.js';

/**
 * Tier2Overlays
 * Handles debug visualizations for Geological Scale simulation.
 * Visualizes flow networks, erosion intensities, and material composition.
 */
export class Tier2Overlays {
  constructor(coordinator) {
    this.coordinator = coordinator;
  }

  destroy() {
    // Cleanup if necessary
  }

  /**
   * Main render entry point called by the coordinator.
   */
  render(type) {
    const backend = this.coordinator.simulationRef.backend;
    const ctx = this.coordinator.context;
    if (!backend || !ctx) return;

    ctx.save();
    switch (type) {
      case 'flow':
        this._renderFlowNetwork(ctx, backend);
        break;
      case 'erosion':
        this._renderErosionRates(ctx, backend);
        break;
      case 'material':
        this._renderMaterialComposition(ctx, backend);
        break;
      default:
        break;
    }
    ctx.restore();
  }

  /**
   * Visualizes the steepest descent flow network.
   */
  _renderFlowNetwork(ctx, backend) {
    const elev = backend.elevationField;
    if (!elev || !elev.flowDirX) {
      this.coordinator._drawMessage('Flow data unavailable');
      return;
    }

    const cw = this.coordinator.canvas.width;
    const ch = this.coordinator.canvas.height;
    const scaleX = cw / this.coordinator.worldRef.width;
    const scaleY = ch / this.coordinator.worldRef.height;
    const cellSize = backend.cellSize;

    ctx.strokeStyle = 'rgba(0, 180, 255, 0.6)';
    ctx.lineWidth = 1.2;

    // Optimization: Skip rendering arrows that are too small or outside view
    const step = elev.width > 100 ? 2 : 1; 

    for (let y = 0; y < elev.height; y += step) {
      for (let x = 0; x < elev.width; x += step) {
        const idx = elev.getIndex(x, y);
        const vx = elev.flowDirX[idx];
        const vy = elev.flowDirY[idx];

        if (Math.abs(vx) < 0.01 && Math.abs(vy) < 0.01) continue;

        const px = (x * cellSize + cellSize / 2) * scaleX;
        const py = (y * cellSize + cellSize / 2) * scaleY;
        const length = cellSize * 0.6 * scaleX;

        // Draw arrow
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(px + vx * length, py + vy * length);
        ctx.stroke();

        // Arrow head
        const angle = Math.atan2(vy, vx);
        ctx.beginPath();
        ctx.moveTo(px + vx * length, py + vy * length);
        ctx.lineTo(px + vx * length - Math.cos(angle - 0.5) * 4, py + vy * length - Math.sin(angle - 0.5) * 4);
        ctx.moveTo(px + vx * length, py + vy * length);
        ctx.lineTo(px + vx * length - Math.cos(angle + 0.5) * 4, py + vy * length - Math.sin(angle + 0.5) * 4);
        ctx.stroke();
      }
    }

    this._drawLegend(ctx, 'Flow Network (Gravity)', 'rgba(0, 180, 255, 0.9)');
  }

  /**
   * Heatmap of erosion intensity.
   */
  _renderErosionRates(ctx, backend) {
    if (!backend.erosion) {
      this.coordinator._drawMessage('Erosion data unavailable');
      return;
    }

    const erosionMap = backend.erosion.update(0); // Zero delta just to sample current rates
    const elev = backend.elevationField;
    const cw = this.coordinator.canvas.width;
    const ch = this.coordinator.canvas.height;
    const scaleX = cw / this.coordinator.worldRef.width;
    const scaleY = ch / this.coordinator.worldRef.height;
    const cellSize = backend.cellSize;

    for (let y = 0; y < elev.height; y++) {
      for (let x = 0; x < elev.width; x++) {
        const idx = elev.getIndex(x, y);
        const rate = erosionMap[idx] || 0;
        if (rate <= 0) continue;

        // Map rate to color: Yellow -> Red
        const intensity = Math.min(1.0, rate * 50); 
        ctx.fillStyle = `rgba(255, ${Math.floor(255 * (1 - intensity))}, 0, 0.6)`;
        
        ctx.fillRect(
          x * cellSize * scaleX,
          y * cellSize * scaleY,
          cellSize * scaleX + 1,
          cellSize * scaleY + 1
        );
      }
    }

    this._drawLegend(ctx, 'Erosion Intensity (Heatmap)', 'rgba(255, 100, 0, 0.9)');
  }

  /**
   * Shows dominant rock types in the field grid.
   */
  _renderMaterialComposition(ctx, backend) {
    const mat = backend.materialField;
    if (!mat) {
      this.coordinator._drawMessage('Material field unavailable');
      return;
    }

    const cw = this.coordinator.canvas.width;
    const ch = this.coordinator.canvas.height;
    const scaleX = cw / this.coordinator.worldRef.width;
    const scaleY = ch / this.coordinator.worldRef.height;
    const cellSize = backend.cellSize;

    const colors = {
      granite: [180, 180, 200],
      basalt: [60, 60, 80],
      sand: [210, 190, 130],
      soil: [120, 90, 60]
    };

    for (let y = 0; y < mat.height; y++) {
      for (let x = 0; x < mat.width; x++) {
        const idx = mat.getIndex(x, y);
        if (mat.mass[idx] <= 0) continue;

        const sand = mat.sand[idx];
        const soil = mat.soil[idx];
        const granite = mat.granite[idx];
        const basalt = mat.basalt[idx];

        // Find dominant
        let dominant = 'soil';
        let max = soil;
        if (sand > max) { dominant = 'sand'; max = sand; }
        if (granite > max) { dominant = 'granite'; max = granite; }
        if (basalt > max) { dominant = 'basalt'; max = basalt; }

        const color = colors[dominant];
        ctx.fillStyle = `rgba(${color[0]}, ${color[1]}, ${color[2]}, 0.7)`;
        
        ctx.fillRect(
          x * cellSize * scaleX,
          y * cellSize * scaleY,
          cellSize * scaleX + 1,
          cellSize * scaleY + 1
        );
      }
    }

    this._drawLegend(ctx, 'Material Domains', 'rgba(255, 255, 255, 0.9)', [
      { color: 'rgb(180, 180, 200)', label: 'Granite (Basement)' },
      { color: 'rgb(60, 60, 80)', label: 'Basalt (Oceanic)' },
      { color: 'rgb(210, 190, 130)', label: 'Sand (Sediment)' },
      { color: 'rgb(120, 90, 60)', label: 'Soil (Regolith)' }
    ]);
  }

  /**
   * Helper to draw a legend panel on the overlay.
   */
  _drawLegend(ctx, title, titleColor, items = null) {
    ctx.save();
    const x = 12;
    const y = 12;
    const width = 200;
    const itemHeight = 18;
    const height = 30 + (items ? items.length * itemHeight : 0);

    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, 4);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = titleColor;
    ctx.font = 'bold 11px Space Mono, monospace';
    ctx.fillText(title, x + 10, y + 18);

    if (items) {
      ctx.font = '10px Space Mono, monospace';
      items.forEach((item, i) => {
        const iy = y + 36 + i * itemHeight;
        ctx.fillStyle = item.color;
        ctx.fillRect(x + 10, iy - 8, 10, 10);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.fillText(item.label, x + 28, iy);
      });
    }
    ctx.restore();
  }
}