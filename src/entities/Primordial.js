export class Primordial {
    constructor(id, domain, color, size, world) {
        this.id = id;
        this.domain = domain; // 'life' | 'water' | 'granite' | 'void' | 'heat'
        this.color = color; // [r,g,b]
        this.size = Math.max(10, Math.min(50, size));
        this.x = Math.floor(world.width * 0.5 + (Math.random() - 0.5) * world.width * 0.6);
        this.y = Math.floor(world.height * 0.3 + Math.random() * world.height * 0.4);
        this.vx = (Math.random() - 0.5) * 0.8;
        this.vy = (Math.random() - 0.5) * 0.6;
        this.chaotic = Math.random() < 0.5;
        this.pixelOffsets = this.generateOffsets();
        this.alive = true;
        this.battleTicks = 0;
    }

    generateOffsets() {
        const minUnique = 5;
        const desired = Math.max(minUnique, Math.floor(this.size));
        const set = new Set();
        const radius = Math.sqrt(this.size);
        // Ensure we get 'desired' unique integer offsets
        while (set.size < desired) {
            const angle = Math.random() * Math.PI * 2;
            const r = radius * Math.sqrt(Math.random());
            const ox = Math.floor(Math.cos(angle) * r);
            const oy = Math.floor(Math.sin(angle) * r);
            set.add(`${ox},${oy}`);
        }
        return Array.from(set).map(s => { const [x,y]=s.split(',').map(Number); return {x,y}; });
    }

    update(world) {
        if (!this.alive) return;
        this.x += this.vx;
        this.y += this.vy;
        if (this.x < 2 || this.x > world.width - 3) this.vx *= -1;
        if (this.y < 2 || this.y > world.height - 3) this.vy *= -1;
        if (this.chaotic) {
            // Slightly shuffle offsets to create morphing shape
            for (let i = 0; i < this.pixelOffsets.length; i++) {
                const o = this.pixelOffsets[i];
                o.x += Math.floor((Math.random() - 0.5) * 2);
                o.y += Math.floor((Math.random() - 0.5) * 2);
                o.x = Math.max(-6, Math.min(6, o.x));
                o.y = Math.max(-6, Math.min(6, o.y));
            }
        }
    }

    influence(world, tickMod = 1) {
        if (!this.alive) return;
        // Affect a few random pixels per tick for performance
        const attempts = Math.max(3, Math.floor(this.size / 6));
        for (let i = 0; i < attempts; i++) {
            const off = this.pixelOffsets[Math.floor(Math.random() * this.pixelOffsets.length)];
            const px = Math.floor(this.x) + off.x;
            const py = Math.floor(this.y) + off.y;
            if (!world.inBounds(px, py)) continue;
            this.applyDomain(world, px, py, tickMod);
        }
    }

    applyDomain(world, x, y, tickMod) {
        const P = world.getParticle(x, y);
        switch (this.domain) {
            case 'void':
                world.setParticle(x, y, 0);
                break;
            case 'water':
                // create/shape water and its temperature
                if (Math.random() < 0.7) world.setParticle(x, y, 2);
                // cool or heat to move between phases
                const t = world.getTemperature(x, y);
                const target = Math.random() < 0.5 ? 0 : 100;
                world.setTemperature(x, y, t + (target - t) * 0.2);
                break;
            case 'granite':
                // Manifest granite or convert loose material into granite
                if (P === 1 || P === 4 || P === 2) {
                    world.setParticle(x, y, 3);
                } else if (Math.random() < 0.2) {
                    world.setParticle(x, y, 3);
                }
                break;
            case 'life':
                // Create soil/plants in suitable spots
                if (P === 0 && world.getParticle(x, y + 1) === 4) {
                    const env = classifyEnvironment(world, x, y);
                    world.setParticle(x, y, 8, [0, 1, 0, env.colorCode]); // Stem/Established plant
                } else if (P === 4 && world.getParticle(x, y - 1) === 0) {
                    if (Math.random() < 0.3) {
                        const env = classifyEnvironment(world, x, y);
                        world.setParticle(x, y, 8, [0, 1, 0, env.colorCode]); // Stem/Established plant
                    }
                } else if (P === 0 && Math.random() < 0.1) {
                    world.setParticle(x, y, 4);
                }
                break;
            case 'heat':
                // Raise local temperature; can melt/freeze via ThermalUpdater later
                const temp = world.getTemperature(x, y);
                world.setTemperature(x, y, temp + 20 * tickMod);
                break;
        }
    }

    overlaps(other) {
        if (!this.alive || !other.alive) return false;
        const dx = this.x - other.x;
        const dy = this.y - other.y;
        return (dx * dx + dy * dy) < 100; // within ~10px radius
    }
}