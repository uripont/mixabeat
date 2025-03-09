const express = require('express');
require('dotenv').config();
const logger = require('./utils/logger');
const pool = require('./database/db-connection');
const authRoutes = require('./routes/auth.routes');
const usersRoutes = require('./routes/users.routes');
const roomsRoutes = require('./routes/rooms.routes');
const instrumentsRoutes = require('./routes/instruments.routes');
const { authenticateSessionOnHTTPEndpoint } = require('./middleware/auth.middleware');
const { updateClientsRoomId } = require('./websocket/handlers');

// Express and Websocket configuration
const app = express();

// CORS middleware with credentials support
app.use((req, res, next) => {
    // Always use the request's origin to support any domain
    const origin = req.headers.origin;
    if (origin) {
        res.header('Access-Control-Allow-Origin', origin);
    }
    
    // Always enable credentials
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

app.use(express.json());

// Health check endpoint
app.get('/', (req, res) => {
    res.json({ status: 'OK', message: 'MixaBeat API is running' });
});

// Routes
app.use('/auth', authRoutes);
app.use('/users', usersRoutes);
app.use('/rooms', roomsRoutes);
app.use('/instruments', instrumentsRoutes);

// Create HTTP server
const httpServer = app.listen(3000, () => {
    logger.info('Server running on port 3000');
});

// Initialize WebSocket server
const setupWebSocketServer = require('./websocket/ws-server');
const wss = setupWebSocketServer(httpServer);
