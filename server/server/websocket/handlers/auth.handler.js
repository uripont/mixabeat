const logger = require('../../utils/logger');
const { getUserById } = require('../../database/db-common-queries');
const { clients } = require('./utils.handler');
const { removeInstrumentAssignment } = require('./instruments.handler');
const { broadcastToRoom } = require('./utils.handler');

const handleDisconnect = async (socket, pool) => {
    const clientInfo = clients.get(socket);
    if (clientInfo && clientInfo.roomId) {
        try {
            // Update session in database
            await pool.promise().query(
                'UPDATE sessions SET room_id = NULL WHERE token = ?',
                [socket._token]
            );

            const user = await getUserById(clientInfo.userId);
            if (user) {
                // Free up the assigned instrument
                removeInstrumentAssignment(clientInfo.roomId, clientInfo.userId);

                // Notify other users in room about disconnect
                broadcastToRoom(clientInfo.roomId, {
                    type: 'user_left',
                    userId: clientInfo.userId,
                    username: user.username,
                    timestamp: new Date().toISOString()
                }, socket);
            }
        } catch (err) {
            logger.error('Error handling client disconnect:', err);
        }
    }

    // Remove from clients Map
    clients.delete(socket);
};

module.exports = {
    handleDisconnect
};
