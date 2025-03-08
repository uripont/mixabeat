import { config } from '../config.js';

// Initialize WebSocket connection
async function initializeWebSocket(token, roomId) {
    const WS_URL = `${config.WS_BASE_URL}/ws?token=${token}`;
    
    const ws = new WebSocket(WS_URL);
    
    // Set auth token in localStorage for components to access
    window.authToken = token;
    
    // Store globally for components to access
    window.ws = ws;
    window.userId = localStorage.getItem('userId');

    return new Promise((resolve, reject) => {
        ws.onopen = () => {
            console.log('WebSocket connected');
            
            // Send join_room message once connected
            ws.send(JSON.stringify({
                type: 'join_room',
                roomId: roomId
            }));
            
            resolve(ws);
        };

        ws.onclose = () => {
            console.log('WebSocket disconnected');
        };

        ws.onerror = (error) => {
            console.error('WebSocket error:', error);
            reject(error);
        };
    });
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
        // Initialize WebSocket connection
        await initializeWebSocket(token, roomId);
        
        // Load chat component
        fetch('chat/chat.html')
            .then(response => response.text())
            .then(html => {
                document.querySelector('.right-panel .panel-content').innerHTML = html;
            })
            .catch(error => console.error('Error loading chat:', error));
            
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
