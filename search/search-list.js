import { listRooms } from './search-api.js';
import { handleJoinRoom } from './search-actions.js';

// UI Elements
const errorMessageElement = document.getElementById('error-message');
const searchNameInput = document.getElementById('search-name');
const roomsGrid = document.getElementById('rooms-grid');

// Store rooms for filtering
let currentRooms = [];

// Helper functions
export function showError(message) {
    errorMessageElement.textContent = message;
    errorMessageElement.classList.remove('hidden');
    setTimeout(() => {
        errorMessageElement.classList.add('hidden');
    }, 5000);
}

export function setLoading(button, isLoading) {
    button.disabled = isLoading;
    button.textContent = isLoading ? 'Loading...' : button.textContent.replace('Loading...', button.dataset.originalText || 'Submit');
    if (!isLoading) button.dataset.originalText = button.textContent;
}

async function loadRooms() {
    try {
        console.log('Fetching room list...');
        const { rooms } = await listRooms();
        console.log(`Received ${rooms.length} rooms:`, rooms);
        if (rooms.length > 0) {
            console.log('Sample room data:', JSON.stringify(rooms[0], null, 2));
        }
        currentRooms = rooms;
        filterAndDisplayRooms();
    } catch (error) {
        console.error('Error loading rooms:', error);
        showError(error.message || 'Failed to load rooms');
    }
}

function filterAndDisplayRooms() {
    const searchTerm = searchNameInput.value.toLowerCase().trim();
    const filteredRooms = searchTerm 
        ? currentRooms.filter(room => {
            const searchableText = [
                room.song_name,    // DB column name
                room.songName,     // Camel case variant
                room.name          // Fallback
            ].filter(Boolean).join(' ').toLowerCase();
            return searchableText.includes(searchTerm);
        })
        : currentRooms;
    
    console.log(`Filtered ${currentRooms.length} rooms to ${filteredRooms.length} results for term: "${searchTerm}"`);
    
    roomsGrid.innerHTML = '';
    
    if (filteredRooms.length === 0) {
        const noRoomsMessage = document.createElement('div');
        noRoomsMessage.className = 'no-rooms-message';
        noRoomsMessage.textContent = searchTerm 
            ? 'No rooms match your search'
            : 'No rooms available';
        roomsGrid.appendChild(noRoomsMessage);
        return;
    }
    
    filteredRooms.forEach(room => {
        const roomCard = document.createElement('div');
        roomCard.className = 'room-card';
        
        const roomName = document.createElement('div');
        roomName.className = 'room-name';
        roomName.textContent = room.song_name || room.songName || room.name || 'Unnamed Room';
        
        const roomInfo = document.createElement('div');
        roomInfo.className = 'room-info';
        roomInfo.textContent = `Created by: ${room.createdBy || room.created_by || 'Unknown'} (ID: ${room.roomId || room.room_id})`;
        
        const joinButton = document.createElement('button');
        joinButton.textContent = 'Join Room';
        joinButton.onclick = () => handleJoinRoom(room.roomId || room.room_id);
        
        roomCard.appendChild(roomName);
        roomCard.appendChild(roomInfo);
        roomCard.appendChild(joinButton);
        
        roomsGrid.appendChild(roomCard);
    });
}

// Search event listener
searchNameInput.addEventListener('input', filterAndDisplayRooms);

// Auto-refresh rooms list periodically
setInterval(() => {
    console.log('Auto-refresh: fetching room list...');
    loadRooms();
}, 10000);

export { loadRooms };
