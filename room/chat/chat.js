import { getRoomMessages } from './chat-api.js';

// Get global instances from parent window
const ws = window.ws;
const roomId = new URLSearchParams(window.location.search).get('roomId');

// Chat UI elements
const chatMessages = document.getElementById('chatMessages');
const chatInput = document.getElementById('chatInput');
const sendButton = document.getElementById('sendButton');
const emojiButton = document.getElementById('emojiButton');
const emojiPanel = document.getElementById('emojiPanel');
const connectedUsers = document.getElementById('connectedUsers');

// Message handling
function appendMessage(message, username, isSent = false) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${isSent ? 'sent' : 'received'}`;

    const senderDiv = document.createElement('div');
    senderDiv.className = 'message-sender';
    senderDiv.textContent = username;

    const bubbleDiv = document.createElement('div');
    bubbleDiv.className = 'message-bubble';
    bubbleDiv.textContent = message;

    messageDiv.appendChild(senderDiv);
    messageDiv.appendChild(bubbleDiv);
    chatMessages.appendChild(messageDiv);
    
    // Auto scroll to bottom
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function updateUsersList(users) {
    connectedUsers.innerHTML = users
        .map(user => `<li>${user.username}</li>`)
        .join('');
}

// Message sending
function sendMessage() {
    const message = chatInput.value.trim();
    if (!message) return;

    // Send via WebSocket
    ws.send(JSON.stringify({
        type: 'message',
        message: message
    }));

    // Clear input
    chatInput.value = '';
}

// Event Listeners
sendButton.addEventListener('click', sendMessage);

chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

// Emoji picker
let isEmojiPanelVisible = false;

emojiButton.addEventListener('click', () => {
    isEmojiPanelVisible = !isEmojiPanelVisible;
    emojiPanel.style.display = isEmojiPanelVisible ? 'grid' : 'none';
});

emojiPanel.addEventListener('click', (e) => {
    if (e.target.classList.contains('emoji')) {
        const emoji = e.target.dataset.emoji;
        chatInput.value += emoji;
        chatInput.focus();
        isEmojiPanelVisible = false;
        emojiPanel.style.display = 'none';
    }
});

// Close emoji panel when clicking outside
document.addEventListener('click', (e) => {
    if (isEmojiPanelVisible && !emojiButton.contains(e.target) && !emojiPanel.contains(e.target)) {
        isEmojiPanelVisible = false;
        emojiPanel.style.display = 'none';
    }
});

// Handle WebSocket messages
export function handleMessage(data) {
    switch (data.type) {
        case 'message':
            appendMessage(data.message, data.username, data.userId === window.userId);
            break;
        case 'user_joined':
        case 'user_left':
            // Update users list when users change
            if (data.connectedUsers) {
                updateUsersList(data.connectedUsers);
            }
            break;
        case 'room_joined':
            // Initial users list when joining room
            if (data.connectedUsers) {
                updateUsersList(data.connectedUsers);
            }
            break;
    }
}

// Initialize chat panel
async function initialize() {
    try {
        // Load message history
        const { messages } = await getRoomMessages(roomId);
        if (messages) {
            messages.forEach(msg => {
                appendMessage(msg.message_text, msg.username, msg.userId === window.userId);
            });
            // Auto scroll to bottom after loading history
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }

        // Listen for WebSocket messages
        ws.addEventListener('message', (event) => {
            try {
                const data = JSON.parse(event.data);
                handleMessage(data);
            } catch (error) {
                console.error('Error parsing WebSocket message:', error);
            }
        });
    } catch (error) {
        console.error('Error initializing chat:', error);
    }
}

// Auto-initialize when script loads
initialize();
