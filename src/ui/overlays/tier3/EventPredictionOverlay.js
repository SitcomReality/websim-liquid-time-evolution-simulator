import { getEventEmoji, getEventColor } from './OverlayHelpers.js';

export class EventPredictionOverlay {
  constructor(coordinator) {
    this.coordinator = coordinator;
  }

  render() {
    const backend = this.coordinator.simulationRef.backend;
    const ev = backend?.eventManager;
    const ctx = this.coordinator.context;
    if (!ev) {
      this.coordinator._drawMessage('Event manager unavailable');
      return;
    }

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
        const emoji = getEventEmoji(e.type);
        ctx.fillStyle = 'rgba(200,200,200,0.95)';
        ctx.fillText(`${emoji} ${e.type} @ (${e.x ?? '?'} , ${e.y ?? '?'})`, 12, y);
        y += 16;
      }
    }

    for (const e of recent) {
      if (typeof e.x === 'number' && typeof e.y === 'number') {
        const px = e.x * (backend.cellSize || 32) * (this.coordinator.canvas.width / this.coordinator.worldRef.width);
        const py = e.y * (backend.cellSize || 32) * (this.coordinator.canvas.height / this.coordinator.worldRef.height);
        ctx.beginPath();
        ctx.fillStyle = getEventColor(e.type);
        ctx.arc(px, py, 6, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.font = '10px Space Mono';
        ctx.fillText(getEventEmoji(e.type), px - 4, py + 4);
      }
    }
  }
}