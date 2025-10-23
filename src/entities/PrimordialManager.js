import { Primordial } from './Primordial.js';

export class PrimordialManager {
    constructor(world) {
        this.world = world;
        this.entities = [];
        this.nextId = 1;
    }

    add(domain, color, size) {
        const ent = new Primordial(this.nextId++, domain, color, size, this.world);
        this.entities.push(ent);
        return ent.id;
    }

    remove(id) {
        this.entities = this.entities.filter(e => e.id !== id);
    }

    getById(id) {
        return this.entities.find(e => e.id === id) || null;
    }

    update() {
        // Movement and influence
        for (const e of this.entities) {
            e.update(this.world);
            e.influence(this.world);
        }
        // Battles
        for (let i = 0; i < this.entities.length; i++) {
            for (let j = i + 1; j < this.entities.length; j++) {
                const a = this.entities[i], b = this.entities[j];
                if (a.overlaps(b)) this.battle(a, b);
            }
        }
        // Cleanup dead
        this.entities = this.entities.filter(e => e.alive);
    }

    battle(a, b) {
        // Short, destructive interaction
        const ticks = 20;
        for (let k = 0; k < ticks; k++) {
            const cx = Math.floor((a.x + b.x) / 2);
            const cy = Math.floor((a.y + b.y) / 2);
            const radius = 6 + Math.floor(Math.random() * 6);
            for (let dy = -radius; dy <= radius; dy++) {
                for (let dx = -radius; dx <= radius; dx++) {
                    if (dx * dx + dy * dy > radius * radius) continue;
                    const x = cx + dx, y = cy + dy;
                    if (!this.world.inBounds(x, y)) continue;
                    // Each entity applies domain power
                    a.applyDomain(this.world, x, y, 2);
                    b.applyDomain(this.world, x, y, 2);
                    // Occasional void blasts
                    if (Math.random() < 0.02) this.world.setParticle(x, y, 0);
                }
            }
        }
        // Resolve outcome
        const roll = Math.random();
        if (roll < 0.4) a.alive = false;
        else if (roll < 0.8) b.alive = false;
        else { a.alive = false; b.alive = false; }
    }
}