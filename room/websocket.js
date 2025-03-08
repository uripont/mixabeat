import { config } from '../config.js';

// Initialize WebSocket connection
export async function initializeWebSocket(token, roomId) {
    const WS_URL = `${config.WS_BASE_URL}/ws?token=${token}`;
    
    const ws = new WebSocket(WS_URL);
    
    // Set auth token in localStorage for components to access
    window.authToken = token;
    
    return new Promise((resolve, reject) => {
        ws.onopen = () => {
            console.log('WebSocket connected');
            
            // Send join_room message once connected
            ws.send(JSON.stringify({
                type: 'join_room',
                roomId: parseInt(roomId) // Backend expects roomId as number
            }));

            // Handle WebSocket messages
            ws.addEventListener('message', (event) => {
                try {
                    const data = JSON.parse(event.data);
                    console.log('WebSocket message received:', data);
                    
                    // Handle different message types
                    switch (data.type) {
                        case 'room_joined':
                            console.log('Room joined successfully:', data);
                            // Filter out duplicates by userId
                            const uniqueUsers = [];
                            const userIds = new Set();
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
                            window.roomState.addUser({
                                userId: data.userId,
                                username: data.username
                            });
                            break;

                        case 'user_left':
                            console.log('User left:', data);
                            window.roomState.removeUser(data.userId);
                            break;

                        case 'track_added':
                            console.log('Track added:', data);
                            window.roomState.addTrack(data.track);
                            break;

                        case 'track_updated':
                            console.log('Track updated:', data);
                            window.roomState.updateTrack(data.trackId, data.changes);
                            break;

                        case 'track_removed':
                            console.log('Track removed:', data);
                            window.roomState.removeTrack(data.trackId);
                            break;

                        // Other panels can handle their specific message types
                        case 'chat_message':
                        case 'mouse_move':
                        default:
                            // Let event bubble up for other handlers
                            const customEvent = new CustomEvent('ws_message', { 
                                detail: data 
                            });
                            window.dispatchEvent(customEvent);
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

// Helper to send WebSocket messages
export function sendMessage(ws, type, data = {}) {
    if (!ws) {
        console.error('WebSocket not initialized');
        return;
    }
    
    try {
        ws.send(JSON.stringify({
            type,
            ...data
        }));
    } catch (error) {
        console.error('Error sending WebSocket message:', error);
    }
}
