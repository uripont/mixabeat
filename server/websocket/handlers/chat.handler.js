const logger = require('../../utils/logger');
const { getUserById } = require('../../database/db-common-queries');
const { broadcastToRoom, clients } = require('./utils.handler');

const handleChatMessage = async (socket, message, pool) => {
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

        const user = await getUserById(userId);
        if (!user) {
            throw new Error('User not found');
        }

        const broadcastMessage = {
            type: 'message',
            messageId: result.insertId,
            userId: userId,
            username: user.username,
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

module.exports = {
    handleChatMessage
};
