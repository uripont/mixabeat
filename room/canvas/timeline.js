export const TIMELINE_CONFIG = {
    totalDuration: 8, // 8-second timeline
    totalWidth: 1500,  // pixels - fixed width
    canvasWidth: 1500, // visible width
    trackHeight: 40, // reduced track height for more vertical space
    trackPadding: 10, // further reduced padding
    gridLines: 16,    // 4 lines per second (16 total for 4 seconds)
    topMargin: 10,     // slightly reduced top margin
    loopPoint: 3      // point at which playback should loop (in seconds)
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

        // Draw grid lines
        for (let i = 0; i <= TIMELINE_CONFIG.gridLines; i++) {
            const xPos = i * divisionWidth;
            
            ctx.beginPath();
            ctx.moveTo(xPos, 0);
            ctx.lineTo(xPos, this.canvas.height);
            ctx.stroke();
            
            // Draw time labels at each second (every 4 grid lines)
            if (i % 4 === 0) {
                const seconds = i / 4;
                ctx.fillStyle = '#fff';
                ctx.font = '10px Montserrat, sans-serif';
                ctx.fillText(`${seconds}s`, xPos + 2, 10);
            }
        }
        
        // Draw loop point indicator (yellow line only, no text)
        const loopPointX = (TIMELINE_CONFIG.loopPoint / TIMELINE_CONFIG.totalDuration) * TIMELINE_CONFIG.totalWidth;
        ctx.strokeStyle = 'yellow';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]); // Dashed line
        ctx.beginPath();
        ctx.moveTo(loopPointX, 0);
        ctx.lineTo(loopPointX, this.canvas.height);
        ctx.stroke();
        ctx.setLineDash([]); // Reset to solid line
    }

    drawTracks(tracks) {
        const { ctx } = this;
        
        tracks.forEach((track, index) => {
            const y = index * (TIMELINE_CONFIG.trackHeight + TIMELINE_CONFIG.trackPadding) + 
                     TIMELINE_CONFIG.trackPadding + TIMELINE_CONFIG.topMargin;
            const x = track.position;

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

        ctx.strokeStyle = 'red';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(playheadX, 0);
        ctx.lineTo(playheadX, this.canvas.height);
        ctx.stroke();
        
        // Draw current time
        ctx.fillStyle = 'red';
        ctx.font = '12px Montserrat, sans-serif';
        ctx.fillText(`${currentTime.toFixed(2)}s`, playheadX + 5, 20);
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
        return (x / TIMELINE_CONFIG.totalWidth) * TIMELINE_CONFIG.totalDuration;
    }

    // Get x coordinate from time
    getXFromTime(time) {
        return (time / TIMELINE_CONFIG.totalDuration) * TIMELINE_CONFIG.totalWidth;
    }

    // Cleanup
    destroy() {
        window.removeEventListener('resize', this.resizeCanvas);
    }
}
