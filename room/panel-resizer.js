// Panel resizing functionality
export function initializePanelResizing() {
    const leftPanel = document.querySelector('.left-panel');
    const rightPanel = document.querySelector('.right-panel');
    const bottomPanel = document.querySelector('.bottom-panel');
    const mainContent = document.querySelector('.main-content');
    
    // Create and append resize handles
    const leftPanelResizer = document.createElement('div');
    leftPanelResizer.className = 'panel-resizer left-resizer';
    leftPanel.appendChild(leftPanelResizer);
    
    const rightPanelResizer = document.createElement('div');
    rightPanelResizer.className = 'panel-resizer right-resizer';
    rightPanel.appendChild(rightPanelResizer);
    
    const bottomPanelResizer = document.createElement('div');
    bottomPanelResizer.className = 'panel-resizer bottom-resizer';
    bottomPanel.appendChild(bottomPanelResizer);
    
    // Panel size constraints
    const MIN_WIDTH = 150;
    const MIN_HEIGHT = 100;
    const MAX_SIDE_PERCENTAGE = 40;
    
    // Internal layout state (only used here, no need to react to this from other places)
    const layout = {
        columns: {
            left: 20,
            center: 55,
            right: 25
        },
        rows: {
            top: 'auto',
            bottom: 200
        }
    };

    // Apply layout to grid
    function applyLayout() {
        mainContent.style.gridTemplateColumns = 
            `${layout.columns.left}% ${layout.columns.center}% ${layout.columns.right}%`;
        
        if (typeof layout.rows.bottom === 'number') {
            mainContent.style.gridTemplateRows = `1fr ${layout.rows.bottom}px`;
        }
    }

    // Initial layout
    applyLayout();
    
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
            if (newPercentage < MAX_SIDE_PERCENTAGE) {
                layout.columns.left = newPercentage;
                layout.columns.center = 100 - newPercentage - layout.columns.right;
                applyLayout();
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
            
            // Limit to reasonable percentage
            if (newPercentage >= 17 && newPercentage <= 30) {
                layout.columns.right = newPercentage;
                layout.columns.center = 100 - newPercentage - layout.columns.left;
                applyLayout();
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
            
            layout.rows.bottom = newHeight;
            applyLayout();
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
