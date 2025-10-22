export class Graphs {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.data = {
            plants: [],
            animals: []
        };
        this.maxDataPoints = 200;
        
        this.resize();
        window.addEventListener('resize', () => this.resize());
    }
    
    resize() {
        const container = this.canvas.parentElement;
        this.canvas.width = container.clientWidth;
        this.canvas.height = container.clientHeight;
    }
    
    update(populations) {
        this.data.plants.push(populations.plants || 0);
        this.data.animals.push(populations.animals || 0);
        
        if (this.data.plants.length > this.maxDataPoints) {
            this.data.plants.shift();
            this.data.animals.shift();
        }
    }
    
    render() {
        const { width, height } = this.canvas;
        this.ctx.clearRect(0, 0, width, height);
        
        // Draw grid
        this.ctx.strokeStyle = '#222';
        this.ctx.lineWidth = 1;
        for (let i = 0; i < 5; i++) {
            const y = (i / 4) * height;
            this.ctx.beginPath();
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(width, y);
            this.ctx.stroke();
        }
        
        // Draw data
        this.drawLine(this.data.plants, '#22bb22', 'Plants');
        this.drawLine(this.data.animals, '#bb6622', 'Animals');
    }
    
    drawLine(data, color, label) {
        if (data.length < 2) return;
        
        const { width, height } = this.canvas;
        const max = Math.max(...data, 1);
        
        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        
        for (let i = 0; i < data.length; i++) {
            const x = (i / this.maxDataPoints) * width;
            const y = height - (data[i] / max) * height;
            
            if (i === 0) {
                this.ctx.moveTo(x, y);
            } else {
                this.ctx.lineTo(x, y);
            }
        }
        
        this.ctx.stroke();
        
        // Draw label
        this.ctx.fillStyle = color;
        this.ctx.font = '10px Space Mono';
        this.ctx.fillText(label, 10, height - 10 - (data === this.data.plants ? 15 : 0));
    }
}

