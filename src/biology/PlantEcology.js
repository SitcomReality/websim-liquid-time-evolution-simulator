export const PLANT_VARIANTS = {
    DEFAULT: 0, MOSS: 1, SEAWEED: 2, CACTUS: 3, LICHEN: 4, CORAL: 5, FLOWER_PINK: 6, FLOWER_YELLOW: 7
};

export function getPlantColor(code) {
    switch (code) {
        case PLANT_VARIANTS.MOSS: return [46, 102, 60, 255];
        case PLANT_VARIANTS.SEAWEED: return [30, 180, 150, 255];
        case PLANT_VARIANTS.CACTUS: return [24, 120, 58, 255];
        case PLANT_VARIANTS.LICHEN: return [170, 190, 140, 255];
        case PLANT_VARIANTS.CORAL: return [235, 94, 73, 255];
        case PLANT_VARIANTS.FLOWER_PINK: return [255, 110, 190, 255];
        case PLANT_VARIANTS.FLOWER_YELLOW: return [255, 205, 60, 255];
        default: return [34, 139, 34, 255];
    }
}

export function classifyEnvironment(world, x, y) {
    const t = world.getTemperature(x, y);
    const p = world.getParticle(x, y);
    const up = world.getParticle(x, y - 1);
    const down = world.getParticle(x, y + 1);
    const left = world.getParticle(x - 1, y);
    const right = world.getParticle(x + 1, y);
    const waterNeighbors = [up, down, left, right].filter(v => v === 2).length;
    const rockNeighbors = [up, down, left, right].filter(v => v === 3 || v === 10 || v === 11).length;
    const sandNeighbors = [up, down, left, right].filter(v => v === 1).length;
    const emptyAbove = up === 0;
    const fertile = (waterNeighbors >= 1 && emptyAbove && t > 5 && t < 35) ? 1 : 0;
    // underwater seaweed/coral
    if (down === 2 || p === 2 || waterNeighbors >= 2) {
        return Math.random() < 0.15 ? { variant: PLANT_VARIANTS.CORAL, colorCode: PLANT_VARIANTS.CORAL, fertile: 1 }
                                    : { variant: PLANT_VARIANTS.SEAWEED, colorCode: PLANT_VARIANTS.SEAWEED, fertile };
    }
    // cool damp rock: moss/lichen
    if (rockNeighbors >= 2 && t >= -5 && t <= 20) {
        const pick = Math.random() < 0.5 ? PLANT_VARIANTS.MOSS : PLANT_VARIANTS.LICHEN;
        return { variant: pick, colorCode: pick, fertile: 0.6 };
    }
    // hot dry sand: cactus
    if (sandNeighbors >= 2 && t > 28) {
        return { variant: PLANT_VARIANTS.CACTUS, colorCode: PLANT_VARIANTS.CACTUS, fertile: 0.2 };
    }
    // default soil/any surface
    let colorCode = PLANT_VARIANTS.DEFAULT;
    if (fertile && Math.random() < 0.03) colorCode = Math.random() < 0.5 ? PLANT_VARIANTS.FLOWER_PINK : PLANT_VARIANTS.FLOWER_YELLOW;
    return { variant: PLANT_VARIANTS.DEFAULT, colorCode, fertile };
}

export function maybeBloom(colorCode, fertile) {
    if (!fertile) return colorCode;
    if (Math.random() < 0.01) return Math.random() < 0.5 ? PLANT_VARIANTS.FLOWER_PINK : PLANT_VARIANTS.FLOWER_YELLOW;
    return colorCode;
}