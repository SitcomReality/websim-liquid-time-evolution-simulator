import { PARTICLE_TYPES } from '../../utils/Constants.js';

const MATERIAL_KEYS = {
  [PARTICLE_TYPES.SAND]: 'sand',
  [PARTICLE_TYPES.SOIL]: 'soil',
  [PARTICLE_TYPES.GRANITE]: 'granite',
  [PARTICLE_TYPES.BASALT]: 'basalt'
};

function keyForType(typeOrKey) {
  if (typeof typeOrKey === 'string') return typeOrKey;
  return MATERIAL_KEYS[typeOrKey] || 'soil';
}

export class MaterialField {
  constructor(width, height, cellSize = 16) {
    this.width = width;
    this.height = height;
    this.cellSize = cellSize;
    this.size = width * height;

    this.mass = new Float32Array(this.size);      // total mass per cell (arbitrary units)
    this.stability = new Float32Array(this.size); // 0..1 consolidated factor

    // Composition fractions per cell (stored as mass contributions, not normalized)
    this.sand = new Float32Array(this.size);
    this.soil = new Float32Array(this.size);
    this.granite = new Float32Array(this.size);
    this.basalt = new Float32Array(this.size);

    this.reset();
  }

  reset() {
    this.mass.fill(0);
    this.stability.fill(0.5);
    this.sand.fill(0);
    this.soil.fill(0);
    this.granite.fill(0);
    this.basalt.fill(0);
  }

  getIndex(x, y) {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return -1;
    return y * this.width + x;
  }

  addMaterial(x, y, type, amount) {
    const idx = this.getIndex(x, y);
    if (idx < 0 || amount <= 0) return;
    const key = keyForType(type);
    this[key][idx] += amount;
    this.mass[idx] += amount;
    // Stability increases slightly with consolidated (granite/basalt) additions
    if (key === 'granite' || key === 'basalt') this.stability[idx] = Math.min(1, this.stability[idx] + amount * 0.0005);
  }

  removeMaterial(x, y, type, amount) {
    const idx = this.getIndex(x, y);
    if (idx < 0 || amount <= 0) return;
    const key = keyForType(type);
    const removed = Math.min(this[key][idx], amount);
    this[key][idx] -= removed;
    this.mass[idx] = Math.max(0, this.mass[idx] - removed);
    // Erosion lowers stability a bit
    this.stability[idx] = Math.max(0, this.stability[idx] - removed * 0.0003);
  }

  getMaterialRatio(x, y, type) {
    const idx = this.getIndex(x, y);
    if (idx < 0) return 0;
    const total = this.mass[idx] || 0;
    if (total <= 0) return 0;
    const key = keyForType(type);
    return this[key][idx] / total;
  }

  getDominantType(x, y) {
    const idx = this.getIndex(x, y);
    if (idx < 0) return PARTICLE_TYPES.SOIL;
    const s = this.sand[idx], so = this.soil[idx], g = this.granite[idx], b = this.basalt[idx];
    let maxVal = s, key = 'sand';
    if (so > maxVal) { maxVal = so; key = 'soil'; }
    if (g > maxVal) { maxVal = g; key = 'granite'; }
    if (b > maxVal) { maxVal = b; key = 'basalt'; }
    // Map back to PARTICLE_TYPES for convenience
    switch (key) {
      case 'sand': return PARTICLE_TYPES.SAND;
      case 'soil': return PARTICLE_TYPES.SOIL;
      case 'granite': return PARTICLE_TYPES.GRANITE;
      case 'basalt': return PARTICLE_TYPES.BASALT;
      default: return PARTICLE_TYPES.SOIL;
    }
  }
}