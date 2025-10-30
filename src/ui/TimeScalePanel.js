/**
 * TimeScalePanel
 * Manages time scale slider, tier marker visualization, and systems info display.
 */
export class TimeScalePanel {
  constructor(simulation) {
    this.simulation = simulation;
    this.setup();
  }

  setup() {
    this.setupTimeScaleSlider();
    this.setupTierMarkers();
    this.setupSystemsInfo();
  }

  setupTimeScaleSlider() {
    const timeScaleSlider = document.getElementById('timeScale');
    const timeScaleValue = document.getElementById('timeScaleValue');

    if (timeScaleSlider) {
      timeScaleSlider.addEventListener('input', (e) => {
        const value = parseFloat(e.target.value);
        // Map slider value (0..100) into an exponential scale for wide ranges
        const exponent = value * 0.24;
        const scale = Math.pow(2, exponent);
        this.simulation.setTimeScale(scale);

        if (timeScaleValue) {
          timeScaleValue.textContent = `${scale.toFixed(1)}x`;
        }

        // Update tier markers indicator
        const canvas = document.getElementById('tierMarkersCanvas');
        if (canvas) {
          this.updateSliderIndicator(canvas);
        }
      });
    }
  }

  setupTierMarkers() {
    const timeScaleSlider = document.getElementById('timeScale');
    if (!timeScaleSlider) return;

    const container = timeScaleSlider.parentElement;

    // Add tier markers canvas if missing
    let canvas = document.getElementById('tierMarkersCanvas');
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.id = 'tierMarkersCanvas';
      canvas.className = 'tier-markers';
      canvas.width = Math.max(300, container.clientWidth - 20);
      canvas.height = 30;
      container.insertBefore(canvas, timeScaleSlider);
    }

    this.redrawTierMarkers();
    // Keep canvas sized to container on resize
    window.addEventListener('resize', () => {
      const canvasEl = document.getElementById('tierMarkersCanvas');
      if (!canvasEl) return;
      canvasEl.width = Math.max(300, container.clientWidth - 20);
      this.redrawTierMarkers();
    });
  }

  setupSystemsInfo() {
    const timeScaleSlider = document.getElementById('timeScale');
    if (!timeScaleSlider) return;

    const container = timeScaleSlider.parentElement;

    // Add systems info panel if missing
    let systemsInfo = document.getElementById('systemsInfo');
    if (!systemsInfo) {
      systemsInfo = document.createElement('div');
      systemsInfo.id = 'systemsInfo';
      systemsInfo.className = 'systems-info';
      container.appendChild(systemsInfo);
    }

    // Update systems info periodically
    this.updateSystemsInfo();
    this._systemsInfoInterval = setInterval(() => this.updateSystemsInfo(), 500);
  }

  redrawTierMarkers() {
    const canvas = document.getElementById('tierMarkersCanvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    // Clear
    ctx.clearRect(0, 0, width, height);

    this.drawStaticMarkers(ctx, width, height);
    this.updateSliderIndicator(canvas);
  }

  drawStaticMarkers(ctx, width, height) {
    const LOG_MIN = Math.log2(1);
    const LOG_MAX = Math.log2(10000000);

    // Background
    ctx.fillStyle = 'rgba(0,0,0,0.08)';
    ctx.fillRect(0, 0, width, height);

    // Tier boundaries and labels
    const tiers = [
      { name: 'T1', scale: 100 },
      { name: 'T2', scale: 100000 }
    ];

    ctx.strokeStyle = '#666';
    ctx.lineWidth = 1;
    ctx.fillStyle = '#999';
    ctx.font = '10px Space Mono';
    ctx.textAlign = 'center';

    for (const tier of tiers) {
      const logScale = Math.log2(tier.scale);
      const normalized = (logScale - LOG_MIN) / (LOG_MAX - LOG_MIN);
      const x = Math.max(0, Math.min(width, normalized * width));

      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height - 10);
      ctx.stroke();
      ctx.fillText(tier.name, x, height - 2);
    }

    // Mark T3 start explicitly
    const t3StartLog = Math.log2(1000000);
    const t3StartNormalized = (t3StartLog - LOG_MIN) / (LOG_MAX - LOG_MIN);
    const x3 = Math.max(0, Math.min(width, t3StartNormalized * width));

    ctx.strokeStyle = '#0f62fe';
    ctx.fillStyle = '#0f62fe';
    ctx.beginPath();
    ctx.moveTo(x3, 0);
    ctx.lineTo(x3, height - 10);
    ctx.stroke();
    ctx.fillText('T3', x3, height - 2);
  }

  updateSliderIndicator(canvas) {
    const scale = this.simulation.timeScale;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    // Redraw static markers first (clears indicator)
    this.drawStaticMarkers(ctx, width, height);

    // Normalize scale to 0..1 (logarithmic)
    const logMin = Math.log2(1);
    const logMax = Math.log2(10000000);
    const logScale = Math.log2(Math.max(1, scale));
    const normalized = (logScale - logMin) / (logMax - logMin);
    const x = Math.max(0, Math.min(width, normalized * width));

    // Draw indicator
    ctx.fillStyle = '#0f62fe';
    ctx.beginPath();
    ctx.arc(x, height / 2, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  updateSystemsInfo() {
    const systemsInfo = document.getElementById('systemsInfo');
    if (!systemsInfo) return;

    const scale = this.simulation.timeScale;

    // Calculate an approximate "years per frame" display
    // Assumes base frame corresponds to 16ms; this is an indicative number for UI only.
    const actualSpeedYears = (scale / 365) * 0.016;

    let systemsHtml = `
      <div class="system-row">
        <span class="label">Speed:</span>
        <span class="value">${scale.toFixed(0)}x (~${actualSpeedYears.toExponential(1)} years/frame)</span>
      </div>
    `;

    // Show active systems based on tier
    const activeSystems = this.getActiveSystemsForScale(scale);
    systemsHtml += `
      <div class="system-row">
        <span class="label">Active:</span>
        <span class="value">${activeSystems.join(', ')}</span>
      </div>
    `;

    systemsInfo.innerHTML = systemsHtml;
  }

  getActiveSystemsForScale(scale) {
    const systems = [];

    if (scale <= 1000) {
      systems.push('Particles', 'Fluids', 'Thermal', 'Airflow', 'Biology');
    }
    if (scale >= 1000) {
      systems.push('Erosion', 'Climate', 'Landforms');
    }
    if (scale >= 1000000) {
      systems.push('Plates', 'Tectonics', 'Events');
    }

    return systems;
  }
}