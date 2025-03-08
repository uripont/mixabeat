import { initializeRoomState } from './room-state.js';
import { initializeWebSocket } from './websocket.js';
import { initializePanelResizing } from './panel-resizer.js';

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
        // First initialize shared state
        console.log('Initializing room state...');
        initializeRoomState();
        
        // Initialize WebSocket connection
        console.log('Initializing WebSocket connection...');
        const ws = await initializeWebSocket(token, roomId);
        
        // Store WebSocket reference in room state
        window.roomState.ws = ws;
        
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

        // Initialize navigation
        const backButton = document.querySelector('.action-btn[title="Back to Rooms"]');
        if (backButton) {
            backButton.addEventListener('click', () => {
                window.location.href = '../index.html';
            });
        }

        // Cleanup on page unload
        window.addEventListener('beforeunload', () => {
            cleanupPlayback();
        });
            
    } catch (error) {
        console.error('Failed to initialize room:', error);
        alert('Failed to connect to room. Please try again.');
        window.location.href = '../index.html';
        return;
    }
});
