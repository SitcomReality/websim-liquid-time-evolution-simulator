/** 
 * TierPanel
 * Manages tier display, override functionality, and tier-specific information.
 */ 
export class TierPanel {
  constructor(simulation) {
    this.simulation = simulation;
    this.setup();
  }

  setup() {
    // Create tier display panel if it doesn't exist
    const tierDisplay = document.getElementById('tierDisplay');
    if (!tierDisplay) {
      this.createTierPanel();
    }

    // Setup override button
    const tierOverrideBtn = document.getElementById('tierOverride');
    const tierSelect = document.getElementById('tierSelect');

    if (tierOverrideBtn && tierSelect) {
      tierOverrideBtn.addEventListener('click', () => {
        tierSelect.classList.toggle('hidden');
        tierOverrideBtn.classList.toggle('active');
      });

      tierSelect.addEventListener('change', (e) => this.onTierOverride(e));
    }

    // Start update loop
    this.startUpdateLoop();
  }

  createTierPanel() {
    const controlsDiv = document.getElementById('controls');
    if (!controlsDiv) return;

    const tierPanel = document.createElement('div');
    tierPanel.id = 'tierDisplay';
    tierPanel.className = 'tier-panel';
    tierPanel.innerHTML = `
      <div class="tier-info">
        <div class="tier-header">Simulation Tier</div>
        <div id="tierName" class="tier-name">Tier 1: Human Scale</div>
        <div id="tierDesc" class="tier-desc">Particle-based physics</div>
        <div id="tierStats" class="tier-stats"></div>
      </div>
      <div class="tier-controls">
        <button id="tierOverride" class="tier-override-btn" title="Force specific tier">Override</button>
        <select id="tierSelect" class="tier-select hidden">
          <option value="auto">Auto (recommended)</option>
          <option value="tier1">Tier 1: Human Scale</option>
          <option value="tier2">Tier 2: Geological</option>
          <option value="tier3">Tier 3: Tectonic</option>
        </select>
      </div>
    `;
    controlsDiv.insertBefore(tierPanel, controlsDiv.firstChild);
  }

  onTierOverride(e) {
    const value = e.target.value;
    const tierSelect = document.getElementById('tierSelect');
    const tierOverrideBtn = document.getElementById('tierOverride');

    if (value !== 'auto') {
      const scaleMap = { tier1: 10, tier2: 5000, tier3: 1000000 };
      const scale = scaleMap[value];

      const timeScaleSlider = document.getElementById('timeScale');
      if (timeScaleSlider) {
        timeScaleSlider.value = Math.log2(scale) * 10 / 0.24;
        this.simulation.setTimeScale(scale);
      }
    } else {
      tierSelect.classList.add('hidden');
      tierOverrideBtn.classList.remove('active');
    }
  }

  startUpdateLoop() {
    setInterval(() => this.updateTierInfo(), 500);
  }

  updateTierInfo() {
    const tierName = document.getElementById('tierName');
    const tierDesc = document.getElementById('tierDesc');
    const tierStats = document.getElementById('tierStats');

    if (!tierName) return;

    const transitionStatus = this.simulation.getTransitionStatus?.();
    const currentTier = this.simulation.tierManager?.activeTier;
    const isTransitioning = transitionStatus?.state !== 'idle';

    if (!currentTier) return;

    // Update tier name
    tierName.textContent = currentTier.name;
    tierName.classList.toggle('transitioning', isTransitioning);

    // Update description
    const descriptions = {
      'HUMAN_SCALE': 'Particle-based physics at 1-100x speed',
      'GEOLOGICAL_SCALE': 'Field-based erosion & material flow',
      'TECTONIC_SCALE': 'Plate tectonics & global events'
    };
    tierDesc.textContent = descriptions[currentTier.key] || 'Unknown tier';

    // Update stats display
    let statsHtml = '';

    if (currentTier.key === 'HUMAN_SCALE') {
      statsHtml = `
        <div class="stat">Active Systems: Particles, Fluids, Thermal, Plants</div>
        <div class="stat">Resolution: 1px per particle</div>
      `;
    } else if (currentTier.key === 'GEOLOGICAL_SCALE') {
      statsHtml = `
        <div class="stat">Active Systems: Erosion, Climate, Landforms</div>
        <div class="stat">Resolution: 16px per cell</div>
      `;
    } else if (currentTier.key === 'TECTONIC_SCALE') {
      statsHtml = `
        <div class="stat">Active Systems: Plates, Events, Glaciation</div>
        <div class="stat">Resolution: 32px per cell</div>
      `;
    }

    if (isTransitioning) {
      statsHtml += `<div class="stat transitioning">⟳ Transitioning...</div>`;
    }

    tierStats.innerHTML = statsHtml;
  }
}