const logger = require('../utils/logger');
const pool = require('../config/database');

// WebSocket client tracking, to know which clients are in which rooms
const clients = new Map();

const updateClientsRoomId = (token, newRoomId) => {
    clients.forEach((client, socket) => {
        if (socket._token === token) {
            client.roomId = newRoomId;
            socket.roomId = newRoomId;
        }
    });
};

const broadcastToRoom = (roomId, message, excludeSocket = null) => {
    logger.info(`Broadcasting to room ${roomId}: ${JSON.stringify(message)}`);
    clients.forEach((client, ws) => {
        if (ws.readyState === WebSocket.OPEN && client.roomId === roomId) {
            logger.info(`Found client in room ${roomId}: ${client.userId}`);
            if (ws === excludeSocket) {
                logger.info('Skipping this socket (sender)');
                return;
            }
            try {
                ws.send(JSON.stringify(message));
                logger.info('Message sent successfully');
            } catch (err) {
                logger.error(`Error sending message to client: ${err}`);
            }
        }
    });
};

const handleChatMessage = async (socket, message) => {
    if (!socket.roomId) {
        logger.error('Attempt to send message without room context');
        socket.send(JSON.stringify({
            type: 'error',
            message: 'You must join a room before sending messages'
        }));
        return;
    }
    logger.info(`Handling chat message in room ${socket.roomId}`);
    const userId = socket.userId;
    
    try {
        // Save message to database
        const [result] = await pool.promise().query(
            'INSERT INTO messages (room_id, user_id, message_text) VALUES (?, ?, ?)',
            [socket.roomId, userId, message.message]
        );

        // Get username (from socket we know the user id)
        const [userResult] = await pool.promise().query(
            'SELECT username FROM users WHERE user_id = ?',
            [userId]
        );

        const broadcastMessage = {
            type: 'message',
            messageId: result.insertId,
            userId: userId,
            username: userResult[0].username,
            message: message.message,
            timestamp: new Date().toISOString()
        };

        broadcastToRoom(socket.roomId, broadcastMessage, socket);
    } catch (err) {
        logger.error('Error handling chat message:', err);
        socket.send(JSON.stringify({
            type: 'error',
            message: 'Error sending message'
        }));
    }
};

const handleJoinRoom = async (socket, message) => {
    try {
        const verifyUserHasJoinedRoom = async (socket, roomId) => {
            const [sessionResult] = await pool.promise().query(
                'SELECT room_id FROM sessions WHERE token = ? AND room_id = ?',
                [socket._token, roomId]
            );

            if (sessionResult.length === 0) {
                socket.send(JSON.stringify({
                    type: 'error',
                    message: 'First join the room using the /rooms/:roomId/join endpoint'
                }));
                return false;
            }
            return true;
        };

        if (!await verifyUserHasJoinedRoom(socket, message.roomId)) {
            return;
        }

        // Update socket and map with new room ID that user just joined
        socket.roomId = message.roomId;
        if (clients.has(socket)) {
            clients.get(socket).roomId = message.roomId;
        }

        // Get username of user joining the room
        const [userResult] = await pool.promise().query(
            'SELECT username FROM users WHERE user_id = ?',
            [socket.userId]
        );

        // Get all connected users in this room (excluding the joining user)
        const connectedUsers = [];
        for (const [clientSocket, clientInfo] of clients.entries()) {
            if (clientInfo.roomId === message.roomId && 
                clientSocket.readyState === WebSocket.OPEN && 
                clientInfo.userId !== socket.userId) {
                const [userInfo] = await pool.promise().query(
                    'SELECT username FROM users WHERE user_id = ?',
                    [clientInfo.userId]
                );
                if (userInfo.length > 0) {
                    connectedUsers.push({
                        userId: clientInfo.userId,
                        username: userInfo[0].username
                    });
                }
            }
        }

        // Send connected users list to the joining user
        socket.send(JSON.stringify({
            type: 'room_joined',
            roomId: message.roomId,
            connectedUsers
        }));

        // Broadcast to room that user joined
        broadcastToRoom(message.roomId, {
            type: 'user_joined',
            userId: socket.userId,
            username: userResult[0].username,
            timestamp: new Date().toISOString()
        });

    } catch (err) {
        logger.error('Error in join_room:', err);
        socket.send(JSON.stringify({
            type: 'error',
            message: 'Failed to join room'
        }));
    }
};

const handleDisconnect = async (socket) => {
    const clientInfo = clients.get(socket);
    if (clientInfo && clientInfo.roomId) {
        // Update session in database to remove room_id
        try {
            await pool.promise().query(
                'UPDATE sessions SET room_id = NULL WHERE token = ?',
                [socket._token]
            );

            const [results] = await pool.promise().query(
                'SELECT username FROM users WHERE user_id = ?',
                [clientInfo.userId]
            );

            if (results.length > 0) {
                broadcastToRoom(clientInfo.roomId, {
                    type: 'user_left',
                    userId: clientInfo.userId,
                    username: results[0].username,
                    timestamp: new Date().toISOString()
                });
            }
        } catch (err) {
            logger.error('Error handling client disconnect:', err);
        }
    }
    
    clients.delete(socket);
};

module.exports = {
    clients,
    updateClientsRoomId,
    broadcastToRoom,
    handleChatMessage,
    handleJoinRoom,
    handleDisconnect
};
