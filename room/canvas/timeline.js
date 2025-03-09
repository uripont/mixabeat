export const TIMELINE_CONFIG = {
    totalDuration: 8, // 8-second timeline
    totalWidth: 1500,  // pixels - fixed width
    canvasWidth: 1500, // visible width
    trackHeight: 40, // reduced track height for more vertical space
    trackPadding: 10, // further reduced padding
    gridLines: 32,    // 2 lines per half-second (32 total for 8 seconds)
    topMargin: 10,     // slightly reduced top margin
    loopPoint: 8,     // point at which playback should loop (in seconds)
    minTracks: 10,    // minimum number of tracks to show
    minHeight: null   // will be calculated based on minTracks
};

export class Timeline {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.scrollOffset = 0;
        this.contentHeight = 0;
        
        // Calculate minimum height
        TIMELINE_CONFIG.minHeight = TIMELINE_CONFIG.minTracks * 
            (TIMELINE_CONFIG.trackHeight + TIMELINE_CONFIG.trackPadding) + 
            TIMELINE_CONFIG.topMargin;
            
        // Setup scroll handling
        canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            const delta = e.deltaY;
            const maxScroll = Math.max(0, this.contentHeight - this.canvas.height);
            this.scrollOffset = Math.max(0, Math.min(this.scrollOffset + delta, maxScroll));
            this.draw(window.roomState.tracks, window.roomState.playback.currentTime, window.roomState);
        });
        
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
        
        // Calculate content height based on number of tracks
        const tracks = window.roomState?.tracks || [];
        this.contentHeight = Math.max(
            TIMELINE_CONFIG.minHeight,
            tracks.length * (TIMELINE_CONFIG.trackHeight + TIMELINE_CONFIG.trackPadding) + 
            TIMELINE_CONFIG.topMargin
        );
        
        // Set canvas height to available space
        this.canvas.height = panelContentRect.height - 30;
        TIMELINE_CONFIG.canvasWidth = this.canvas.width;
        
        // Adjust scroll offset if content height changed
        const maxScroll = Math.max(0, this.contentHeight - this.canvas.height);
        this.scrollOffset = Math.min(this.scrollOffset, maxScroll);
        
        // Redraw after resize
        this.draw(window.roomState?.tracks || [], window.roomState?.playback?.currentTime || 0, window.roomState);
    }

    drawGrid() {
        const { ctx } = this;
        
        // Save context state
        ctx.save();
        
        // Apply scroll transformation
        ctx.translate(0, -this.scrollOffset);
        
        const divisionWidth = TIMELINE_CONFIG.totalWidth / TIMELINE_CONFIG.gridLines;
        const totalHeight = Math.max(this.contentHeight, this.canvas.height + this.scrollOffset);

        ctx.strokeStyle = '#333'; // Darker gray for grid lines
        ctx.lineWidth = 1;

        // Draw grid lines
        for (let i = 0; i <= TIMELINE_CONFIG.gridLines; i++) {
            const xPos = i * divisionWidth;
            
            ctx.beginPath();
            ctx.moveTo(xPos, 0);
            ctx.lineTo(xPos, totalHeight);
            ctx.stroke();
        }
        
        ctx.restore();
        
        // Draw loop point indicator (yellow line at loop point)
        const loopPointX = (TIMELINE_CONFIG.loopPoint / TIMELINE_CONFIG.totalDuration) * TIMELINE_CONFIG.canvasWidth;
        ctx.strokeStyle = 'yellow';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(loopPointX, 0);
        ctx.lineTo(loopPointX, this.canvas.height + this.scrollOffset);
        ctx.stroke();
        ctx.setLineDash([]);
    }

    drawTracks(tracks, roomState) {
        const { ctx } = this;
        
        // Save context state
        ctx.save();
        
        // Apply scroll transformation
        ctx.translate(0, -this.scrollOffset);
        
        tracks.forEach((track, index) => {
            const y = index * (TIMELINE_CONFIG.trackHeight + TIMELINE_CONFIG.trackPadding) + 
                     TIMELINE_CONFIG.trackPadding + TIMELINE_CONFIG.topMargin;
            
            // Skip tracks that are not visible
            if (y + TIMELINE_CONFIG.trackHeight < this.scrollOffset || 
                y > this.scrollOffset + this.canvas.height) {
                return;
            }
            
            const x = track.position;

            // Check if track is owned by current user
            const isOwnedTrack = track.ownerId === roomState.userId;

            // Draw track background with border
            ctx.fillStyle = isOwnedTrack ? track.color : '#999999';
            ctx.globalAlpha = isOwnedTrack ? 1.0 : 0.6;
            ctx.fillRect(x, y, 100, TIMELINE_CONFIG.trackHeight);
            ctx.globalAlpha = 1.0;

            ctx.strokeStyle = '#666';
            ctx.lineWidth = 2;
            ctx.strokeRect(x, y, 100, TIMELINE_CONFIG.trackHeight);

            // Draw track name with better contrast
            ctx.fillStyle = isOwnedTrack ? '#000' : '#555';
            ctx.font = '12px Montserrat, sans-serif';
            ctx.fillText(track.name, x + 5, y + (TIMELINE_CONFIG.trackHeight / 1.5));
        });
        
        // Restore context state
        ctx.restore();
    }

    drawPlayhead(currentTime) {
        const { ctx } = this;
        const playheadX = (currentTime / TIMELINE_CONFIG.totalDuration) * TIMELINE_CONFIG.canvasWidth;

        ctx.strokeStyle = 'red';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(playheadX, 0);
        ctx.lineTo(playheadX, this.canvas.height);
        ctx.stroke();
        
        // Draw current time (stays fixed at top)
        ctx.fillStyle = 'red';
        ctx.font = '12px Montserrat, sans-serif';
        ctx.fillText(`${currentTime.toFixed(2)}s`, playheadX + 5, 20);
    }

    draw(tracks = [], currentTime = 0, roomState = window.roomState) {
        const { ctx } = this;

        // Clear canvas
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw components
        this.drawGrid();
        this.drawTracks(tracks, roomState);
        this.drawPlayhead(currentTime);
    }

    // Get time position from x coordinate
    getTimeFromX(x) {
        return (x / TIMELINE_CONFIG.canvasWidth) * TIMELINE_CONFIG.totalDuration;
    }

    // Get x coordinate from time
    getXFromTime(time) {
        return (time / TIMELINE_CONFIG.totalDuration) * TIMELINE_CONFIG.canvasWidth;
    }

    // Get max allowed position for tracks (loop point boundary)
    getMaxAllowedPosition() {
        return (TIMELINE_CONFIG.loopPoint / TIMELINE_CONFIG.totalDuration) * TIMELINE_CONFIG.canvasWidth;
    }

    // Cleanup
    destroy() {
        this.canvas.removeEventListener('wheel', this.handleWheel);
        window.removeEventListener('resize', this.resizeCanvas);
    }
}
