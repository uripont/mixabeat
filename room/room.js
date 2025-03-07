import { requireAuth } from '../utils/auth.js';
import { logout } from '../auth/auth-api.js';
import { listRooms, createRoom, joinRoom } from './room-api.js';
import { initializeWebSocket } from '../websocket.js';

// UI Elements
const errorMessageElement = document.getElementById('error-message');
const usernameDisplay = document.getElementById('username-display');
const logoutBtn = document.getElementById('logout-btn');
const createRoomBtn = document.getElementById('create-room-btn');
const joinRoomBtn = document.getElementById('join-room-btn');
const songNameInput = document.getElementById('song-name');
const roomNameInput = document.getElementById('room-name');
const roomsGrid = document.getElementById('rooms-grid');

// Initialize page
async function initializePage() {
    // Check auth first
    if (!(await requireAuth())) {
        return; // Page will redirect
    }

    // Display username
    const username = localStorage.getItem('username');
    usernameDisplay.textContent = username;

    // Load rooms
    await loadRooms();

    // Initialize WebSocket
    const token = localStorage.getItem('token');
    initializeWebSocket(token);
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
        const { rooms } = await listRooms();
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
        roomInfo.textContent = `Created by: ${room.createdBy}`;
        
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
        setLoading(createRoomBtn, true);
        const result = await createRoom(songName);
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
        await joinRoom(roomId);
        window.location.href = `/index.html?roomId=${roomId}`;
    } catch (error) {
        console.error('Error joining room:', error);
        showError(error.message || 'Failed to join room');
    }
}

async function handleJoinByName() {
    const roomName = roomNameInput.value.trim();
    if (!roomName) {
        showError('Please enter a room name');
        return;
    }
    
    try {
        setLoading(joinRoomBtn, true);
        const { rooms } = await listRooms();
        const room = rooms.find(r => r.songName === roomName);
        
        if (!room) {
            throw new Error('Room not found');
        }
        
        await handleJoinRoom(room.roomId);
    } catch (error) {
        console.error('Error joining room:', error);
        showError(error.message || 'Failed to join room');
    } finally {
        setLoading(joinRoomBtn, false);
    }
}

async function handleLogout() {
    try {
        await logout();
        window.location.href = '/index.html';
    } catch (error) {
        console.error('Error logging out:', error);
        showError(error.message || 'Failed to logout');
    }
}

// Event listeners
createRoomBtn.addEventListener('click', handleCreateRoom);
joinRoomBtn.addEventListener('click', handleJoinByName);
logoutBtn.addEventListener('click', handleLogout);

// Auto-refresh rooms list periodically
setInterval(loadRooms, 10000);

// Initialize page on load
document.addEventListener('DOMContentLoaded', initializePage);
