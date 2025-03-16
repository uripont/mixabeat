const WebSocket = require('ws');
const logger = require('../utils/logger');
const { authenticateWSConnection } = require('../middleware/auth.middleware');
const { initializeWebSocket } = require('./handlers/index');

const setupWebSocketServer = (httpServer) => {
    const wss = new WebSocket.Server({ server: httpServer });

    // Store WebSocket server instance
    global.wss = wss;

    wss.on('connection', async (socket, request) => {
        const authResult = await authenticateWSConnection(socket, request);
        if (!authResult) return;

        // Attach server instance to socket for broadcasting
        socket.server = wss;

        // Initialize WebSocket with authentication data
        await initializeWebSocket(socket, socket._token, socket.userId);
    });

    return wss;
};

module.exports = setupWebSocketServer;
