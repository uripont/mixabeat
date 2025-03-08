import { initializeWebSocket } from './room-state.js';
import { initializePanelResizing } from './panel-resizer.js';

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
    
    // Initialize panel resizing
    initializePanelResizing();

    try {
        // Initialize WebSocket connection and wait for room join
        console.log('Initializing WebSocket connection...');
        await initializeWebSocket(token, roomId);
        
        // Load chat component template
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
            
    } catch (error) {
        console.error('Failed to initialize room:', error);
        alert('Failed to connect to room. Please try again.');
        window.location.href = '../index.html';
        return;
    }

    // Initialize UI event listeners
    const backButton = document.querySelector('.action-btn[title="Back to Rooms"]');
    if (backButton) {
        backButton.addEventListener('click', () => {
            window.location.href = '../index.html';
        });
    }

    // Initialize playback controls
    const playButton = document.querySelector('.play-btn');
    const stopButton = document.querySelector('.stop-btn');
    const restartButton = document.querySelector('.restart-btn');
    const timer = document.querySelector('.timer');

    if (playButton) {
        playButton.addEventListener('click', () => {
            const icon = playButton.querySelector('i');
            if (icon.classList.contains('fa-play')) {
                icon.classList.remove('fa-play');
                icon.classList.add('fa-pause');
            } else {
                icon.classList.remove('fa-pause');
                icon.classList.add('fa-play');
            }
        });
    }

    if (stopButton) {
        stopButton.addEventListener('click', () => {
            const playIcon = playButton.querySelector('i');
            if (playIcon.classList.contains('fa-pause')) {
                playIcon.classList.remove('fa-pause');
                playIcon.classList.add('fa-play');
            }
        });
    }

    if (restartButton) {
        restartButton.addEventListener('click', () => {
            timer.textContent = '00:00';
            const playIcon = playButton.querySelector('i');
            if (playIcon.classList.contains('fa-pause')) {
                playIcon.classList.remove('fa-pause');
                playIcon.classList.add('fa-play');
            }
        });
    }
});
