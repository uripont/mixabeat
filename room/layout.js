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
        state.userId = parseInt(localStorage.getItem('userId')); // Keep userId in state to check track ownership
        state.roomId = parseInt(roomId); // Keep roomId in state for WebSocket messages
        
        // Initialize WebSocket connection
        console.log('Initializing WebSocket connection...');
        const ws = await initializeWebSocket(token, roomId);
        
        // Store WebSocket reference in room state
        window.roomState.ws = ws;

        // Initialize sound picker
        initializeSoundPicker(ws);
        
        // Initialize panel layout
        initializePanelResizing();
        
        // Load chat component
        const chatResponse = await fetch('chat/chat.html');
        const chatHtml = await chatResponse.text();
        
        // Create temporary container to parse HTML
        const parser = new DOMParser();
        const doc = parser.parseFromString(chatHtml, 'text/html');
        const template = doc.querySelector('template');
        
        if (template) {
            const chatPanel = document.querySelector('.right-panel .panel-content');
            chatPanel.appendChild(template.content.cloneNode(true));
            
            // Import and initialize chat module
            const chatModule = await import('./chat/chat.js');
            console.log('Chat module loaded');
        } else {
            throw new Error('Chat template not found');
        }

        // Initialize shared playback controls
        const cleanupPlayback = initializePlaybackControls();

        // Load canvas panel
        fetch('canvas/canvas.html')
            .then(response => response.text())
            .then(async html => { // Make callback async
                // Create temporary container to parse HTML
                const parser = new DOMParser();
                const doc = parser.parseFromString(html, 'text/html');
                const template = doc.querySelector('template');
                
                if (template) {
            const canvasPanel = document.querySelector('#canvasPanelContainer');
            canvasPanel.appendChild(template.content.cloneNode(true));
                    
                    // Import and initialize canvas module
                    const canvasModule = await import('./canvas/canvas.js');
                    canvasModule.initializeCanvas(window.roomState, window.roomState.ws);
                    console.log('Canvas module loaded');
                } else {
                    throw new Error('Canvas template not found');
                }
            })
            .catch(error => console.error('Error loading canvas panel:', error));


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
