import { config } from '../config.js';

// Initialize WebSocket connection
export async function initializeWebSocket(token, roomId) {
    const WS_URL = `${config.WS_BASE_URL}/ws?token=${token}`;
    const ws = new WebSocket(WS_URL);
    
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
                    
                    switch (data.type) {
                        // Core state updates
                        case 'room_joined':
                            console.log('Room joined successfully:', data);
                            // Filter uniqueness in the state update
                            const uniqueUsers = [];
                            const userIds = new Set();
                            (data.connectedUsers || []).forEach(user => {
                                if (user.userId && !userIds.has(user.userId)) {
                                    userIds.add(user.userId);
                                    uniqueUsers.push(user);
                                }
                            });
                            window.roomState.updateUsers(uniqueUsers);
                            break;

                        case 'user_joined':
                            window.roomState.updateUsers([
                                ...window.roomState.users,
                                {
                                    userId: data.userId,
                                    username: data.username
                                }
                            ]);
                            break;

                        case 'user_left':
                            window.roomState.updateUsers(
                                window.roomState.users.filter(u => u.userId !== data.userId)
                            );
                            break;

                        case 'mouse_position':
                            window.roomState.updateMousePosition(data.userId, data.position);
                            break;

                        case 'track_added':
                            window.roomState.addTrack(data.track);
                            break;

                        case 'track_updated':
                            window.roomState.updateTracks(data.trackId, data.changes);
                            break;

                        case 'track_removed':
                            window.roomState.removeTrack(data.trackId);
                            break;

                        // Other events bubble up as ws:type events
                        default:
                            window.dispatchEvent(new CustomEvent('ws:' + data.type, {
                                detail: data
                            }));
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
            // Let components handle reconnection if needed
            window.dispatchEvent(new CustomEvent('ws:disconnected'));
        };

        ws.onerror = (error) => {
            console.error('WebSocket error:', error);
            window.dispatchEvent(new CustomEvent('ws:error', {
                detail: error
            }));
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
        window.dispatchEvent(new CustomEvent('ws:error', {
            detail: error
        }));
    }
}
