export const TIMELINE_CONFIG = {
    totalDuration: 2.5, // fixed 2.5-second timeline
    totalWidth: 1500,  // pixels - matches viewport width
    canvasWidth: 1500, // visible width
    trackHeight: 40, // reduced track height for more vertical space
    trackPadding: 10, // further reduced padding
    gridLines: 10,    // one line every 0.25 seconds
    topMargin: 10     // slightly reduced top margin
};

export class Timeline {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.scrollOffset = 0;
        
        // Initial setup
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
    }

    resizeCanvas() {
        // Set canvas size based on panel content
        const panelContent = document.querySelector('.center-panel .panel-content');
        if (!panelContent) {
            console.error('Panel content not found');
            return;
        }
        
        const panelContentRect = panelContent.getBoundingClientRect();
        this.canvas.width = panelContentRect.width - 30; // Subtract padding
        this.canvas.height = panelContentRect.height - 30; // Subtract padding
        TIMELINE_CONFIG.canvasWidth = this.canvas.width;

        console.log('Canvas width:', this.canvas.width);
        console.log('Canvas height:', this.canvas.height);
        console.log('Panel Content Width:', panelContentRect.width);
        console.log('Panel Content Height:', panelContentRect.height);
        
        // Redraw after resize
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
            const y = index * (TIMELINE_CONFIG.trackHeight + TIMELINE_CONFIG.trackPadding) + 
                     TIMELINE_CONFIG.trackPadding + TIMELINE_CONFIG.topMargin;
            const x = track.position;

            // Draw track background
            // Draw track background with border
            ctx.fillStyle = track.color;
            ctx.fillRect(x, y, 100, TIMELINE_CONFIG.trackHeight);
            ctx.strokeStyle = '#666';
            ctx.lineWidth = 2;
            ctx.strokeRect(x, y, 100, TIMELINE_CONFIG.trackHeight);

            // Draw track name with better contrast
            ctx.fillStyle = '#000';
            ctx.font = '12px Montserrat, sans-serif';
            ctx.fillText(track.name, x + 5, y + (TIMELINE_CONFIG.trackHeight / 1.5));
        });
    }

    drawPlayhead(currentTime) {
        const { ctx } = this;
        const playheadX = (currentTime / TIMELINE_CONFIG.totalDuration) * TIMELINE_CONFIG.totalWidth;

        if (playheadX <= TIMELINE_CONFIG.canvasWidth) {
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
        window.removeEventListener('resize', this.resizeCanvas);
    }
}
