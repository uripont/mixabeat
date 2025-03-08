// Panel resizing functionality
export function initializePanelResizing() {
    const leftPanel = document.querySelector('.left-panel');
    const rightPanel = document.querySelector('.right-panel');
    const bottomPanel = document.querySelector('.bottom-panel');
    const mainContent = document.querySelector('.main-content');
    
    // Create and append actual resize handles instead of using pseudo-elements
    const leftPanelResizer = document.createElement('div');
    leftPanelResizer.className = 'panel-resizer left-resizer';
    leftPanel.appendChild(leftPanelResizer);
    
    const rightPanelResizer = document.createElement('div');
    rightPanelResizer.className = 'panel-resizer right-resizer';
    rightPanel.appendChild(rightPanelResizer);
    
    const bottomPanelResizer = document.createElement('div');
    bottomPanelResizer.className = 'panel-resizer bottom-resizer';
    bottomPanel.appendChild(bottomPanelResizer);
    
    // Add CSS for the resizers
    const style = document.createElement('style');
    style.textContent = `
        .panel-resizer {
            position: absolute;
            z-index: 10;
            background: rgba(255, 255, 255, 0.1);
            transition: background 0.2s;
        }
        .panel-resizer:hover {
            background: rgba(255, 255, 255, 0.3);
        }
        .left-resizer {
            cursor: ew-resize;
            width: 8px;
            top: 0;
            right: 0;
            bottom: 0;
        }
        .right-resizer {
            cursor: ew-resize;
            width: 8px;
            top: 0;
            left: 0;
            bottom: 0;
        }
        .bottom-resizer {
            cursor: ns-resize;
            height: 8px;
            left: 0;
            right: 0;
            top: 0;
        }
    `;
    document.head.appendChild(style);
    
    // Minimum sizes
    const MIN_WIDTH = 150;
    const MIN_HEIGHT = 100;
    
    // Initial column and row sizes
    const initialLayout = {
        columns: {
            left: 20,
            center: 55,
            right: 25
        },
        rows: {
            top: 'auto',
            bottom: '200px'
        }
    };
    
    // Left panel resize
    leftPanelResizer.addEventListener('mousedown', function(e) {
        e.preventDefault();
        
        const startX = e.clientX;
        const startWidth = leftPanel.offsetWidth;
        const containerWidth = mainContent.offsetWidth;
        
        function onMouseMove(moveEvent) {
            const deltaX = moveEvent.clientX - startX;
            const newWidth = Math.max(MIN_WIDTH, startWidth + deltaX);
            const newPercentage = (newWidth / containerWidth) * 100;
            
            // Limit to reasonable percentage
            if (newPercentage < 40) {
                // Update left column width
                mainContent.style.gridTemplateColumns = `${newPercentage}% ${100 - newPercentage - initialLayout.columns.right}% ${initialLayout.columns.right}%`;
            }
        }
        
        function onMouseUp() {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            document.body.classList.remove('resizing');
        }
        
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
        document.body.classList.add('resizing');
    });
    
    // Right panel resize
    rightPanelResizer.addEventListener('mousedown', function(e) {
        e.preventDefault();
        
        const startX = e.clientX;
        const startWidth = rightPanel.offsetWidth;
        const containerWidth = mainContent.offsetWidth;
        
        function onMouseMove(moveEvent) {
            const deltaX = startX - moveEvent.clientX;
            const newWidth = Math.max(MIN_WIDTH, startWidth + deltaX);
            const newPercentage = (newWidth / containerWidth) * 100;
            
            // Limit to between 17% and 30%
            if (newPercentage >= 17 && newPercentage <= 30) {
                // Update right column width
                mainContent.style.gridTemplateColumns = `${initialLayout.columns.left}% ${100 - newPercentage - initialLayout.columns.left}% ${newPercentage}%`;
            }
        }
        
        function onMouseUp() {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            document.body.classList.remove('resizing');
        }
        
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
        document.body.classList.add('resizing');
    });
    
    // Bottom panel resize
    bottomPanelResizer.addEventListener('mousedown', function(e) {
        e.preventDefault();
        
        const startY = e.clientY;
        const startHeight = bottomPanel.offsetHeight;
        
        function onMouseMove(moveEvent) {
            const deltaY = startY - moveEvent.clientY;
            const newHeight = Math.max(MIN_HEIGHT, startHeight + deltaY);
            
            // Update bottom row height
            mainContent.style.gridTemplateRows = `1fr ${newHeight}px`;
        }
        
        function onMouseUp() {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            document.body.classList.remove('resizing');
        }
        
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
        document.body.classList.add('resizing');
    });
}
