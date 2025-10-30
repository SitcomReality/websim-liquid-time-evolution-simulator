export class SimulationPanel {
  constructor(simulation, canvas) {
    this.simulation = simulation;
    this.canvas = canvas;
    this.setup();
  }

  setup() {
    this.setupPlayPause();
    this.setupFidelity();
    this.setupOverlays();
  }

  setupPlayPause() {
    const playPauseBtn = document.getElementById('playPause');
    if (playPauseBtn) {
      playPauseBtn.addEventListener('click', () => {
        const running = this.simulation.togglePause();
        playPauseBtn.textContent = running ? '⏸️ Pause' : '▶️ Play';
      });
    }
  }

  setupFidelity() {
    const fidelitySlider = document.getElementById('fidelity');
    const fidelityValue = document.getElementById('fidelityValue');

    if (fidelitySlider) {
      fidelitySlider.addEventListener('input', (e) => {
        const value = parseInt(e.target.value, 10);
        this.simulation.setFidelity(value / 100);

        if (fidelityValue) {
          fidelityValue.textContent = `${value}%`;
        }
      });
    }
  }

  setupOverlays() {
    const tempBtn = document.getElementById('tempOverlay');
    const pressBtn = document.getElementById('pressOverlay');
    const windBtn = document.getElementById('windOverlay');

    if (tempBtn) {
      tempBtn.addEventListener('click', () => {
        this.canvas.toggleTemperatureOverlay();
        this.updateOverlayButtons(tempBtn, pressBtn, windBtn);
      });
    }

    if (pressBtn) {
      pressBtn.addEventListener('click', () => {
        this.canvas.togglePressureOverlay();
        this.updateOverlayButtons(pressBtn, tempBtn, windBtn);
      });
    }

    if (windBtn) {
      windBtn.addEventListener('click', () => {
        this.canvas.toggleWindOverlay();
        this.updateOverlayButtons(windBtn, tempBtn, pressBtn);
      });
    }
  }

  updateOverlayButtons(active, ...others) {
    if (active) active.classList.add('active');
    for (const btn of others) {
      if (btn) btn.classList.remove('active');
    }
  }
}

