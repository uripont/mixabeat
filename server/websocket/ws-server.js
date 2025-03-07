const WebSocket = require('ws'); // npm install ws

const logger = require('../utils/logger');
const { authenticateWSConnection } = require('../middleware/auth.middleware');
const { clients, handleChatMessage, handleJoinRoom, handleDisconnect, handleUpdateTrack } = require('./handlers');

const setupWebSocketServer = (httpServer) => {
    const wss = new WebSocket.Server({ server: httpServer });

    wss.on('connection', async (socket, request) => {
        const authResult = await authenticateWSConnection(socket, request);
        if (!authResult) return;

        clients.set(socket, {
            userId: socket.userId,
            roomId: socket.roomId
        });

        socket.on('message', async (data) => {
            try {
                const message = JSON.parse(data.toString());
                logger.info('Received message: ' + data.toString());
                
                switch (message.type) {
                    case 'message':
                        await handleChatMessage(socket, message);
                        break;
                    case 'join_room':
                        await handleJoinRoom(socket, message);
                        break;
                    case 'update_track':
                        await handleUpdateTrack(socket, message);
                        break;
                }
            } catch (err) {
                logger.error('WebSocket message error:', err);
            }
        });

        // Handle client disconnect
        socket.on('close', () => handleDisconnect(socket));
    });

    return wss;
};

module.exports = setupWebSocketServer;
