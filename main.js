import { initializeWebSocket, sendChatMessage, joinRoom as wsJoinRoom, currentUsername } from './websocket.js';
import { login, signup, createRoom, joinRoom, getRoomMessages } from './apiWrapper.js';

// Message UI helper function
function appendMessage(sender, message, chatBox) {
    const msgContainer = document.createElement('div');
    msgContainer.className = 'message-container';
    
    const msgBubble = document.createElement('div');
    msgBubble.className = `message-bubble ${sender === 'You' ? 'message-sent' : 'message-received'}`;
    msgBubble.textContent = message;
    
    const senderLabel = document.createElement('div');
    senderLabel.className = 'message-sender';
    senderLabel.textContent = sender;
    
    msgContainer.appendChild(senderLabel);
    msgContainer.appendChild(msgBubble);
    chatBox.appendChild(msgContainer);
    chatBox.scrollTop = chatBox.scrollHeight;
}

document.addEventListener("DOMContentLoaded", () => {
    console.log('DOM Content Loaded - Starting initialization');

    // UI Elements with error checking
    const getElementSafely = (id) => {
        const element = document.getElementById(id);
        if (!element) {
            console.error(`Element with id "${id}" not found in DOM`);
            console.trace();
        }
        return element;
    };

    // Get all UI elements
    const elements = {
        // Auth elements
        loginForm: getElementSafely("login-form"),
        signupForm: getElementSafely("signup-form"),
        showSignupLink: getElementSafely("show-signup"),
        showLoginLink: getElementSafely("show-login"),
        loginBtn: getElementSafely("login-button"),
        signupBtn: getElementSafely("signup-button"),
        loginScreen: getElementSafely("login-screen"),
        
        // Room Selection elements
        roomSelectionScreen: getElementSafely("room-selection-screen"),
        roomNameInput: getElementSafely("room-name"),
        joinRoomBtn: getElementSafely("join-room-button"),
        
        // Chat elements
        chatScreen: getElementSafely("chat-screen"),
        messageInput: getElementSafely("message"),
        sendMessageBtn: getElementSafely("send-message-btn"),
        emojiBtn: getElementSafely("emoji-btn"),
        
        // Music room elements
        leftContainer: getElementSafely("left-container"),
        sendBtn: getElementSafely("send-btn"),
        playBtn: getElementSafely("play-btn"),
        stopBtn: getElementSafely("pause-btn"),

        // Input fields
        usernameInput: getElementSafely("username"),
        passwordInput: getElementSafely("password"),
        signupUsername: getElementSafely("signup-username"),
        signupEmail: getElementSafely("signup-email"),
        signupPassword: getElementSafely("signup-password")
    };

    // Log initialization status
    console.log('Elements initialization complete');

    // Form toggle handlers
    elements.showSignupLink?.addEventListener('click', (e) => {
        e.preventDefault();
        console.log('Showing signup form');
        elements.loginForm.style.display = 'none';
        elements.signupForm.style.display = 'block';
    });

    elements.showLoginLink?.addEventListener('click', (e) => {
        e.preventDefault();
        console.log('Showing login form');
        elements.signupForm.style.display = 'none';
        elements.loginForm.style.display = 'block';
    });

    // Signup handler
    elements.signupBtn?.addEventListener("click", async () => {
        console.log('Signup button clicked');
        const username = elements.signupUsername.value;
        const email = elements.signupEmail.value;
        const password = elements.signupPassword.value;

        if (!username || !email || !password) {
            alert('Please fill in all fields');
            return;
        }

        try {
            await signup(username, email, password);
            alert('Signup successful! Please log in.');
            elements.signupForm.style.display = 'none';
            elements.loginForm.style.display = 'block';
        } catch (error) {
            console.error('Signup error:', error);
            alert('Signup failed: ' + error.message);
        }
    });

    // Login handler
    elements.loginBtn?.addEventListener("click", async () => {
        console.log('Login button clicked');
        const username = elements.usernameInput.value;
        const password = elements.passwordInput.value;

        if (!username || !password) {
            alert('Please enter both username and password');
            return;
        }

        try {
            console.log('Attempting login...');
            const data = await login(username, password);
            console.log('Login successful, received data:', data);
            
            localStorage.setItem('authToken', data.token);
            
            if (elements.loginScreen && elements.roomSelectionScreen) {
                elements.loginScreen.style.display = 'none';
                elements.roomSelectionScreen.style.display = 'block';
            } else {
                console.error('Required screen elements not found');
            }

            // Initialize WebSocket connection
            initializeWebSocket(data.token);
        } catch (error) {
            console.error('Login error:', error);
            alert('Login failed: ' + error.message);
        }
    });

    // In your send-message button click handler, add the following code:
    elements.sendMessageBtn?.addEventListener("click", () => {
        const messageText = elements.messageInput?.value;
        if (!messageText) return;

        // Send the message via WebSocket
        const success = sendChatMessage(messageText);
        if (success) {
            // Display sent message with bubble styling
            const chatBox = elements.chatBox || document.getElementById('chat-box');
            if (chatBox) {
                const msgContainer = document.createElement('div');
                msgContainer.className = 'message-container';
                
                const senderLabel = document.createElement('div');
                senderLabel.className = 'message-sender';
                senderLabel.textContent = 'You';
                
                const msgBubble = document.createElement('div');
                msgBubble.className = 'message-bubble message-sent';
                msgBubble.textContent = messageText;
                
                msgContainer.appendChild(senderLabel);
                msgContainer.appendChild(msgBubble);
                chatBox.appendChild(msgContainer);
                chatBox.scrollTop = chatBox.scrollHeight;
                elements.messageInput.value = '';
            }
        } else {
            alert('Failed to send message. Please check your connection.');
        }
    });


    // Music room controls
    elements.playBtn?.addEventListener("click", () => {
        console.log("Play button clicked");
    });

    elements.stopBtn?.addEventListener("click", () => {
        console.log("Stop button clicked");
    });

    // Song sending
    elements.sendBtn?.addEventListener("click", () => {
        console.log("Send button clicked");
        const messageDiv = document.createElement("div");
        messageDiv.textContent = "Song sent. Waiting for future mates' responses...";
        messageDiv.style.cssText = `
            padding: 20px;
            text-align: center;
            font-size: 25px;
            color: #fff;
            background: linear-gradient(135deg, #1a1a1a, #333);
            width: 100%;
            height: 100%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-family: Montserrat, sans-serif;
        `;
        
        if (elements.leftContainer) {
            elements.leftContainer.innerHTML = "";
            elements.leftContainer.appendChild(messageDiv);
        }
    });

    // Emoji handling
    elements.emojiBtn?.addEventListener("click", (event) => {
        if (event.target.classList.contains('emoji') && elements.messageInput) {
            const emoji = event.target.getAttribute("data-emoji");
            elements.messageInput.value += emoji;
            event.stopPropagation();
        }
    });

    // Create room handler
    elements.createRoomBtn = getElementSafely("create-room-button");
    elements.roomIdInput = getElementSafely("room-id");

    elements.createRoomBtn?.addEventListener("click", async () => {
        const songName = elements.roomNameInput.value;
        if (!songName) {
            alert('Please enter a song name');
            return;
        }

        try {
            const token = localStorage.getItem('authToken');
            if (!token) {
                alert('Authentication token not found. Please log in again.');
                return;
            }

            const roomData = await createRoom(songName, token);
            console.log('Room created successfully:', roomData);

            // Join the room via WebSocket and fetch chat history
            if (wsJoinRoom(roomData.roomId)) {
                console.log('Joined room via WebSocket');
                alert(`Room created successfully! Room ID: ${roomData.roomId}`);

                try {
                    // Fetch and display chat history
                    const chatHistory = await getRoomMessages(roomData.roomId, token);
                    const chatBox = document.getElementById('chat-box');
                    if (chatBox && chatHistory.messages) {
                        chatBox.innerHTML = ''; // Clear existing messages
                        chatHistory.messages.reverse().forEach(msg => {
                            const msgContainer = document.createElement('div');
                            msgContainer.className = 'message-container';
                            
                            const senderLabel = document.createElement('div');
                            senderLabel.className = 'message-sender';
                            senderLabel.textContent = msg.username;
                            
                            const msgBubble = document.createElement('div');
                            msgBubble.className = `message-bubble ${msg.username === currentUsername ? 'message-sent' : 'message-received'}`;
                            msgBubble.textContent = msg.message_text;
                            
                            msgContainer.appendChild(senderLabel);
                            msgContainer.appendChild(msgBubble);
                            chatBox.appendChild(msgContainer);
                        });
                        chatBox.scrollTop = chatBox.scrollHeight;
                    }
                } catch (error) {
                    console.error('Error fetching chat history:', error);
                }

                // Show chat and music room screens
                if (elements.roomSelectionScreen && elements.chatScreen && elements.leftContainer) {
                    elements.roomSelectionScreen.style.display = 'none';
                    elements.chatScreen.style.display = 'block';
                    elements.leftContainer.style.display = 'block';
                }
            } else {
                console.error('Required screen elements not found');
            }
        } catch (error) {
            console.error('Error creating room:', error);
            alert('Failed to create room: ' + error.message);
        }
    });

    // Join room handler
    elements.joinRoomBtn?.addEventListener("click", async () => {
        const roomId = elements.roomIdInput.value;
        if (!roomId) {
            alert('Please enter a room ID');
            return;
        }

        try {
            const token = localStorage.getItem('authToken');
            if (!token) {
                alert('Authentication token not found. Please log in again.');
                return;
            }

            const joinData = await joinRoom(roomId, token);
            console.log('Joined room successfully:', joinData);

            // Join the room via WebSocket and fetch chat history
            if (wsJoinRoom(roomId)) {
                console.log('Joined room via WebSocket');

                try {
                    // Fetch and display chat history
                    const chatHistory = await getRoomMessages(roomId, token);
                    const chatBox = document.getElementById('chat-box');
                    if (chatBox && chatHistory.messages) {
                        chatBox.innerHTML = ''; // Clear existing messages
                        chatHistory.messages.reverse().forEach(msg => {
                            const msgContainer = document.createElement('div');
                            msgContainer.className = 'message-container';
                            
                            const senderLabel = document.createElement('div');
                            senderLabel.className = 'message-sender';
                            senderLabel.textContent = msg.username;
                            
                            const msgBubble = document.createElement('div');
                            msgBubble.className = `message-bubble ${msg.username === currentUsername ? 'message-sent' : 'message-received'}`;
                            msgBubble.textContent = msg.message_text;
                            
                            msgContainer.appendChild(senderLabel);
                            msgContainer.appendChild(msgBubble);
                            chatBox.appendChild(msgContainer);
                        });
                        chatBox.scrollTop = chatBox.scrollHeight;
                    }
                } catch (error) {
                    console.error('Error fetching chat history:', error);
                }

                // Show chat and music room screens
                if (elements.roomSelectionScreen && elements.chatScreen && elements.leftContainer) {
                    elements.roomSelectionScreen.style.display = 'none';
                    elements.chatScreen.style.display = 'block';
                    elements.leftContainer.style.display = 'block';
                }
            } else {
                console.error('Required screen elements not found');
            }
        } catch (error) {
            console.error('Error joining room:', error);
            alert('Failed to join room: ' + error.message);
        }
    });

    console.log('All event listeners attached');
});
