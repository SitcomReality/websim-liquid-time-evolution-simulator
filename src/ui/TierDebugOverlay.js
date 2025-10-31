/**
 * TierDebugOverlay
 * Provides debug visualizations for each simulation tier:
 *  - Tier 2: flow networks, erosion rates, material composition
 *  - Tier 3: plate boundaries, stress fields, event predictions
 *
 * Usage: new TierDebugOverlay(canvasWrapper, world, simulation)
 *   canvasWrapper: the Canvas instance (has .canvas HTMLElement and sizing)
 *   world: World instance
 *   simulation: Simulation instance
 */
export class TierDebugOverlay {
  constructor(canvasWrapper, world, simulation) {
    this.canvasWrapper = canvasWrapper;
    this.world = world;
    this.simulation = simulation;

    this.overlayCanvas = null;
    this.overlayCtx = null;
    this.overlayType = 'none'; // 'none' | 'flow' | 'erosion' | 'material' | 'plates' | 'stress' | 'events'

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

    // Controls in the main UI
    this._createDebugControl();

    // Keep size in sync
    window.addEventListener('resize', this._resizeHandler);
    this._resizeOverlay();
  }

  destroy() {
    window.removeEventListener('resize', this._resizeHandler);
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

  _createDebugControl() {
    const controlsDiv = document.getElementById('controls');
    if (!controlsDiv) return;

    if (document.getElementById('debugOverlayPanel')) return;

    const panel = document.createElement('div');
    panel.id = 'debugOverlayPanel';
    panel.className = 'control-group';
    panel.innerHTML = `
      <label>Debug Overlay</label>
      <select id="debugOverlaySelect">
        <option value="none">None</option>
        <option value="flow">Flow Network (T2)</option>
        <option value="erosion">Erosion Rate (T2)</option>
        <option value="material">Material Mix (T2)</option>
        <option value="plates">Plate Boundaries (T3)</option>
        <option value="stress">Stress Fields (T3)</option>
        <option value="events">Event Predictions (T3)</option>
      </select>
    `;
    controlsDiv.appendChild(panel);

    const select = panel.querySelector('#debugOverlaySelect');
    select.addEventListener('change', (e) => this.setOverlayType(e.target.value));
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
      this._renderTier2();
    } else if (tier.key === 'TECTONIC_SCALE') {
      this._renderTier3();
    } else {
      // For Tier 1, nothing special beyond existing overlays
      this._drawMessage('Tier 1: use particle-level debug tools');
    }
  }

  // ---------------- TIER 2 ----------------
  _renderTier2() {
    const backend = this.simulation.backend;
    if (!backend) return;

    switch (this.overlayType) {
      case 'flow':
        this._renderFlowNetwork(backend);
        break;
      case 'erosion':
        this._renderErosionRates(backend);
        break;
      case 'material':
        this._renderMaterialComposition(backend);
        break;
      default:
        break;
    }
  }

