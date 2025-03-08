import { config } from '../../config.js';

// Get message history for a room
export async function getRoomMessages(roomId) {
    const response = await fetch(`${config.API_BASE_URL}/rooms/${roomId}/messages`, {
        headers: {
            'Authorization': `Bearer ${window.authToken}`
        }
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to fetch messages');
    }

    return response.json();
}
