export class StressOverlay {
  constructor(delegate) {
    this.d = delegate;
  }

  render() {
    const backend = this.d.simulation.backend;
    const ps = backend?.plateSystem;
    if (!ps || !ps.boundaries) {
      this._drawMsg('Plate/stress data unavailable');
      return;
    }

    const ctx = this.d.ctx;
    const cw = this.d.cw, ch = this.d.ch;
    const cellSize = backend.cellSize || 32;
    const scaleX = cw / this.d.worldRef.width;
    const scaleY = ch / this.d.worldRef.height;

    const image = ctx.createImageData(cw, ch);
    const data = image.data;

    for (let y = 0; y < ps.height; y++) {
      for (let x = 0; x < ps.width; x++) {
        let stress = 0;
        const idx = ps.getIndex(x, y);

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
            data[pix] = r;
            data[pix + 1] = g;
            data[pix + 2] = bcol;
            data[pix + 3] = alpha;
          }
        }
      }
    }

    ctx.putImageData(image, 0, 0);
    this.d._drawLegend('Stress Fields (hot=high)', 'rgba(255,0,0,0.9)');
  }

  _drawMsg(msg) {
    const ctx = this.d.ctx;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(6, 6, 260, 32);
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.font = '12px Space Mono';
    ctx.fillText(msg, 12, 28);
    ctx.restore();
  }
}

