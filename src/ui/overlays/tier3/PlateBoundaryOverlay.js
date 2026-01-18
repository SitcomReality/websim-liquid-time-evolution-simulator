import { hslToRgb, drawLegend } from './OverlayHelpers.js';

export class PlateBoundaryOverlay {
  constructor(coordinator) {
    this.coordinator = coordinator;
  }

  render() {
    const backend = this.coordinator.simulationRef.backend;
    const ps = backend?.plateSystem;
    const ctx = this.coordinator.context;
    if (!ps || !ps.plateIdField) {
      this.coordinator._drawMessage('Plate system unavailable');
      return;
    }

    const cw = this.coordinator.canvas.width;
    const ch = this.coordinator.canvas.height;
    const cellSize = backend.cellSize || 32;
    const scaleX = cw / this.coordinator.worldRef.width;
    const scaleY = ch / this.coordinator.worldRef.height;

    const plateCount = ps.plates.length;
    const hues = new Array(plateCount).fill(0).map((_, i) => (i / Math.max(1, plateCount)) * 360);

    const image = ctx.createImageData(cw, ch);
    const data = image.data;

    for (let y = 0; y < ps.height; y++) {
      for (let x = 0; x < ps.width; x++) {
        const idx = ps.getIndex(x, y);
        const pid = ps.plateIdField[idx] || 0;
        const hue = hues[pid] || 0;
        const rgb = hslToRgb(hue / 360, 0.5, 0.5);

        const px = Math.floor(x * cellSize * scaleX);
        const py = Math.floor(y * cellSize * scaleY);
        const pw = Math.ceil(cellSize * scaleX);
        const ph = Math.ceil(cellSize * scaleY);

        for (let yy = 0; yy < ph; yy++) {
          for (let xx = 0; xx < pw; xx++) {
            const sx = px + xx;
            const sy = py + yy;
            if (sx < 0 || sx >= cw || sy < 0 || sy >= ch) continue;
            const pix = (sy * cw + sx) * 4;
            data[pix] = rgb.r;
            data[pix + 1] = rgb.g;
            data[pix + 2] = rgb.b;
            data[pix + 3] = 100;
          }
        }
      }
    }

    ctx.putImageData(image, 0, 0);

    // Draw boundaries markers
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 1.5;

    for (const b of ps.boundaries || []) {
      const px = (b.x * cellSize + cellSize / 2) * scaleX;
      const py = (b.y * cellSize + cellSize / 2) * scaleY;
      ctx.beginPath();
      ctx.arc(px, py, 4, 0, Math.PI * 2);
      ctx.stroke();

      let symbol = '—';
      let color = 'rgba(255,255,255,0.9)';
      if (b.type === 'divergent') { symbol = '◀▶'; color = 'rgba(100,255,100,0.95)'; }
      else if (b.type === 'convergent') { symbol = '▶◀'; color = 'rgba(255,100,100,0.95)'; }
      else if (b.type === 'transform') { symbol = '↔'; color = 'rgba(255,200,100,0.95)'; }

      ctx.fillStyle = color;
      ctx.font = '10px Space Mono';
      ctx.fillText(symbol, px - 6, py + 3);
    }

    drawLegend(ctx, 'Plate Boundaries', 'rgba(255,255,255,0.9)', [
      { symbol: '◀▶', color: 'rgba(100,255,100,0.9)', label: 'Divergent' },
      { symbol: '▶◀', color: 'rgba(255,100,100,0.9)', label: 'Convergent' },
      { symbol: '↔', color: 'rgba(255,200,100,0.9)', label: 'Transform' }
    ]);
  }
}