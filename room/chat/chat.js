import { getRoomMessages } from './chat-api.js';

// Get room ID from URL
const roomId = new URLSearchParams(window.location.search).get('roomId');

// Initialize UI elements after DOM is loaded
let chatMessages, chatInput, connectedUsers;
let ws, userId;

function initializeUIElements() {
    chatMessages = document.getElementById('chatMessages');
    chatInput = document.getElementById('chatInput');
    connectedUsers = document.getElementById('connectedUsers');
    
    const emojiElements = document.querySelectorAll('.emoji');
    
    if (!chatMessages || !chatInput || !connectedUsers || emojiElements.length === 0) {
        console.error('Failed to find chat UI elements');
        return false;
    }
    return true;
}

// Message handling
function appendMessage(message, username, isSent = false, isSystem = false) {
    console.log('Chat appendMessage:', { message, username, isSent, isSystem });
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${isSent ? 'sent' : 'received'} ${isSystem ? 'system' : ''}`;

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

// System message helper
function appendSystemMessage(message) {
    appendMessage(message, 'System', false, true);
}

// Handle state updates
function handleStateUpdate(state) {
    console.log('Chat handleStateUpdate:', state);
    
    // Update WebSocket reference if changed
    if (state.ws && state.ws !== ws) {
        ws = state.ws;
        setupWebSocketListeners();
    }
    
    // Update userId if changed
    if (state.userId && state.userId !== userId) {
        userId = state.userId;
    }

    // Update users list
    if (state.connectedUsers) {
        console.log('Chat updateUsersList:', state.connectedUsers);
        updateUsersList(state.connectedUsers);
    }
}

function updateUsersList(users) {
    if (!users || !Array.isArray(users)) return;
    connectedUsers.innerHTML = users
        .map(user => `<li>${user.username}</li>`)
        .join('');
}

// Message sending
function sendMessage() {
    const message = chatInput.value.trim();
    if (!message || !ws) {
        console.error('sendMessage: WebSocket not initialized or message empty');
        return;
    }

    console.log('sendMessage: Sending message via WebSocket:', message);
    try {
        ws.send(JSON.stringify({
            type: 'message',
            message: message
        }));
        console.log('sendMessage: Message sent successfully');
        
        // Also display the message for the sender immediately
        const username = localStorage.getItem('username') || 'You';
        appendMessage(message, username, true);
    } catch (error) {
        console.error('sendMessage: Error sending message:', error);
    }

    // Clear input
    chatInput.value = '';
}

// WebSocket message handling
function setupWebSocketListeners() {
    ws.addEventListener('message', (event) => {
        try {
            const data = JSON.parse(event.data);
            
            if (data.type === 'message') {
                // Handle chat messages
                console.log('ws.onmessage - Received chat message:', data);
                appendMessage(data.message, data.username, data.userId === userId);
            } else {
                // Handle system messages
                console.log('ws.onmessage - Received system message:', data.type);
                
                switch (data.type) {
                    case 'user_joined':
                        appendSystemMessage(`${data.username} joined the room`);
                        break;
                    case 'user_left':
                        appendSystemMessage(`${data.username} left the room`);
                        break;
                    case 'room_joined':
                        appendSystemMessage(`You joined the room`);
                        break;
                    default:
                        console.log('Unhandled system message type:', data.type);
                }
            }
        } catch (error) {
            console.error('ws.onmessage - Error parsing WebSocket message:', error);
        }
    });
}

// Set up all event listeners
function setupEventListeners() {
    console.log('setupEventListeners: Setting up event listeners...');
    
    // Enter to send
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    // Emoji click handlers
    document.querySelectorAll('.emoji').forEach(emoji => {
        emoji.addEventListener('click', (e) => {
            const emojiChar = e.target.dataset.emoji;
            const start = chatInput.selectionStart;
            const end = chatInput.selectionEnd;
            const value = chatInput.value;
            chatInput.value = value.substring(0, start) + emojiChar + value.substring(end);
            chatInput.focus();
            chatInput.selectionStart = chatInput.selectionEnd = start + emojiChar.length;
        });
    });
}

// Initialize chat panel
async function initialize() {
    try {
        console.log('initialize: Initializing chat panel...');
        
        // Wait for state/roomState to be defined
        while (!window.roomState) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        console.log('initialize: window.roomState is available');
        
        // Initialize UI elements
        if (!initializeUIElements()) {
            throw new Error('initialize: Failed to initialize UI elements');
        }
        console.log('initialize: UI elements initialized');

        // Set up event listeners
        setupEventListeners();
        console.log('initialize: Event listeners setup');
        
        // Set initial users list if available
        if (window.roomState.connectedUsers) {
            console.log('initialize: Initial users list from state:', window.roomState.connectedUsers);
            updateUsersList(window.roomState.connectedUsers);
        }

        // Load message history
        try {
            const { messages } = await getRoomMessages(roomId);
            if (messages) {
                console.log('initialize: Loaded message history:', messages);
                messages.forEach(msg => {
                    appendMessage(msg.message_text, msg.username, parseInt(msg.userId) === parseInt(window.roomState.userId));
                });
            } else {
                console.warn('initialize: No message history loaded (empty response).');
            }
            // Auto scroll to bottom after loading history
            chatMessages.scrollTop = chatMessages.scrollHeight;
        } catch (error) {
            console.error('initialize: Error loading message history:', error);
        }

        // Subscribe to state changes
        window.roomState.subscribe(handleStateUpdate);
        console.log('initialize: Subscribed to roomState updates');

    } catch (error) {
        console.error('initialize: Error initializing chat:', error);
    }
}

// Initialize when script loads
initialize();
