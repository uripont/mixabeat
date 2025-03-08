import { requireAuth } from '../utils/auth.js';
import { logout } from '../auth/auth-api.js';
import { listRooms, createRoom, joinRoom } from './search-api.js';

// UI Elements
const errorMessageElement = document.getElementById('error-message');
const usernameDisplay = document.getElementById('username-display');
const logoutBtn = document.getElementById('logout-btn');
const createRoomBtn = document.getElementById('create-room-btn');
const joinRoomBtn = document.getElementById('join-room-btn');
const songNameInput = document.getElementById('song-name');
const searchNameInput = document.getElementById('search-name');
const roomIdInput = document.getElementById('room-id');
const roomsGrid = document.getElementById('rooms-grid');

// Store rooms for filtering
let currentRooms = [];

// Initialize page
async function initializePage() {
    console.log('Checking auth for room access...');
    
    // Check auth first
    if (!(await requireAuth())) {
        console.log('Auth check failed, page will redirect');
        return;
    }

    console.log('Auth valid, initializing room selection...');

    // Display username
    const username = localStorage.getItem('username');
    usernameDisplay.textContent = username;

    // Display authToken
    const authToken = localStorage.getItem('authToken');
    console.log('Room List - authToken:', authToken);
    
    if (!authToken) {
        console.error('AuthToken not found in localStorage on room page load!');
    }

    // Load rooms
    await loadRooms();
}

// Helper functions
function showError(message) {
    errorMessageElement.textContent = message;
    errorMessageElement.classList.remove('hidden');
    setTimeout(() => {
        errorMessageElement.classList.add('hidden');
    }, 5000);
}

function setLoading(button, isLoading) {
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

// Event handlers
async function handleCreateRoom() {
    const songName = songNameInput.value.trim();
    if (!songName) {
        showError('Please enter a song name');
        return;
    }
    
    try {
        console.log('Creating room:', songName);
        setLoading(createRoomBtn, true);
        const result = await createRoom(songName);
        console.log('Room created successfully:', result);
        console.log('Joining newly created room...');
        await handleJoinRoom(result.roomId);
    } catch (error) {
        console.error('Error creating room:', error);
        showError(error.message || 'Failed to create room');
    } finally {
        setLoading(createRoomBtn, false);
    }
}

async function handleJoinRoom(roomId) {
    try {
        roomId = parseInt(roomId);
        if (isNaN(roomId)) {
            throw new Error('Invalid room ID');
        }
        
        console.log('Joining room:', roomId);
        await joinRoom(roomId);
        console.log('Join successful, redirecting to room layout...');
        window.location.href = `../room/layout.html?roomId=${roomId}`;
    } catch (error) {
        console.error('Error joining room:', error);
        showError(error.message || 'Failed to join room');
    }
}

async function handleJoinById() {
    const roomId = parseInt(roomIdInput.value.trim());
    if (!roomId || isNaN(roomId)) {
        showError('Please enter a valid room ID');
        return;
    }
    
    try {
        console.log('Joining room by ID:', roomId);
        setLoading(joinRoomBtn, true);
        await handleJoinRoom(roomId);
    } catch (error) {
        console.error('Error joining room:', error);
        showError(error.message || 'Failed to join room');
    } finally {
        setLoading(joinRoomBtn, false);
    }
}

async function handleLogout() {
    try {
        console.log('Logging out...');
        await logout();
        console.log('Logout successful, redirecting to landing');
        window.location.href = '../index.html';
    } catch (error) {
        console.error('Error logging out:', error);
        showError(error.message || 'Failed to logout');
    }
}

// Event listeners
createRoomBtn.addEventListener('click', handleCreateRoom);
joinRoomBtn.addEventListener('click', handleJoinById);
logoutBtn.addEventListener('click', handleLogout);
searchNameInput.addEventListener('input', filterAndDisplayRooms);

// Auto-refresh rooms list periodically
setInterval(() => {
    console.log('Auto-refresh: fetching room list...');
    loadRooms();
}, 10000);

// Initialize page on load
document.addEventListener('DOMContentLoaded', initializePage);
