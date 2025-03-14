import { getRoomMessages } from './chat-api.js';
import { sendMessage } from '../websocket.js';

// Get room ID from URL
const roomId = new URLSearchParams(window.location.search).get('roomId');

// Initialize UI elements after DOM is loaded
let chatMessages, chatInput, connectedUsers;
let cleanup;

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
function appendMessage(message, username, isSent = false, isSystem = false, isHistory = false) {
    console.log('Chat appendMessage:', { message, username, isSent, isSystem, isHistory });
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
    
    // Handle message insertion based on type
    if (isHistory) {
        // History messages are added to the top
        if (chatMessages.firstChild) {
            chatMessages.insertBefore(messageDiv, chatMessages.firstChild);
        } else {
            chatMessages.appendChild(messageDiv);
        }
    } else if (isSystem) {
        // System messages always at the top
        chatMessages.insertBefore(messageDiv, chatMessages.firstChild);
    } else {
        // New messages always at the bottom
        chatMessages.appendChild(messageDiv);
    }
    
    // Auto scroll to bottom for new messages (not history)
    if (!isHistory) {
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
}

// System message helper
function appendSystemMessage(message) {
    appendMessage(message, 'System', false, true);
}

function updateUsersList(users) {
    if (!users || !Array.isArray(users)) {
        console.warn('Invalid users array received:', users);
        return;
    }
    console.log('Updating connected users list:', users);
    connectedUsers.innerHTML = users
        .map(user => `<li>${user.username}</li>`)
        .join('');
    console.log('Users list updated, total users:', users.length);
}

// Message sending
function onSendMessage() {
    const message = chatInput.value.trim();
    if (!message || !window.roomState.ws) {
        console.error('sendMessage: WebSocket not initialized or message empty');
        return;
    }

    console.log('sendMessage: Sending message via WebSocket:', message);
    try {
        sendMessage(window.roomState.ws, 'chat_message', { message });
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

// Set up all event listeners
function setupEventListeners() {
    console.log('setupEventListeners: Setting up event listeners...');
    
    // Enter to send
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            onSendMessage();
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

    // WebSocket message handlers
    const handleWsMessage = (e) => {
        const data = e.detail;
        switch (data.type) {
            case 'message':
                appendMessage(
                    data.message, 
                    data.username, 
                    String(data.user_id) === localStorage.getItem('userId')
                );
                break;
        }
    };

    window.addEventListener('ws:message', handleWsMessage);
    window.addEventListener('ws:disconnected', () => {
        appendSystemMessage('Disconnected from chat');
    });

    return () => {
        window.removeEventListener('ws:message', handleWsMessage);
        window.removeEventListener('ws:disconnected', handleWsMessage);
    };
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

        // First update with current users
        console.log('Initializing with current users:', window.roomState.users);
        updateUsersList(window.roomState.users);

        // Then watch for future updates
        const cleanupUsers = window.roomState.watchUsers(users => {
            console.log('Users updated:', users);
            updateUsersList(users);
        });
        
        // Set up event listeners
        const cleanupEvents = setupEventListeners();
        
        // Save cleanup function
        cleanup = () => {
            cleanupUsers();
            cleanupEvents();
        };

        // Load message history
        try {
            const { messages } = await getRoomMessages(roomId);
            if (messages && Array.isArray(messages)) {
                console.log('initialize: Loaded message history:', messages);
                // Sort messages by ID to ensure chronological order
                messages.sort((a, b) => a.id - b.id).forEach(msg => {
                    appendMessage(
                        msg.message_text, 
                        msg.username, 
                        String(msg.user_id) === localStorage.getItem('userId'),
                        false,
                        true // Mark as history message
                    );
                });
                // Auto scroll to bottom after loading all history
                chatMessages.scrollTop = chatMessages.scrollHeight;
            } else {
                console.warn('initialize: No message history loaded (empty response).');
            }
        } catch (error) {
            console.error('initialize: Error loading message history:', error);
        }

    } catch (error) {
        console.error('initialize: Error initializing chat:', error);
    }
}

// Cleanup on panel removal
window.addEventListener('beforeunload', () => {
    if (cleanup) cleanup();
});

// Initialize when script loads
initialize();
