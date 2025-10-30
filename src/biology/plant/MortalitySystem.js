import { PARTICLE_TYPES } from '../../utils/Constants.js';

export class MortalitySystem {
  constructor(world) {
    this.world = world;
  }

  checkDeath(x, y, data) {
    const buriedAbove = this.world.getParticle(x, y - 1) !== PARTICLE_TYPES.EMPTY &&
                        this.world.getParticle(x, y - 1) !== PARTICLE_TYPES.PLANT;

    if (data.age > 2400 || (data.age > 1200 && buriedAbove)) {
      this.world.setParticle(x, y, PARTICLE_TYPES.SOIL);
      return true;
    }
    return false;
  }
}

