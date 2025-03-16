const WebSocket = require('ws');
const logger = require('../../utils/logger');

// WebSocket client tracking
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
    if (!global.wss) {
        logger.error('No WebSocket server instance found');
        return;
    }
    logger.info(`Broadcasting to room ${roomId}: ${JSON.stringify(message)}`);

    global.wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN && 
            client.roomId === roomId && 
            client !== excludeSocket) {
            try {
                client.send(JSON.stringify(message));
                logger.info('Message sent successfully');
            } catch (err) {
                logger.error(`Error sending message to client: ${err}`);
            }
        }
    });
};

module.exports = {
    clients,
    updateClientsRoomId,
    broadcastToRoom
};
