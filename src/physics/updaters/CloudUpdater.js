export class CloudUpdater {
    constructor(world) {
        this.world = world;
    }

    update(x, y, deltaTime = 16) {
        const idx = this.world.getIndex(x, y) * 4;
        let mass = this.world.particleData[idx] || 1; // accumulated moisture
        const temp = this.world.getTemperature(x, y);

        // Drift slowly
        const dir = Math.random() < 0.5 ? -1 : 1;
        const pl = this.world.getPressure(x - 1, y), pr = this.world.getPressure(x + 1, y);
        const windDir = (pl > pr) ? 1 : (pl < pr) ? -1 : dir;
        if (this.world.getParticle(x + windDir, y) === 0 && Math.random() < 0.8) {
            this.world.swapParticles(x, y, x + windDir, y);
            this.world.setUpdated(x + windDir, y);
            // strong gusts: take a second step when gradient large
            if (Math.abs(pl - pr) > 0.25 && this.world.getParticle(x + windDir * 2, y) === 0 && Math.random() < 0.4) {
                this.world.swapParticles(x + windDir, y, x + windDir * 2, y);
                this.world.setUpdated(x + windDir * 2, y);
            }
            return;
        }

        // Accrete nearby steam into cloud mass
        for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
                if (dx === 0 && dy === 0) continue;
                const nx = x + dx, ny = y + dy;
                if (this.world.getParticle(nx, ny) === 7 && Math.random() < 0.2) {
                    this.world.setParticle(nx, ny, 13); // convert STEAM -> CLOUD fragment
                    const nIdx = this.world.getIndex(nx, ny) * 4;
                    this.world.particleData[nIdx] = 0.5;
                    mass += 0.5;
                }
            }
        }

        // Merge with neighboring cloud to build larger structures
        const mx = x + (Math.random() < 0.5 ? -1 : 1);
        if (this.world.getParticle(mx, y) === 13 && Math.random() < 0.3) {
            const mIdx = this.world.getIndex(mx, y) * 4;
            mass += (this.world.particleData[mIdx] || 1);
            this.world.setParticle(mx, y, 0);
        }

        // Precipitation: if mass high and temp cool enough, release rain/snow
        const precipThreshold = 5;
        if (mass >= precipThreshold) {
            const freezing = temp <= 0;
            for (let drops = 0; drops < 3; drops++) {
                const dx = windDir * (Math.random() < 0.6 ? 1 : 0);
                if (this.world.getParticle(x + dx, y + 1) === 0) {
                    this.world.setParticle(x + dx, y + 1, freezing ? 6 : 2);
                    // Cool the column where rain forms
                    const tBelow = this.world.getTemperature(x + dx, y + 1);
                    this.world.setTemperature(x + dx, y + 1, tBelow - (freezing ? 8 : 5));
                }
            }
            mass = Math.max(1, mass - 2.0);
        }

        // Evaporation/dissipation in warm air
        if (temp > 40 && Math.random() < 0.02) {
            this.world.setParticle(x, y, 7); // back to STEAM
            return;
        }

        this.world.particleData[idx] = mass;
    }
}