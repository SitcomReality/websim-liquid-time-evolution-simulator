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
        const tLB = this.world.getTemperature(2, Math.floor(this.world.height * 0.6));
        const tRB = this.world.getTemperature(this.world.width - 3, Math.floor(this.world.height * 0.6));
        const gTop = (tRT - tLT) * 0.05;   // Increased by 10x: stronger global circulation
        const gBot = (tRB - tLB) * 0.05;

        for (let i = 0; i < sampleCount; i++) {
            const idx = Math.floor(Math.random() * this.world.windSize);
            
            // Skip if not open air
            if (!this.world.airflow.isOpenAir(idx)) {
                this.world.windVx[idx] *= 0.3; // Rapidly kill underground wind
                this.world.windVy[idx] *= 0.3;
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

            // Pressure gradient - increased influence
            let vx = (pLeft - pRight) * 2.0; // Stronger pressure gradient effect
            let vy = (pUp - pDown) * 2.0;

            // Temperature buoyancy (hot air rises) - massively increased
            const tCenter = this.world.getTemperature(cx, cy);
            const tUp = this.world.getTemperature(cx, cy - this.world.windResolution);
            const tDown = this.world.getTemperature(cx, cy + this.world.windResolution);
            const tLeft = this.world.getTemperature(cx - this.world.windResolution, cy);
            const tRight = this.world.getTemperature(cx + this.world.windResolution, cy);
            
            // Vertical buoyancy from temperature (hot rises, cold sinks)
            const verticalTempDiff = tCenter - tUp;
            vy -= verticalTempDiff * 0.08; // 20x stronger than before
            
            // Horizontal flow from temperature gradients
            const horizontalTempDiff = tRight - tLeft;
            vx += horizontalTempDiff * 0.02;

            // Add global circulation: top flows hot->cold aloft; bottom returns cold->hot
            const altitudeRatio = wy / this.world.windHeight;
            const globalPush = (altitudeRatio < 0.4) ? gBot : (altitudeRatio > 0.6) ? -gTop : 0;
            vx += globalPush;

            // Clamp to reasonable values
            const maxWind = 5.0; // Increased max wind speed
            vx = Math.max(-maxWind, Math.min(maxWind, vx));
            vy = Math.max(-maxWind, Math.min(maxWind, vy));

            // Blend with previous wind but keep more of the new calculation
            this.world.windVx[idx] = vx * 0.7 + this.world.windVx[idx] * 0.3; // Keep 70% new, 30% old
            this.world.windVy[idx] = vy * 0.7 + this.world.windVy[idx] * 0.3;
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

            const advectionAmount = Math.min(0.5, Math.abs(wind.magnitude) * 0.15); // Stronger advection
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

            const advectionAmount = Math.min(0.3, Math.abs(wind.magnitude) * 0.1); // Slightly stronger
            this.world.pressure[idx] = this.world.pressure[idx] * (1 - advectionAmount) +
                                       this.world.pressure[sampleIdx] * advectionAmount;
        }
    }

    diffuseWind(fidelity) {
        const sampleCount = Math.ceil((this.world.windSize / 15) * fidelity);
        const diffuseAmount = 0.08; // Less diffusion to keep wind patterns sharper

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
                        // Only average with other air cells
                        if (this.world.airflow.isOpenAir(nIdx)) {
                            avgVx += this.world.windVx[nIdx];
                            avgVy += this.world.windVy[nIdx];
                            count++;
                        }
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