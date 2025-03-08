import { config } from '../config.js';

// Initialize WebSocket connection
async function initializeWebSocket(token, roomId) {
    const WS_URL = `${config.WS_BASE_URL}/ws?token=${token}`;
    
    const ws = new WebSocket(WS_URL);
    
    // Set auth token in localStorage for components to access
    window.authToken = token;
    
    // Store globally for components to access
    // Initialize room state
    window.roomState = {
        ws,
        userId: localStorage.getItem('userId'),
        connectedUsers: [],
        subscribers: [],
        
        // Update state and notify subscribers
        update(changes) {
            Object.assign(this, changes);
            this.notifySubscribers();
        },
        
        // Subscribe to state changes
        subscribe(callback) {
            this.subscribers.push(callback);
            // Call immediately with current state
            callback(this);
            return () => {
                this.subscribers = this.subscribers.filter(cb => cb !== callback);
            };
        },
        
        // Notify all subscribers
        notifySubscribers() {
            this.subscribers.forEach(callback => callback(this));
        }
    };

    return new Promise((resolve, reject) => {
        ws.onopen = () => {
            console.log('WebSocket connected');
            
            // Send join_room message once connected
            ws.send(JSON.stringify({
                type: 'join_room',
                roomId: parseInt(roomId) // Backend expects roomId as number
            }));

            // Handle WebSocket messages at layout level
            // Only room status events (join/leave) are handled here
            // Chat messages are handled by chat.js
            ws.addEventListener('message', (event) => {
                try {
                    const data = JSON.parse(event.data);
                    console.log('WebSocket message received:', data);
                    
                    switch (data.type) {
                        case 'room_joined':
                            console.log('Room joined successfully:', data);
                            // Use the backend-provided list directly, ensuring no duplicates
                            const uniqueUsers = [];
                            const userIds = new Set();
                            
                            // Filter out duplicates by userId
                            (data.connectedUsers || []).forEach(user => {
                                if (user.userId && !userIds.has(user.userId)) {
                                    userIds.add(user.userId);
                                    uniqueUsers.push(user);
                                }
                            });
                            
                            window.roomState.update({
                                connectedUsers: uniqueUsers
                            });
                            break;

                        case 'user_joined':
                            console.log('User joined:', data);
                            // Create a user object from the data
                            const joinedUser = {
                                userId: data.userId,
                                username: data.username
                            };
                            
                            // Update the connected users list
                            const updatedUsersAfterJoin = [...(window.roomState.connectedUsers || [])];
                            // Check if user already exists to avoid duplicates
                            if (!updatedUsersAfterJoin.some(user => user.userId === joinedUser.userId)) {
                                updatedUsersAfterJoin.push(joinedUser);
                            }
                            
                            window.roomState.update({
                                connectedUsers: updatedUsersAfterJoin
                            });
                            break;

                        case 'user_left':
                            console.log('User left:', data);
                            // Remove the user from the connected users list
                            const updatedUsersAfterLeave = (window.roomState.connectedUsers || [])
                                .filter(user => user.userId !== data.userId);
                            
                            window.roomState.update({
                                connectedUsers: updatedUsersAfterLeave
                            });
                            break;
                    }
                } catch (error) {
                    console.error('Error handling WebSocket message:', error);
                }
            });
            
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
