export const PARTICLE_TYPES = {
    EMPTY: 0,
    SAND: 1,
    WATER: 2,
    STONE: 3,
    SOIL: 4,
    LAVA: 5,
    ICE: 6,
    STEAM: 7,
    PLANT: 8,
    ANIMAL: 9
};

export const PARTICLE_COLORS = {
    [PARTICLE_TYPES.EMPTY]: [0, 0, 0, 0],
    [PARTICLE_TYPES.SAND]: [194, 178, 128, 255],
    [PARTICLE_TYPES.WATER]: [64, 164, 223, 200],
    [PARTICLE_TYPES.STONE]: [120, 120, 120, 255],
    [PARTICLE_TYPES.SOIL]: [101, 67, 33, 255],
    [PARTICLE_TYPES.LAVA]: [255, 100, 0, 255],
    [PARTICLE_TYPES.ICE]: [200, 230, 255, 255],
    [PARTICLE_TYPES.STEAM]: [220, 220, 220, 150],
    [PARTICLE_TYPES.PLANT]: [34, 139, 34, 255],
    [PARTICLE_TYPES.ANIMAL]: [180, 100, 50, 255]
};

export const PARTICLE_PROPERTIES = {
    [PARTICLE_TYPES.SAND]: { density: 1.5, fluid: false, fallSpeed: 1 },
    [PARTICLE_TYPES.WATER]: { density: 1.0, fluid: true, fallSpeed: 2 },
    [PARTICLE_TYPES.STONE]: { density: 2.5, fluid: false, fallSpeed: 0 },
    [PARTICLE_TYPES.SOIL]: { density: 1.2, fluid: false, fallSpeed: 0.5 },
    [PARTICLE_TYPES.LAVA]: { density: 2.0, fluid: true, fallSpeed: 1 },
    [PARTICLE_TYPES.ICE]: { density: 0.9, fluid: false, fallSpeed: 0 },
    [PARTICLE_TYPES.STEAM]: { density: 0.1, fluid: true, fallSpeed: -1 },
    [PARTICLE_TYPES.PLANT]: { density: 0.8, fluid: false, fallSpeed: 0 },
    [PARTICLE_TYPES.ANIMAL]: { density: 1.0, fluid: false, fallSpeed: 0 }
};

export const TIME_SCALES = {
    REAL_TIME: 1,
    HOURS: 10,
    DAYS: 50,
    MONTHS: 100,
    YEARS: 500,
    CENTURIES: 2000,
    MILLENNIA: 10000
};

