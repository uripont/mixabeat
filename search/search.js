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
const roomIdInput = document.getElementById('room-id');
const roomsGrid = document.getElementById('rooms-grid');

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
    console.log('Room List - authToken:', authToken); // Log authToken
    
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
        console.log(`Received ${rooms.length} rooms`);
        displayRooms(rooms);
    } catch (error) {
        console.error('Error loading rooms:', error);
        showError(error.message || 'Failed to load rooms');
    }
}

function displayRooms(rooms) {
    roomsGrid.innerHTML = '';
    
    rooms.forEach(room => {
        const roomCard = document.createElement('div');
        roomCard.className = 'room-card';
        
        const roomName = document.createElement('div');
        roomName.className = 'room-name';
        roomName.textContent = room.songName;
        
        const roomInfo = document.createElement('div');
        roomInfo.className = 'room-info';
        roomInfo.textContent = `Created by: ${room.createdBy || 'Unknown'}`;
        
        const joinButton = document.createElement('button');
        joinButton.textContent = 'Join Room';
        joinButton.onclick = () => handleJoinRoom(room.roomId);
        
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
        console.log('Room created successfully');
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
    const roomId = roomIdInput.value.trim();
    if (!roomId) {
        showError('Please enter a room ID');
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

// Auto-refresh rooms list periodically
setInterval(() => {
    console.log('Auto-refresh: fetching room list...');
    loadRooms();
}, 10000);

// Initialize page on load
document.addEventListener('DOMContentLoaded', initializePage);
