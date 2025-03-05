const express = require('express');
require('dotenv').config();
const logger = require('./utils/logger');
const pool = require('./database/db-connection');
const authRoutes = require('./routes/auth.routes');
const usersRoutes = require('./routes/users.routes');
const roomsRoutes = require('./routes/rooms.routes');
const { authenticateSessionOnHTTPEndpoint } = require('./middleware/auth.middleware');
const { updateClientsRoomId } = require('./websocket/handlers');

// Express and Websocket configuration
const app = express();

// Basic CORS middleware
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    
    // Handle preflight requests
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

app.use(express.json());

// Routes
app.use('/', authRoutes);
app.use('/users', usersRoutes);
app.use('/rooms', roomsRoutes);

// Create HTTP server
const httpServer = app.listen(3000, () => {
    logger.info('Server running on port 3000');
});

// Initialize WebSocket server
const setupWebSocketServer = require('./websocket/ws-server');
const wss = setupWebSocketServer(httpServer);