  _renderFlowNetwork(backend) {
    const elev = backend.elevationField;
    if (!elev || !elev.flowDirX) {
      this._drawMessage('Flow data unavailable');
      return;
    }

    const ctx = this.overlayCtx;
    const cw = this.overlayCanvas.width, ch = this.overlayCanvas.height;
    const cellSize = backend.cellSize || 16;
    const scaleX = cw / this.world.width;
    const scaleY = ch / this.world.height;

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

        // arrowhead
        const ang = Math.atan2(vy, vx);
        ctx.beginPath();
        ctx.moveTo(px + vx * len, py + vy * len);
        ctx.lineTo(px + vx * len - Math.cos(ang - 0.4) * 4, py + vy * len - Math.sin(ang - 0.4) * 4);
        ctx.moveTo(px + vx * len, py + vy * len);
        ctx.lineTo(px + vx * len - Math.cos(ang + 0.4) * 4, py + vy * len - Math.sin(ang + 0.4) * 4);
        ctx.stroke();
      }
    }

    this._drawLegend('Flow Network', 'rgba(100,150,255,0.9)');
  }

  _renderErosionRates(backend) {
    if (!backend.erosion || typeof backend.erosion.update !== 'function') {
      this._drawMessage('Erosion calculator unavailable');
      return;
    }

    // Request a computed erosion map (note: this may be synchronous or lightweight)
    const erosionMap = backend.erosion.update(0) || new Float32Array(backend.elevationField.size);

    const ctx = this.overlayCtx;
    const cw = this.overlayCanvas.width, ch = this.overlayCanvas.height;
    const image = ctx.createImageData(cw, ch);
    const data = image.data;
    const cellSize = backend.cellSize || 16;
    const scaleX = cw / this.world.width;
    const scaleY = ch / this.world.height;

    for (let y = 0; y < backend.elevationField.height; y++) {
      for (let x = 0; x < backend.elevationField.width; x++) {
        const idx = backend.elevationField.getIndex(x, y);
        const rate = Math.min(1, (erosionMap[idx] || 0) * 100);

        const r = Math.floor(rate * 255);
        const g = 0;
        const b = Math.floor((1 - rate) * 200);
        const alpha = 200;

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
            data[pix + 2] = b;
            data[pix + 3] = alpha;
          }
        }
      }
    }

    ctx.putImageData(image, 0, 0);
    this._drawLegend('Erosion Rate (red=high)', 'rgba(255,0,0,0.9)');
  }

  _renderMaterialComposition(backend) {
    const mat = backend.materialField;
    if (!mat) {
      this._drawMessage('Material field unavailable');
      return;
    }

    const ctx = this.overlayCtx;
    const cw = this.overlayCanvas.width, ch = this.overlayCanvas.height;
    const image = ctx.createImageData(cw, ch);
    const data = image.data;
    const cellSize = backend.cellSize || 16;
    const scaleX = cw / this.world.width;
    const scaleY = ch / this.world.height;

    const colors = {
      granite: [200, 200, 200, 255],
      basalt: [80, 80, 100, 255],
      sand: [220, 200, 120, 255],
      soil: [140, 100, 60, 255],
    };

    for (let y = 0; y < mat.height; y++) {
      for (let x = 0; x < mat.width; x++) {
        const idx = mat.getIndex(x, y);
        const s = mat.sand[idx] || 0;
        const so = mat.soil[idx] || 0;
        const g = mat.granite[idx] || 0;
        const b = mat.basalt[idx] || 0;

        let dominant = 'soil';
        let val = so;
        if (s > val) { dominant = 'sand'; val = s; }
        if (g > val) { dominant = 'granite'; val = g; }
        if (b > val) { dominant = 'basalt'; val = b; }

        const col = colors[dominant] || [128, 128, 128, 255];

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
            data[pix] = col[0];
            data[pix + 1] = col[1];
            data[pix + 2] = col[2];
            data[pix + 3] = col[3];
          }
        }
      }
    }

    ctx.putImageData(image, 0, 0);
    this._drawLegend('Material Composition', 'rgba(255,255,255,0.9)', [
      { color: colors.granite, label: 'Granite' },
      { color: colors.basalt, label: 'Basalt' },
      { color: colors.sand, label: 'Sand' },
      { color: colors.soil, label: 'Soil' }
    ]);
  }

  // ---------------- TIER 3 ----------------
  _renderTier3() {
    const backend = this.simulation.backend;
    if (!backend) return;

    switch (this.overlayType) {
      case 'plates':
        this._renderPlateBoundaries(backend);
        break;
      case 'stress':
        this._renderStressFields(backend);
        break;
      case 'events':
        this._renderEventPredictions(backend);
        break;
      default:
        break;
    }
  }

  _renderPlateBoundaries(backend) {
    const ps = backend.plateSystem;
    if (!ps || !ps.plateIdField) {
      this._drawMessage('Plate system unavailable');
      return;
    }

    const ctx = this.overlayCtx;
    const cw = this.overlayCanvas.width, ch = this.overlayCanvas.height;
    const cellSize = backend.cellSize || 32;
    const scaleX = cw / this.world.width;
    const scaleY = ch / this.world.height;

    // Fill plates with semi-transparent colors
    const plateCount = ps.plates.length;
    const hues = new Array(plateCount).fill(0).map((_, i) => (i / Math.max(1, plateCount)) * 360);

    const image = ctx.createImageData(cw, ch);
    const data = image.data;

    for (let y = 0; y < ps.height; y++) {
      for (let x = 0; x < ps.width; x++) {
        const idx = ps.getIndex(x, y);
        const pid = ps.plateIdField[idx] || 0;
        const hue = hues[pid] || 0;
        const rgb = this._hslToRgb(hue / 360, 0.5, 0.5);

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

    // Draw boundaries
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 1.5;

    for (const b of ps.boundaries || []) {
      const px = (b.x * cellSize + cellSize / 2) * scaleX;
      const py = (b.y * cellSize + cellSize / 2) * scaleY;
      ctx.beginPath();
      ctx.arc(px, py, 4, 0, Math.PI * 2);
      ctx.stroke();

      // symbol for type
      let symbol = '—';
      let color = 'rgba(255,255,255,0.9)';
      if (b.type === 'divergent') { symbol = '◀▶'; color = 'rgba(100,255,100,0.95)'; }
      else if (b.type === 'convergent') { symbol = '▶◀'; color = 'rgba(255,100,100,0.95)'; }
      else if (b.type === 'transform') { symbol = '↔'; color = 'rgba(255,200,100,0.95)'; }

      ctx.fillStyle = color;
      ctx.font = '10px Space Mono';
      ctx.fillText(symbol, px - 6, py + 3);
    }

    this._drawLegend('Plate Boundaries', 'rgba(255,255,255,0.9)', [
      { symbol: '◀▶', color: 'rgba(100,255,100,0.9)', label: 'Divergent' },
      { symbol: '▶◀', color: 'rgba(255,100,100,0.9)', label: 'Convergent' },
      { symbol: '↔', color: 'rgba(255,200,100,0.9)', label: 'Transform' }
    ]);
  }

  _renderStressFields(backend) {
    const ps = backend.plateSystem;
    if (!ps || !ps.boundaries) {
      this._drawMessage('Plate/stress data unavailable');
      return;
    }

    const ctx = this.overlayCtx;
    const cw = this.overlayCanvas.width, ch = this.overlayCanvas.height;
    const cellSize = backend.cellSize || 32;
    const scaleX = cw / this.world.width;
    const scaleY = ch / this.world.height;

    const image = ctx.createImageData(cw, ch);
    const data = image.data;

    // Compute stress per plate-cell based on proximity to boundaries
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
    this._drawLegend('Stress Fields (hot=high)', 'rgba(255,0,0,0.9)');
  }

  _renderEventPredictions(backend) {
    const ev = backend.eventManager;
    if (!ev) {
      this._drawMessage('Event manager unavailable');
      return;
    }

    const ctx = this.overlayCtx;
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

    // Also draw event markers on map for events with coordinates
    for (const e of recent) {
      if (typeof e.x === 'number' && typeof e.y === 'number') {
        const px = e.x * (backend.cellSize || 32) * (this.overlayCanvas.width / this.world.width);
        const py = e.y * (backend.cellSize || 32) * (this.overlayCanvas.height / this.world.height);
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

  // ---------------- Helpers ----------------
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

  _drawLegend(title, titleColor = 'rgba(255,255,255,0.9)', items = null) {
    const ctx = this.overlayCtx;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(8, 8, 180, items ? (items.length * 16 + 34) : 40);
    ctx.fillStyle = titleColor;
    ctx.font = '12px Space Mono';
    ctx.fillText(title, 12, 26);

    if (items && Array.isArray(items)) {
      ctx.font = '10px Space Mono';
      let y = 44;
      for (const it of items) {
        if (it.color) {
          const c = it.color;
          ctx.fillStyle = Array.isArray(c) ? `rgba(${c[0]},${c[1]},${c[2]},${(c[3]||255)/255})` : c;
          ctx.fillText('■', 12, y);
          ctx.fillStyle = 'rgba(255,255,255,0.9)';
          ctx.fillText(it.label, 28, y);
        } else {
          ctx.fillStyle = it.color || 'rgba(255,255,255,0.9)';
          ctx.fillText(`${it.symbol || ''} ${it.label}`, 12, y);
        }
        y += 16;
      }
    }

    ctx.restore();
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

  _hslToRgb(h, s, l) {
    let r, g, b;
    if (s === 0) { r = g = b = l; }
    else {
      const hue2rgb = (p, q, t) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1/6) return p + (q - p) * 6 * t;
        if (t < 1/2) return q;
        if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
        return p;
      };
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = hue2rgb(p, q, h + 1/3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1/3);
    }
    return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) };
  }
}