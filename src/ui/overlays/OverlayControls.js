export class OverlayControls {
  constructor(coordinator) {
    this.coordinator = coordinator;
    this._createDebugControl();
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
    select.addEventListener('change', (e) => this._onChange(e.target.value));
  }

  _onChange(value) {
    this.coordinator.setOverlayType(value);
  }

  destroy() {
    const panel = document.getElementById('debugOverlayPanel');
    if (panel && panel.parentElement) panel.parentElement.removeChild(panel);
  }
}

