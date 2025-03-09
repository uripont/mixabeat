export const TIMELINE_CONFIG = {
    totalDuration: 30, // seconds
    totalWidth: 9000,  // pixels
    canvasWidth: 1500, // visible width
    trackHeight: 30,
    trackPadding: 10,
    gridLines: 90
};

export class Timeline {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.scrollOffset = 0;
        
        // Bind event handlers
        this.handleWheel = this.handleWheel.bind(this);
        
        // Add event listeners
        this.canvas.addEventListener('wheel', this.handleWheel);
        
        // Initial setup
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
    }

    resizeCanvas() {
        // Set canvas size based on container
        const rect = this.canvas.parentElement.getBoundingClientRect();
        this.canvas.width = rect.width;
        this.canvas.height = rect.height;
        TIMELINE_CONFIG.canvasWidth = rect.width;
        
        // Redraw after resize
        this.draw();
    }

    handleWheel(event) {
        event.preventDefault();
        this.scrollOffset += event.deltaY * 0.5;
        this.scrollOffset = Math.max(0, Math.min(
            this.scrollOffset,
            TIMELINE_CONFIG.totalWidth - TIMELINE_CONFIG.canvasWidth
        ));
        this.draw();
    }

    drawGrid() {
        const { ctx } = this;
        const divisionWidth = TIMELINE_CONFIG.totalWidth / TIMELINE_CONFIG.gridLines;

        ctx.strokeStyle = '#ccc';
        ctx.lineWidth = 1;

        for (let i = 1; i < TIMELINE_CONFIG.gridLines; i++) {
            const xPos = i * divisionWidth - this.scrollOffset;
            if (xPos < 0 || xPos > TIMELINE_CONFIG.canvasWidth) continue;
            
            ctx.beginPath();
            ctx.moveTo(xPos, 0);
            ctx.lineTo(xPos, this.canvas.height);
            ctx.stroke();
        }
    }

    drawTracks(tracks) {
        const { ctx } = this;
        
        tracks.forEach((track, index) => {
            const y = index * (TIMELINE_CONFIG.trackHeight + TIMELINE_CONFIG.trackPadding) + TIMELINE_CONFIG.trackPadding + 40;
            const x = track.position - this.scrollOffset;

            // Skip if track is outside visible area
            if (x + 100 < 0 || x > TIMELINE_CONFIG.canvasWidth) return;

            // Draw track background
            ctx.fillStyle = track.color;
            ctx.fillRect(x, y, 100, TIMELINE_CONFIG.trackHeight);

            // Draw track name
            ctx.fillStyle = '#333';
            ctx.font = '12px Montserrat, sans-serif';
            ctx.fillText(track.name, x + 5, y + (TIMELINE_CONFIG.trackHeight / 1.5));
        });
    }

    drawPlayhead(currentTime) {
        const { ctx } = this;
        const playheadX = (currentTime / TIMELINE_CONFIG.totalDuration) * TIMELINE_CONFIG.totalWidth - this.scrollOffset;

        if (playheadX >= 0 && playheadX <= TIMELINE_CONFIG.canvasWidth) {
            ctx.strokeStyle = 'red';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(playheadX, 0);
            ctx.lineTo(playheadX, this.canvas.height);
            ctx.stroke();
        }
    }

    draw(tracks = [], currentTime = 0) {
        const { ctx } = this;

        // Clear canvas
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw components
        this.drawGrid();
        this.drawTracks(tracks);
        this.drawPlayhead(currentTime);
    }

    // Get time position from x coordinate
    getTimeFromX(x) {
        return ((x + this.scrollOffset) / TIMELINE_CONFIG.totalWidth) * TIMELINE_CONFIG.totalDuration;
    }

    // Get x coordinate from time
    getXFromTime(time) {
        return (time / TIMELINE_CONFIG.totalDuration) * TIMELINE_CONFIG.totalWidth - this.scrollOffset;
    }

    // Cleanup
    destroy() {
        this.canvas.removeEventListener('wheel', this.handleWheel);
        window.removeEventListener('resize', this.resizeCanvas);
    }
}
