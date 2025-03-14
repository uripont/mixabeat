import { initializeRoomState } from './room-state.js';
import { initializeWebSocket } from './websocket.js';
import { initializePanelResizing } from './panel-resizer.js';
import { initializeSoundPicker } from './sound-picker/sound-picker.js';

// Initialize playback controls and bind to shared state
function initializePlaybackControls() {
    const playButton = document.querySelector('.play-btn');
    const stopButton = document.querySelector('.stop-btn');
    const restartButton = document.querySelector('.restart-btn');
    const timer = document.querySelector('.timer');

    // Watch playback state changes
    const cleanupPlayback = window.roomState.watchPlayback(state => {
        // Update play/pause button icon
        const icon = playButton.querySelector('i');
        if (state.isPlaying) {
            icon.classList.remove('fa-play');
            icon.classList.add('fa-pause');
        } else {
            icon.classList.remove('fa-pause');
            icon.classList.add('fa-play');
        }

        // Update timer display
        const minutes = Math.floor(state.currentTime / 60);
        const seconds = Math.floor(state.currentTime % 60);
        timer.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    });

    // Playback control handlers
    if (playButton) {
        playButton.addEventListener('click', () => {
            const currentState = window.roomState.playback;
            window.roomState.updatePlayback({
                isPlaying: !currentState.isPlaying
            });
        });
    }

    if (stopButton) {
        stopButton.addEventListener('click', () => {
            window.roomState.updatePlayback({
                isPlaying: false,
                currentTime: 0
            });
        });
    }

    if (restartButton) {
        restartButton.addEventListener('click', () => {
            window.roomState.updatePlayback({
                currentTime: 0
            });
        });
    }

    return cleanupPlayback;
}

document.addEventListener('DOMContentLoaded', async () => {
    // Get roomId from URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const roomId = urlParams.get('roomId');

    if (!roomId) {
        console.error('No roomId provided');
        window.location.href = '../index.html';
        return;
    }

    // Get token from localStorage
    const token = localStorage.getItem('authToken');
    if (!token) {
        console.error('No auth token found');
        window.location.href = '../index.html';
        return;
    }

    console.log(`Initializing room ${roomId}`);
    
    try {
        // Initialize shared state with user info and room info
        console.log('Initializing room state...');
        const state = initializeRoomState();
        state.userId = parseInt(localStorage.getItem('userId'));
        state.roomId = parseInt(roomId);
        
        // Initialize WebSocket connection
        console.log('Initializing WebSocket connection...');
        const ws = await initializeWebSocket(token, roomId);
        window.roomState.ws = ws;

        // Helper function to load template
        async function loadTemplate(url, containerId, templateId = null) {
            const response = await fetch(url);
            const html = await response.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            const template = doc.querySelector(templateId || 'template');
            
            if (!template) {
                throw new Error(`Template not found in ${url}`);
            }

            const container = document.getElementById(containerId);
            if (!container) {
                throw new Error(`Container not found: ${containerId}`);
            }
            container.appendChild(template.content.cloneNode(true));
            return { container, template };
        }

        // Initialize panel layout first
        initializePanelResizing();

        // Wait for room state to be fully initialized
        console.log('Waiting for room state to be ready...');
        while (!window.roomState || !window.roomState.users) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        console.log('Room state ready');

        // Initialize all panels in sequence
        console.log('Loading sound picker...');
        await loadTemplate('sound-picker/sound-picker.html', 'soundPickerContainer', '#sound-picker-template');
        console.log('Initializing sound picker...');
        await initializeSoundPicker(ws);
        console.log('Sound picker initialized');

        console.log('Loading chat component...');
        const chatPanelSelector = '.right-panel .panel-content';
        const chatPanel = document.querySelector(chatPanelSelector);
        if (!chatPanel) {
            throw new Error('Chat panel container not found');
        }
        chatPanel.id = 'chatPanelContainer';
        await loadTemplate('chat/chat.html', 'chatPanelContainer');
        console.log('Initializing chat with users:', window.roomState.users);
        const chatModule = await import('./chat/chat.js');
        console.log('Chat module loaded');

        console.log('Loading canvas panel...');
        await loadTemplate('canvas/canvas.html', 'canvasPanelContainer');
        const canvasModule = await import('./canvas/canvas.js');
        canvasModule.initializeCanvas(window.roomState, ws);
        console.log('Canvas module loaded');

        // Initialize room info display
        function updateRoomInfo(roomInfo) {
            const roomInfoEl = document.querySelector('.room-info');
            if (roomInfoEl) {
                roomInfoEl.textContent = `Room #${roomInfo.roomId}`;
            }
        }

        // Watch for room info changes and update initial state
        window.addEventListener('state:room', (e) => updateRoomInfo(e.detail));
        updateRoomInfo({
            roomId: window.roomState.roomId,
            roomName: window.roomState.roomName
        });

        // Initialize shared playback controls
        const cleanupPlayback = initializePlaybackControls();

        // Initialize navigation
        const backButton = document.querySelector('.action-btn[title="Back to Rooms"]');
        if (backButton) {
            backButton.addEventListener('click', () => {
                window.location.href = '../search/search.html';
            });
        }

        // Cleanup on page unload
        window.addEventListener('beforeunload', () => {
            cleanupPlayback();
        });
            
    } catch (error) {
        console.error('Failed to initialize room:', error);
        
        // Handle different types of errors
        let errorMessage = 'An unexpected error occurred.';
        if (error.message.includes('WebSocket')) {
            errorMessage = error.message;
        } else if (error.message.includes('Chat template')) {
            errorMessage = 'Failed to load chat interface. Please refresh the page.';
        } else if (error.message.includes('Canvas template')) {
            errorMessage = 'Failed to load canvas interface. Please refresh the page.';
        }
        
        // Show error to user
        alert(errorMessage);
        
        // Only redirect for connection errors
        if (error.message.includes('WebSocket')) {
            window.location.href = '../search/search.html';
        }
        return;
    }
});
