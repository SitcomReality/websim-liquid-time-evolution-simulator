export const PARTICLE_TYPES = {
    EMPTY: 0,
    SAND: 1,
    WATER: 2,
    GRANITE: 3,
    SOIL: 4,
    LAVA: 5,
    ICE: 6,
    STEAM: 7,
    PLANT: 8,
    ANIMAL: 9,
    BASALT: 10,
    MANTLE: 11,
    BEDROCK: 12,
    CLOUD: 13
};

export const PARTICLE_COLORS = {
    [PARTICLE_TYPES.EMPTY]: [0, 0, 0, 0],
    [PARTICLE_TYPES.SAND]: [194, 178, 128, 255],
    [PARTICLE_TYPES.WATER]: [64, 164, 223, 200],
    [PARTICLE_TYPES.GRANITE]: [130, 130, 130, 255],
    [PARTICLE_TYPES.SOIL]: [101, 67, 33, 255],
    [PARTICLE_TYPES.LAVA]: [255, 100, 0, 255],
    [PARTICLE_TYPES.ICE]: [200, 230, 255, 255],
    [PARTICLE_TYPES.STEAM]: [220, 220, 220, 150],
    [PARTICLE_TYPES.PLANT]: [34, 139, 34, 255],
    [PARTICLE_TYPES.ANIMAL]: [180, 100, 50, 255],
    [PARTICLE_TYPES.BASALT]: [50, 50, 55, 255],
    [PARTICLE_TYPES.MANTLE]: [80, 40, 30, 255],
    [PARTICLE_TYPES.BEDROCK]: [30, 30, 30, 255],
    [PARTICLE_TYPES.CLOUD]: [235, 235, 245, 180]
};

export const PARTICLE_PROPERTIES = {
    [PARTICLE_TYPES.SAND]: { density: 1.5, fluid: false, fallSpeed: 1 },
    [PARTICLE_TYPES.WATER]: { density: 1.0, fluid: true, fallSpeed: 2 },
    [PARTICLE_TYPES.GRANITE]: { density: 2.7, fluid: false, fallSpeed: 0 },
    [PARTICLE_TYPES.SOIL]: { density: 1.2, fluid: false, fallSpeed: 0.5 },
    [PARTICLE_TYPES.LAVA]: { density: 2.0, fluid: true, fallSpeed: 1 },
    [PARTICLE_TYPES.ICE]: { density: 0.9, fluid: false, fallSpeed: 0 },
    [PARTICLE_TYPES.STEAM]: { density: 0.1, fluid: true, fallSpeed: -1 },
    [PARTICLE_TYPES.PLANT]: { density: 0.8, fluid: false, fallSpeed: 0 },
    [PARTICLE_TYPES.ANIMAL]: { density: 1.0, fluid: false, fallSpeed: 0 },
    [PARTICLE_TYPES.BASALT]: { density: 3.0, fluid: false, fallSpeed: 0 },
    [PARTICLE_TYPES.MANTLE]: { density: 3.3, fluid: true, fallSpeed: 0.001 },
    [PARTICLE_TYPES.BEDROCK]: { density: 4.0, fluid: false, fallSpeed: 0 },
    [PARTICLE_TYPES.CLOUD]: { density: 0.05, fluid: true, fallSpeed: 0 }
};

// Temperature constants (in Celsius)
export const TEMPERATURE = {
    ABSOLUTE_ZERO: -273,
    ICE_POINT: 0,
    WATER_BOILING: 100,
    LAVA_SOLIDIFY: 800,
    GRANITE_MELTING: 1200,
    BASALT_MELTING: 1100,
    BEDROCK_MELTING: 4000,
    AMBIENT: 20
};

// Thermal properties for each particle type
export const THERMAL_PROPERTIES = {
    [PARTICLE_TYPES.EMPTY]: { conductivity: 0.024, heatCapacity: 1.0 }, // Air
    [PARTICLE_TYPES.SAND]: { conductivity: 0.25, heatCapacity: 0.8 },
    [PARTICLE_TYPES.WATER]: { conductivity: 0.6, heatCapacity: 4.2 },
    [PARTICLE_TYPES.GRANITE]: { conductivity: 2.5, heatCapacity: 0.9 },
    [PARTICLE_TYPES.SOIL]: { conductivity: 0.5, heatCapacity: 1.2 },
    [PARTICLE_TYPES.LAVA]: { conductivity: 4.0, heatCapacity: 1.0 },
    [PARTICLE_TYPES.ICE]: { conductivity: 2.2, heatCapacity: 2.1 },
    [PARTICLE_TYPES.STEAM]: { conductivity: 0.024, heatCapacity: 2.0 },
    [PARTICLE_TYPES.PLANT]: { conductivity: 0.4, heatCapacity: 3.0 },
    [PARTICLE_TYPES.ANIMAL]: { conductivity: 0.5, heatCapacity: 3.5 },
    [PARTICLE_TYPES.BASALT]: { conductivity: 1.8, heatCapacity: 0.85 },
    [PARTICLE_TYPES.MANTLE]: { conductivity: 3.0, heatCapacity: 1.1 },
    [PARTICLE_TYPES.BEDROCK]: { conductivity: 1.0, heatCapacity: 1.5 }
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