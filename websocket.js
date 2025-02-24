// WebSocket connection and state
let activeWs = null;
let currentUsername = null;
let connectedUsers = new Set();
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_DELAY = 2000; // 2 seconds

function initializeWebSocket(token) {
    if (activeWs) {
        console.log('Closing existing connection');
        activeWs.close();
    }

    reconnectAttempts = 0;
    connectWebSocket(token);
}

function connectWebSocket(token) {
    try {
        console.log('Attempting WebSocket connection...');
        // Use the token in the URL, matching the server configuration
        activeWs = new WebSocket(`ws://20.26.232.219:3000?token=${token}`);
        
        activeWs.onopen = () => {
            console.log('Connected to WebSocket server');
            reconnectAttempts = 0;
        };

        activeWs.onmessage = (event) => {
            const message = JSON.parse(event.data);
            console.log('Received:', message);
            
            if (message.type === 'auth_success') {
                currentUsername = message.username;
                console.log('Authentication successful');
            } 
            else if (message.type === 'message') {
                // The server now sends messages with additional fields like messageId, userId, and timestamp.
                const chatBox = document.getElementById('chat-box');
                appendMessage(
                    message.username, 
                    message.message, 
                    message.timestamp, 
                    chatBox
                );
            } 
            else if (message.type === 'user_joined') {
                const chatBox = document.getElementById('chat-box');
                connectedUsers.add(message.username);
                updateUsersList();
                appendMessage('System', `${message.username} joined the chat`, new Date().toISOString(), chatBox);
            } 
            else if (message.type === 'user_left') {
                const chatBox = document.getElementById('chat-box');
                connectedUsers.delete(message.username);
                updateUsersList();
                appendMessage('System', `${message.username} left the chat`, new Date().toISOString(), chatBox);
            }
            else if (message.type === 'error') {
                console.error('WebSocket error:', message.error);
                alert('Error: ' + message.error);
            }
        };

        activeWs.onerror = (error) => {
            console.error('WebSocket error:', error);
        };

        activeWs.onclose = (event) => {
            console.log(`WebSocket closed with code ${event.code}:`, event.reason);
            
            if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
                console.log(`Attempting to reconnect (${reconnectAttempts + 1}/${MAX_RECONNECT_ATTEMPTS})...`);
                reconnectAttempts++;
                setTimeout(() => connectWebSocket(token), RECONNECT_DELAY);
            } else {
                console.error('Max reconnection attempts reached');
                alert('Connection lost. Please refresh the page to reconnect.');
            }
        };
    } catch (error) {
        console.error('Error creating WebSocket:', error);
    }

    return activeWs;
}

function sendChatMessage(message) {
    if (!activeWs || activeWs.readyState !== WebSocket.OPEN) {
        console.error('WebSocket not connected');
        alert('Connection lost. Please wait while we reconnect...');
        return false;
    }

    // The client still sends messages in a simple format. The server will enrich the message details.
    activeWs.send(JSON.stringify({
        type: 'message',
        message: message
    }));
    return true;
}

// Helper function to append messages to the chat box.
// Now it includes the timestamp as part of the displayed message.
function appendMessage(sender, message, timestamp, chatBox) {
    const msg = document.createElement('div');
    // Format: "username (time): message"
    const timeString = new Date(timestamp).toLocaleTimeString();
    msg.textContent = `${sender} (${timeString}): ${message}`;
    chatBox.appendChild(msg);
    chatBox.scrollTop = chatBox.scrollHeight;
}

function updateUsersList() {
    const userList = document.getElementById('users');
    if (!userList) return;

    userList.innerHTML = '';
    connectedUsers.forEach(username => {
        const li = document.createElement('li');
        li.textContent = username === currentUsername ? `${username} (You)` : username;
        userList.appendChild(li);
    });
}

export { 
    initializeWebSocket, 
    sendChatMessage,
    connectedUsers,
    currentUsername 
};