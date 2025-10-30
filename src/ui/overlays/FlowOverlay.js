export class FlowOverlay {
  constructor(delegate) {
    this.d = delegate;
  }

  render() {
    const backend = this.d.simulation.backend;
    if (!backend) {
      this._drawMsg('Backend unavailable');
      return;
    }
    const elev = backend.elevationField;
    if (!elev || !elev.flowDirX) {
      this._drawMsg('Flow data unavailable');
      return;
    }

    const ctx = this.d.ctx;
    const cw = this.d.cw, ch = this.d.ch;
    const cellSize = backend.cellSize || 16;
    const scaleX = cw / this.d.worldRef.width;
    const scaleY = ch / this.d.worldRef.height;

    ctx.strokeStyle = 'rgba(100,150,255,0.7)';
    ctx.lineWidth = 1;

    for (let y = 0; y < elev.height; y++) {
      for (let x = 0; x < elev.width; x++) {
        const idx = elev.getIndex(x, y);
        const vx = elev.flowDirX[idx] || 0;
        const vy = elev.flowDirY[idx] || 0;

        if (Math.abs(vx) < 0.001 && Math.abs(vy) < 0.001) continue;

        const px = (x * cellSize + cellSize / 2) * scaleX;
        const py = (y * cellSize + cellSize / 2) * scaleY;
        const len = Math.min(12, Math.hypot(vx, vy) * 12 + 4);

        ctx.beginPath();
        ctx.moveTo(px - vx * len, py - vy * len);
        ctx.lineTo(px + vx * len, py + vy * len);
        ctx.stroke();

        const ang = Math.atan2(vy, vx);
        ctx.beginPath();
        ctx.moveTo(px + vx * len, py + vy * len);
        ctx.lineTo(px + vx * len - Math.cos(ang - 0.4) * 4, py + vy * len - Math.sin(ang - 0.4) * 4);
        ctx.moveTo(px + vx * len, py + vy * len);
        ctx.lineTo(px + vx * len - Math.cos(ang + 0.4) * 4, py + vy * len - Math.sin(ang + 0.4) * 4);
        ctx.stroke();
      }
    }

    this.d._drawLegend('Flow Network', 'rgba(100,150,255,0.9)');
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

