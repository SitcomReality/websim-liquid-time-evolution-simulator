import { drawLegend } from './OverlayHelpers.js';

export class StressFieldOverlay {
  constructor(coordinator) {
    this.coordinator = coordinator;
  }

  render() {
    const backend = this.coordinator.simulationRef.backend;
    const ps = backend?.plateSystem;
    const ctx = this.coordinator.context;
    if (!ps || !ps.boundaries) {
      this.coordinator._drawMessage('Plate/stress data unavailable');
      return;
    }

    const cw = this.coordinator.canvas.width;
    const ch = this.coordinator.canvas.height;
    const cellSize = backend.cellSize || 32;

    const image = ctx.createImageData(cw, ch);
    const data = image.data;

    for (let y = 0; y < ps.height; y++) {
      for (let x = 0; x < ps.width; x++) {
        let stress = 0;
        for (const b of ps.boundaries) {
          const dx = x - b.x;
          const dy = y - b.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          stress += Math.exp(-dist * 0.3) * (b.strength || 1);
        }

        const normalized = Math.min(1, stress / 2.0);
        const r = Math.floor(normalized * 255);
        const g = Math.floor((1 - normalized) * 100);
        const bcol = Math.floor((1 - normalized) * 200);
        const alpha = 150;

        const px = Math.floor(x * cellSize * (cw / this.coordinator.worldRef.width));
        const py = Math.floor(y * cellSize * (ch / this.coordinator.worldRef.height));
        const pw = Math.ceil(cellSize * (cw / this.coordinator.worldRef.width));
        const ph = Math.ceil(cellSize * (ch / this.coordinator.worldRef.height));

        for (let yy = 0; yy < ph; yy++) {
          for (let xx = 0; xx < pw; xx++) {
            const sx = px + xx;
            const sy = py + yy;
            if (sx < 0 || sx >= cw || sy < 0 || sy >= ch) continue;
            const pix = (sy * cw + sx) * 4;
            data[pix] = r;
            data[pix + 1] = g;
            data[pix + 2] = bcol;
            data[pix + 3] = alpha;
          }
        }
      }
    }

    ctx.putImageData(image, 0, 0);
    drawLegend(ctx, 'Stress Fields (hot=high)', 'rgba(255,0,0,0.9)');
  }
}