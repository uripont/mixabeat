const logger = require('../../utils/logger');
const { updateClientsRoomId, clients } = require('./utils.handler');
const pool = require('../../database/db-connection');

// Import handlers
const { handleChatMessage } = require('./chat.handler');
const { handleUseSound, handleMoveTrack } = require('./instruments.handler');
const { 
    handleJoinRoom, 
    handleTrackStatus, 
    handleUpdateTrack,
    handleMousePosition
} = require('./rooms.handler');
const { handleDisconnect } = require('./auth.handler');

// WebSocket message handlers
const messageHandlers = {
    'join_room': handleJoinRoom,
    'chat_message': handleChatMessage,
    'use_sound': handleUseSound,
    'track_status': handleTrackStatus,
    'update_track': handleUpdateTrack,
    'mouse_position': handleMousePosition,
    'move_track': handleMoveTrack
};

// Initialize WebSocket connection for a client
const initializeWebSocket = async (socket, token, userId) => {
    socket._token = token;
    socket.userId = userId;
    clients.set(socket, { 
        userId,
        roomId: null // Will be set when joining a room
    });
    logger.info(`WebSocket initialized for user ${userId}`);

    // Handle incoming messages
    socket.on('message', async (data) => {
        try {
            const message = JSON.parse(data);
            const handler = messageHandlers[message.type];
            
            if (handler) {
                await handler(socket, message, pool);
            } else {
                logger.warn(`No handler found for message type: ${message.type}`);
            }
        } catch (error) {
            logger.error('Error handling WebSocket message:', error);
            socket.send(JSON.stringify({
                type: 'error',
                message: 'Failed to process message'
            }));
        }
    });

    // Handle client disconnect
    socket.on('close', () => {
        handleDisconnect(socket, pool);
    });
};

module.exports = {
    initializeWebSocket,
    updateClientsRoomId,
    clients
};
