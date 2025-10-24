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
    [PARTICLE_TYPES.EMPTY]: [26, 11, 46, 255],
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

// Fluid properties: density, viscosity, flowRate (how quickly it spreads), isLiving
export const PARTICLE_PROPERTIES = {
    [PARTICLE_TYPES.EMPTY]: { density: 0.0, viscosity: 0.0, flowRate: 1.0, isLiving: false },
    [PARTICLE_TYPES.STEAM]: { density: 0.1, viscosity: 0.01, flowRate: 0.9, isLiving: false },
    [PARTICLE_TYPES.CLOUD]: { density: 0.15, viscosity: 0.05, flowRate: 0.8, isLiving: false },
    [PARTICLE_TYPES.WATER]: { density: 1.0, viscosity: 0.02, flowRate: 0.9, isLiving: false },
    [PARTICLE_TYPES.ICE]: { density: 0.92, viscosity: 0.7, flowRate: 0.05, isLiving: false },
    [PARTICLE_TYPES.SOIL]: { density: 1.3, viscosity: 2.0, flowRate: 0.1, isLiving: false },
    [PARTICLE_TYPES.SAND]: { density: 1.5, viscosity: 1.5, flowRate: 0.2, isLiving: false },
    [PARTICLE_TYPES.LAVA]: { density: 2.0, viscosity: 12.0, flowRate: 0.2, isLiving: false },
    [PARTICLE_TYPES.BASALT]: { density: 3.0, viscosity: 15.0, flowRate: 0.08, isLiving: false },
    [PARTICLE_TYPES.GRANITE]: { density: 2.7, viscosity: 18.0, flowRate: 0.06, isLiving: false },
    [PARTICLE_TYPES.MANTLE]: { density: 3.3, viscosity: 20.0, flowRate: 0.04, isLiving: false },
    [PARTICLE_TYPES.BEDROCK]: { density: 4.0, viscosity: 30.0, flowRate: 0.02, isLiving: false },
    [PARTICLE_TYPES.PLANT]: { density: 1.1, viscosity: 100.0, flowRate: 0.0, isLiving: true },
    [PARTICLE_TYPES.ANIMAL]: { density: 1.0, viscosity: 100.0, flowRate: 0.0, isLiving: true }
};

// Temperature constants (in Celsius)
export const TEMPERATURE = {
    ABSOLUTE_ZERO: -273,
    ICE_POINT: 0,
    WATER_BOILING: 100,
    LAVA_SOLIDIFY: 500,         // Raised: lava needs sustained heat to avoid solidifying
    GRANITE_MELTING: 1000,       // Raised: harder to melt; mitigates runaway melting
    BASALT_MELTING: 950,        // Raised and paired with low-pressure requirement
    BASALT_METAMORPHISM: 600,
    SOIL_LITHIFICATION: 400,
    SAND_LITHIFICATION: 500,
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