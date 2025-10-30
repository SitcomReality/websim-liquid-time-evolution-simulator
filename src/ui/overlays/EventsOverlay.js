export class EventsOverlay {
  constructor(delegate) {
    this.d = delegate;
  }

  render() {
    const backend = this.d.simulation.backend;
    const ev = backend?.eventManager;
    if (!ev) {
      this._drawMsg('Event manager unavailable');
      return;
    }

    const ctx = this.d.ctx;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(6, 6, 220, 120);

    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.font = '12px Space Mono';
    ctx.fillText('Event Predictions', 12, 24);

    const recent = ev.eventHistory.slice(-6);
    ctx.font = '10px Space Mono';
    let y = 42;
    if (recent.length === 0) {
      ctx.fillStyle = 'rgba(200,200,200,0.9)';
      ctx.fillText('No recent events', 12, y);
      y += 18;
    } else {
      for (const e of recent) {
        const emoji = this._getEventEmoji(e.type);
        ctx.fillStyle = 'rgba(200,200,200,0.95)';
        ctx.fillText(`${emoji} ${e.type} @ (${e.x ?? '?'} , ${e.y ?? '?'})`, 12, y);
        y += 16;
      }
    }

    for (const e of recent) {
      if (typeof e.x === 'number' && typeof e.y === 'number') {
        const px = e.x * (backend.cellSize || 32) * (this.d.canvas.width / this.d.worldRef.width);
        const py = e.y * (backend.cellSize || 32) * (this.d.canvas.height / this.d.worldRef.height);
        ctx.beginPath();
        ctx.fillStyle = this._getEventColor(e.type);
        ctx.arc(px, py, 6, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.font = '10px Space Mono';
        ctx.fillText(this._getEventEmoji(e.type), px - 4, py + 4);
      }
    }
  }

  _getEventEmoji(type) {
    const map = {
      volcanic_eruption: '🌋',
      supervolcano: '💥',
      asteroid_impact: '☄️',
      glacial_advance: '❄️',
      glacial_retreat: '🌊'
    };
    return map[type] || '⚠️';
  }

  _getEventColor(type) {
    const map = {
      volcanic_eruption: 'rgba(255,100,0,0.95)',
      supervolcano: 'rgba(255,0,0,0.95)',
      asteroid_impact: 'rgba(200,0,200,0.95)',
      glacial_advance: 'rgba(100,200,255,0.95)',
      glacial_retreat: 'rgba(100,150,255,0.95)'
    };
    return map[type] || 'rgba(255,255,255,0.95)';
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

