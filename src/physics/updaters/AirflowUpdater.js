export class AirflowUpdater {
    constructor(world) {
        this.world = world;
    }

    update(fidelity, deltaTime) {
        // Periodically check which regions are open air
        this.world.airflow.airCheckCounter++;
        if (this.world.airflow.airCheckCounter >= this.world.airflow.airCheckInterval) {
            this.world.airflow.updateAirCells();
            this.world.airflow.airCheckCounter = 0;
        }

        // Calculate wind from pressure and temperature gradients (only in air)
        this.calculateWindFromGradients(fidelity);

        // Advect temperature and pressure via wind
        this.advectTemperature(fidelity);
        this.advectPressure(fidelity);

        // Diffuse wind to smooth field (reduces noise)
        this.diffuseWind(fidelity);
    }

    calculateWindFromGradients(fidelity) {
        const sampleCount = Math.ceil((this.world.windSize / 10) * fidelity);
        // Global left/right temperature gradients at top and bottom
        const tLT = this.world.getTemperature(2, 2);
        const tRT = this.world.getTemperature(this.world.width - 3, 2);
        const tLB = this.world.getTemperature(2, this.world.height - 3);
        const tRB = this.world.getTemperature(this.world.width - 3, this.world.height - 3);
        const gTop = (tRT - tLT) * 0.003;   // positive if right hotter
        const gBot = (tRB - tLB) * 0.003;

        for (let i = 0; i < sampleCount; i++) {
            const idx = Math.floor(Math.random() * this.world.windSize);
            
            // Skip if not open air
            if (!this.world.airflow.isOpenAir(idx)) {
                this.world.windVx[idx] *= 0.95; // Dampen wind underground
                this.world.windVy[idx] *= 0.95;
                continue;
            }
            
            const wx = idx % this.world.windWidth;
            const wy = Math.floor(idx / this.world.windWidth);

            const cx = wx * this.world.windResolution + this.world.windResolution * 0.5;
            const cy = wy * this.world.windResolution + this.world.windResolution * 0.5;

            // Sample pressure in cardinal directions
            const pCenter = this.world.getPressure(cx, cy);
            const pLeft = this.world.getPressure(cx - this.world.windResolution, cy);
            const pRight = this.world.getPressure(cx + this.world.windResolution, cy);
            const pUp = this.world.getPressure(cx, cy - this.world.windResolution);
            const pDown = this.world.getPressure(cx, cy + this.world.windResolution);

            // Pressure gradient
            let vx = (pRight - pLeft) * 0.5;
            let vy = (pDown - pUp) * 0.5;

            // Temperature buoyancy (hot air rises)
            const tCenter = this.world.getTemperature(cx, cy);
            const tUp = this.world.getTemperature(cx, cy - this.world.windResolution);
            const tempDiff = tCenter - tUp;
            vy -= tempDiff * 0.001;

            // Clamp to reasonable values
            const maxWind = 2.0;
            vx = Math.max(-maxWind, Math.min(maxWind, vx));
            vy = Math.max(-maxWind, Math.min(maxWind, vy));
            // Add global circulation: top flows hot->cold aloft; bottom returns cold->hot
            const globalPush = (wy < this.world.windHeight * 0.5) ? -gTop : gBot;
            vx += globalPush;

            this.world.windVx[idx] = vx * 0.8 + this.world.windVx[idx] * 0.2;
            this.world.windVy[idx] = vy * 0.8 + this.world.windVy[idx] * 0.2;
        }
    }

    advectTemperature(fidelity) {
        const sampleCount = Math.ceil((this.world.thermalSize / 20) * fidelity);

        for (let i = 0; i < sampleCount; i++) {
            const idx = Math.floor(Math.random() * this.world.thermalSize);
            const tx = idx % this.world.thermalWidth;
            const ty = Math.floor(idx / this.world.thermalWidth);

            const wx = tx * this.world.thermo.thermalResolution;
            const wy = ty * this.world.thermo.thermalResolution;

            const wind = this.world.getWind(wx, wy);

            const sampleDist = 2;
            const sampleX = Math.max(0, Math.min(this.world.thermalWidth - 1, tx - Math.sign(wind.vx) * sampleDist));
            const sampleY = Math.max(0, Math.min(this.world.thermalHeight - 1, ty - Math.sign(wind.vy) * sampleDist));
            const sampleIdx = sampleY * this.world.thermalWidth + sampleX;

            const advectionAmount = Math.min(0.3, Math.abs(wind.magnitude) * 0.1);
            this.world.tempBuffer[idx] = this.world.temperature[idx] * (1 - advectionAmount) +
                                        this.world.temperature[sampleIdx] * advectionAmount;
        }

        for (let i = 0; i < sampleCount; i++) {
            const idx = Math.floor(Math.random() * this.world.thermalSize);
            this.world.temperature[idx] = this.world.tempBuffer[idx];
        }
    }

    advectPressure(fidelity) {
        const sampleCount = Math.ceil((this.world.thermalSize / 40) * fidelity);

        for (let i = 0; i < sampleCount; i++) {
            const idx = Math.floor(Math.random() * this.world.thermalSize);
            const tx = idx % this.world.thermalWidth;
            const ty = Math.floor(idx / this.world.thermalWidth);

            const wx = tx * this.world.thermo.thermalResolution;
            const wy = ty * this.world.thermo.thermalResolution;

            const wind = this.world.getWind(wx, wy);

            const sampleDist = 1;
            const sampleX = Math.max(0, Math.min(this.world.thermalWidth - 1, tx - Math.sign(wind.vx) * sampleDist));
            const sampleY = Math.max(0, Math.min(this.world.thermalHeight - 1, ty - Math.sign(wind.vy) * sampleDist));
            const sampleIdx = sampleY * this.world.thermalWidth + sampleX;

            const advectionAmount = Math.min(0.2, Math.abs(wind.magnitude) * 0.05);
            this.world.pressure[idx] = this.world.pressure[idx] * (1 - advectionAmount) +
                                       this.world.pressure[sampleIdx] * advectionAmount;
        }
    }

    diffuseWind(fidelity) {
        const sampleCount = Math.ceil((this.world.windSize / 15) * fidelity);
        const diffuseAmount = 0.15;

        for (let i = 0; i < sampleCount; i++) {
            const idx = Math.floor(Math.random() * this.world.windSize);
            
            // Don't diffuse wind into underground regions
            if (!this.world.airflow.isOpenAir(idx)) continue;
            
            const wx = idx % this.world.windWidth;
            const wy = Math.floor(idx / this.world.windWidth);

            let avgVx = this.world.windVx[idx];
            let avgVy = this.world.windVy[idx];
            let count = 1;

            for (let dy = -1; dy <= 1; dy++) {
                for (let dx = -1; dx <= 1; dx++) {
                    if (dx === 0 && dy === 0) continue;
                    const nwx = wx + dx;
                    const nwy = wy + dy;
                    if (nwx >= 0 && nwx < this.world.windWidth && nwy >= 0 && nwy < this.world.windHeight) {
                        const nIdx = nwy * this.world.windWidth + nwx;
                        avgVx += this.world.windVx[nIdx];
                        avgVy += this.world.windVy[nIdx];
                        count++;
                    }
                }
            }

            avgVx /= count;
            avgVy /= count;

            this.world.windVx[idx] = this.world.windVx[idx] * (1 - diffuseAmount) + avgVx * diffuseAmount;
            this.world.windVy[idx] = this.world.windVy[idx] * (1 - diffuseAmount) + avgVy * diffuseAmount;
        }
    }
}