import { config } from '../../config.js';

// Get message history for a room
export async function getRoomMessages(roomId) {
    const authToken = localStorage.getItem('authToken');
    console.log('getRoomMessages - Retrieved authToken from localStorage:', authToken); // Log token retrieval

    if (!authToken) {
        console.warn('getRoomMessages - No authToken found in localStorage!'); // Warn if no token
    }

    const headers = {
        'Authorization': `${authToken}`
    };
    console.log('getRoomMessages - Constructed headers object:', headers); // Log headers object

    console.log('getRoomMessages - Fetch URL:', `${config.API_BASE_URL}/rooms/${roomId}/messages`); // Log fetch URL
    const response = await fetch(`${config.API_BASE_URL}/rooms/${roomId}/messages`, {
        headers: headers
    });
    console.log('getRoomMessages - Fetch Response Status:', response.status); // Log response status

    if (!response.ok) {
        const error = await response.json();
        console.error('getRoomMessages - Error response body:', error); // Log error response body
        throw new Error(error.message || 'Failed to fetch messages');
    }

    return response.json();
}
