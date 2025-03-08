import { requireAuth } from '../utils/auth.js';
import { logout } from '../auth/auth-api.js';
import { createRoom, joinRoom } from './search-api.js';
import { showError, setLoading, loadRooms } from './search-list.js';

// UI Elements
const usernameDisplay = document.getElementById('username-display');
const logoutBtn = document.getElementById('logout-btn');
const createRoomBtn = document.getElementById('create-room-btn');
const joinRoomBtn = document.getElementById('join-room-btn');
const songNameInput = document.getElementById('song-name');
const roomIdInput = document.getElementById('room-id');

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

// Event handlers
export async function handleJoinRoom(roomId) {
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

// Initialize page on load
document.addEventListener('DOMContentLoaded', initializePage);
