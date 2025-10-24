import { PARTICLE_TYPES, TEMPERATURE } from '../../utils/Constants.js';

export function generateScenarioTerrain(world, config) {
    const w = world.width, h = world.height;
    const leftEnd = Math.floor(w * 0.25);
    const rightStart = Math.floor(w * 0.75);

    // 1) Baseline: bedrock and mantle
    for (let y = h - 10; y < h; y++) for (let x = 0; x < w; x++) world.setParticle(x, y, PARTICLE_TYPES.BEDROCK);
    const mantleStart = Math.floor(h * 0.8);
    for (let y = mantleStart; y < h - 10; y++) for (let x = 0; x < w; x++) world.setParticle(x, y, PARTICLE_TYPES.MANTLE);

    // 2) Left: icy mountains (granite with ice cap, cold temps)
    for (let x = 0; x < leftEnd; x++) {
        const ridge = Math.floor(h * 0.35 - Math.sin(x * 0.07) * 25 - Math.cos(x * 0.045) * 18);
        for (let y = ridge; y < mantleStart; y++) world.setParticle(x, y, PARTICLE_TYPES.GRANITE);
        for (let y = Math.max(0, ridge - 12); y < ridge; y++) world.setParticle(x, y, PARTICLE_TYPES.ICE);
        for (let y = 0; y < ridge; y++) {
            const t = Math.max(-20, -5 - (ridge - y) * 0.8);
            world.setTemperature(x, y, t);
        }
    }

    // 3) Central ocean with sand floor and island; seabed shaped by stone humps
    const humpFreq1 = 0.02, humpAmp1 = 18;
    const humpFreq2 = 0.06, humpAmp2 = 10;
    const oceanTop = Math.floor(h * 0.50);
    for (let x = leftEnd; x < rightStart; x++) {
        const seabed = Math.floor(h * 0.65 + Math.sin(x * humpFreq1) * humpAmp1 + Math.sin(x * humpFreq2) * humpAmp2);
        for (let y = seabed + 1; y < mantleStart; y++) world.setParticle(x, y, PARTICLE_TYPES.GRANITE);
        for (let y = seabed; y <= seabed + 1 && y < h; y++) world.setParticle(x, y, PARTICLE_TYPES.SAND);
        for (let y = oceanTop; y < seabed; y++) world.setParticle(x, y, PARTICLE_TYPES.WATER);
    }
    // Island in the middle
    const mid = Math.floor(w * 0.5);
    for (let x = mid - 25; x <= mid + 25; x++) {
        const islandBase = Math.floor(h * 0.60 + Math.sin((x - mid) * 0.08) * 6);
        const islandTop = islandBase - 18;
        for (let y = islandTop; y < islandBase; y++) world.setParticle(x, y, PARTICLE_TYPES.SOIL);
        // Elevate ocean locally
        for (let y = islandBase; y > oceanTop && world.getParticle(x, y) === PARTICLE_TYPES.WATER; y--) world.setParticle(x, y, PARTICLE_TYPES.EMPTY);
        // Seed plants
        for (let y = islandTop; y < islandBase; y++) {
            if (world.getParticle(x, y) === PARTICLE_TYPES.SOIL && world.getParticle(x, y - 1) === PARTICLE_TYPES.EMPTY && Math.random() < 0.15) {
                const env = classifyEnvironment(world, x, y);
                world.setParticle(x, y, PARTICLE_TYPES.PLANT, [0, 1, 0, env.colorCode]); // type 1: stem/established
            }
        }
    }

    // 4) Right: volcano with mantle upwelling and basalt funnel
    const ventX = Math.floor(w * 0.88);
    const coneTop = Math.floor(h * 0.42);
    const coneBase = Math.floor(h * 0.62);
    // Build cone walls (basalt)
    for (let x = rightStart; x < w; x++) {
        const slope = coneTop + Math.floor((x - rightStart) * 0.15);
        const topY = Math.min(coneBase, slope);
        for (let y = topY; y < mantleStart; y++) world.setParticle(x, y, PARTICLE_TYPES.GRANITE);
        for (let y = topY - 6; y < topY; y++) if (y >= 0) world.setParticle(x, y, PARTICLE_TYPES.BASALT);
    }
    // Upwelling mantle column
    const columnRadius = 6;
    for (let y = coneBase; y < mantleStart; y++) for (let dx = -columnRadius; dx <= columnRadius; dx++) {
        const x = ventX + dx; if (!world.inBounds(x, y)) continue;
        const r2 = dx * dx; if (r2 > columnRadius * columnRadius) continue;
        world.setParticle(x, y, PARTICLE_TYPES.MANTLE);
        world.setTemperature(x, y, 1300);
    }
    // Basalt funnel edges and lava core
    for (let y = Math.floor(h * 0.55); y < coneBase; y++) {
        const radius = Math.max(3, Math.floor(1 + (coneBase - y) * 0.05));
        for (let dx = -radius - 1; dx <= radius + 1; dx++) {
            const x = ventX + dx; if (!world.inBounds(x, y)) continue;
            const dist = Math.abs(dx);
            if (dist === radius || dist === radius + 1) world.setParticle(x, y, PARTICLE_TYPES.BASALT);
            else if (dist < radius - 1) { world.setParticle(x, y, PARTICLE_TYPES.LAVA); world.setTemperature(x, y, 1300); }
        }
    }
    // Central tunnel between mantle/basalt walls: lava bottom, granite/soil towards top
    const tunnelX = ventX;
    for (let y = Math.floor(h * 0.60); y < Math.floor(h * 0.72); y++) { world.setParticle(tunnelX, y, PARTICLE_TYPES.LAVA); world.setTemperature(tunnelX, y, 1250); }
    for (let y = Math.floor(h * 0.50); y < Math.floor(h * 0.60); y++) world.setParticle(tunnelX, y, PARTICLE_TYPES.GRANITE);
    for (let y = coneTop - 6; y < Math.floor(h * 0.50); y++) {
        world.setParticle(tunnelX, y, PARTICLE_TYPES.SOIL);
        if (world.getParticle(tunnelX, y - 1) === PARTICLE_TYPES.EMPTY && Math.random() < 0.1) {
            const env = classifyEnvironment(world, tunnelX, y);
            world.setParticle(tunnelX, y, PARTICLE_TYPES.PLANT, [0, 1, 0, env.colorCode]); // type 1: stem/established
        }
    }
    // Superheat near vent to encourage activity
    for (let y = coneTop; y < coneBase; y++) for (let dx = -10; dx <= 10; dx++) {
        const x = ventX + dx; if (!world.inBounds(x, y)) continue;
        const t = world.getTemperature(x, y);
        world.setTemperature(x, y, Math.max(t, 900 + Math.max(0, 10 - Math.abs(dx)) * 35));
    }

    // 5) Ensure ocean separation: carve water channel at surface between sides
    for (let x = leftEnd; x < rightStart; x++) {
        for (let y = Math.max(0, oceanTop - 10); y < oceanTop + 10; y++) {
            if (world.getParticle(x, y) === PARTICLE_TYPES.EMPTY) world.setParticle(x, y, PARTICLE_TYPES.WATER);
        }
    }

    // 6) Gentle global depth temperature gradient
    for (let y = 0; y < h; y++) {
        const depthRatio = y / h;
        const base = TEMPERATURE.AMBIENT + depthRatio * depthRatio * 1600;
        for (let x = 0; x < w; x++) {
            const t = world.getTemperature(x, y);
            if (base > t) world.setTemperature(x, y, base);
        }
    }
}