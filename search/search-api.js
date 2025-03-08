import { config } from '../config.js';

export async function listRooms() {
    const token = localStorage.getItem('authToken');
    console.log('listRooms - authToken:', token);
    if (!token) throw new Error('Authentication required');

    const response = await fetch(`${config.API_BASE_URL}/rooms`, {
        headers: {
            'Authorization': `${token}`,
            'Accept': 'application/json'
        }
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Failed to fetch rooms');
    }

    return await response.json();
}

export async function createRoom(songName) {
    const token = localStorage.getItem('authToken');
    console.log('createRoom - authToken:', token);
    if (!token) throw new Error('Authentication required');

    const response = await fetch(`${config.API_BASE_URL}/rooms`, {
        method: 'POST',
        headers: {
            'Authorization': `${token}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        },
        body: JSON.stringify({ songName })
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Failed to create room');
    }

    return await response.json();
}

export async function joinRoom(roomId) {
    const token = localStorage.getItem('authToken');
    console.log('joinRoom - authToken:', token);
    if (!token) throw new Error('Authentication required');

    const response = await fetch(`${config.API_BASE_URL}/rooms/${roomId}/join`, {
        method: 'PUT',
        headers: {
            'Authorization': `${token}`,
            'Accept': 'application/json'
        }
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Failed to join room');
    }

    return await response.json();
}
