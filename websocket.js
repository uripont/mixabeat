// WebSocket connection and state
let activeWs = null;
let currentUsername = null;
let connectedUsers = new Set();
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_DELAY = 2000; // 2 seconds

// Promises for room joining
let roomJoinResolve = null;
let roomJoinReject = null;

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
                // Display received messages with bubble styling
                const chatBox = document.getElementById('chat-box');
                if (chatBox && message.username !== currentUsername) { // Only display messages from others
                    const msgContainer = document.createElement('div');
                    msgContainer.className = 'message-container';
                    
                    const senderLabel = document.createElement('div');
                    senderLabel.className = 'message-sender';
                    senderLabel.textContent = message.username;
                    
                    const msgBubble = document.createElement('div');
                    msgBubble.className = `message-bubble message-received`;
                    msgBubble.textContent = message.message;
                    
                    msgContainer.appendChild(senderLabel);
                    msgContainer.appendChild(msgBubble);
                    chatBox.appendChild(msgContainer);
                    chatBox.scrollTop = chatBox.scrollHeight;
                }
            } 
            else if (message.type === 'room_joined') {
                // Clear and update connected users list with the full list from server
                connectedUsers.clear();
                    message.connectedUsers.forEach(user => {
                    connectedUsers.add(user.username);
                    });
                updateUsersList();
                
                // Resolve the join room promise with the user list
                if (roomJoinResolve) {
                    roomJoinResolve(message.connectedUsers);
                    roomJoinResolve = null;
                    roomJoinReject = null;
                }
                
                // Announce in chat that connection was successful
                const chatBox = document.getElementById('chat-box');
                if (chatBox) {
                    const msgContainer = document.createElement('div');
                    msgContainer.className = 'message-container';
                    
                    const senderLabel = document.createElement('div');
                    senderLabel.className = 'message-sender';
                    senderLabel.textContent = 'System';
                    
                    const msgBubble = document.createElement('div');
                    msgBubble.className = 'message-bubble message-received';
                    msgBubble.textContent = `Joined the room`;
                    
                    msgContainer.appendChild(senderLabel);
                    msgContainer.appendChild(msgBubble);
                    chatBox.appendChild(msgContainer);
                    chatBox.scrollTop = chatBox.scrollHeight;
                }
            }
            else if (message.type === 'user_joined') {
                console.log('User joined, currentUsername:', currentUsername, 'joining username:', message.username);
                const chatBox = document.getElementById('chat-box');
                if (message.username !== currentUsername) {
                    console.log('Adding newly joined user:', message.username);
                    connectedUsers.add(message.username);
                    updateUsersList();
                } else {
                    console.log('Skipping own username from user_joined:', message.username);
                }
                if (chatBox) {
                    const msgContainer = document.createElement('div');
                    msgContainer.className = 'message-container';
                    
                    const senderLabel = document.createElement('div');
                    senderLabel.className = 'message-sender';
                    senderLabel.textContent = 'System';
                    
                    const msgBubble = document.createElement('div');
                    msgBubble.className = 'message-bubble message-received';
                    msgBubble.textContent = `${message.username} joined the chat`;
                    
                    msgContainer.appendChild(senderLabel);
                    msgContainer.appendChild(msgBubble);
                    chatBox.appendChild(msgContainer);
                    chatBox.scrollTop = chatBox.scrollHeight;
                }
            }
            else if (message.type === 'user_left') {
                const chatBox = document.getElementById('chat-box');
                connectedUsers.delete(message.username);
                updateUsersList();
                if (chatBox) {
                    const msgContainer = document.createElement('div');
                    msgContainer.className = 'message-container';
                    
                    const senderLabel = document.createElement('div');
                    senderLabel.className = 'message-sender';
                    senderLabel.textContent = 'System';
                    
                    const msgBubble = document.createElement('div');
                    msgBubble.className = 'message-bubble message-received';
                    msgBubble.textContent = `${message.username} left the chat`;
                    
                    msgContainer.appendChild(senderLabel);
                    msgContainer.appendChild(msgBubble);
                    chatBox.appendChild(msgContainer);
                    chatBox.scrollTop = chatBox.scrollHeight;
                }
            }
            else if (message.type === 'error') {
                console.error('WebSocket error:', message.error);
                if (roomJoinReject) {
                    roomJoinReject(new Error(message.error));
                    roomJoinResolve = null;
                    roomJoinReject = null;
                }
                alert('Error: ' + message.error);
            }
        };

        activeWs.onerror = (error) => {
            console.error('WebSocket error:', error);
            if (roomJoinReject) {
                roomJoinReject(error);
                roomJoinResolve = null;
                roomJoinReject = null;
            }
        };

        activeWs.onclose = (event) => {
            console.log(`WebSocket closed with code ${event.code}:`, event.reason);
            if (roomJoinReject) {
                roomJoinReject(new Error('WebSocket closed'));
                roomJoinResolve = null;
                roomJoinReject = null;
            }
            
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
        if (roomJoinReject) {
            roomJoinReject(error);
            roomJoinResolve = null;
            roomJoinReject = null;
        }
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
    if (!userList) {
        console.warn('Users list element not found');
        return;
    }

    console.log('Updating users list. Current users:', Array.from(connectedUsers));
    console.log('Current username:', currentUsername);

    userList.innerHTML = '';
    connectedUsers.forEach(username => {
        const li = document.createElement('li');
        li.textContent = username;
        if (username === currentUsername) {
            li.textContent += ' (You)';
            li.classList.add('current-user');
        }
        userList.appendChild(li);
    });
}

// Function to join a room via WebSocket
function joinRoom(roomId) {
    return new Promise((resolve, reject) => {
        if (!activeWs || activeWs.readyState !== WebSocket.OPEN) {
            reject(new Error('WebSocket not connected'));
            return;
        }

        // Store the Promise resolution functions
        roomJoinResolve = resolve;
        roomJoinReject = reject;

        // Send the join room request
        activeWs.send(JSON.stringify({
            type: 'join_room',
            roomId: roomId
        }));

        // Set a timeout to reject if we don't get room_joined in time
        setTimeout(() => {
            if (roomJoinResolve) {
                roomJoinReject(new Error('Room join timeout'));
                roomJoinResolve = null;
                roomJoinReject = null;
            }
        }, 5000);
    });
}

export { 
    initializeWebSocket, 
    sendChatMessage,
    joinRoom,
    connectedUsers,
    currentUsername 
};
