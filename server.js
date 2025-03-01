const express = require('express');
require('dotenv').config();
const logger = require('./utils/logger');
const pool = require('./config/database');
const authRoutes = require('./routes/auth.routes');
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

// Create HTTP server
const httpServer = app.listen(3000, () => {
    logger.info('Server running on port 3000');
});

// Initialize WebSocket server
const setupWebSocketServer = require('./websocket/ws-server');
const wss = setupWebSocketServer(httpServer);

// Get users list
app.get('/getUsers', authenticateSessionOnHTTPEndpoint, (req, res) => {
    logger.info('Getting users');
    pool.query('SELECT user_id, username, email, created_at FROM users', (err, rows) => {
        if (err) {
            logger.error('Error executing query:', err);
            return res.status(500).send('Error fetching users');
        }
        logger.info('Got users:', rows);
        res.json(rows);
    });
});

// Join a room
app.put('/rooms/:roomId/join', authenticateSessionOnHTTPEndpoint, (req, res) => {
    const roomId = parseInt(req.params.roomId);
    
    // First check if room exists
    pool.query(
        'SELECT room_id FROM rooms WHERE room_id = ?',
        [roomId],
        (err, results) => {
            if (err) {
                logger.error('Error checking room:', err);
                return res.status(500).send('Error joining room');
            }

            if (results.length === 0) {
                return res.status(404).send('Room not found');
            }

            // Update session record and WebSocket client's room
            pool.query(
                'UPDATE sessions SET room_id = ? WHERE token = ?',
                [roomId, req.headers.authorization],
                (err, result) => {
                    updateClientsRoomId(req.headers.authorization, roomId);
                    if (err) {
                        logger.error('Error updating session:', err);
                        return res.status(500).send('Error joining room');
                    }
                    res.json({ message: 'Joined room successfully', roomId });
                }
            );
        }
    );
});

// Leave a room
app.put('/rooms/:roomId/leave', authenticateSessionOnHTTPEndpoint, (req, res) => {
    const roomId = parseInt(req.params.roomId);
    
    // Verify user is in this room
    pool.query(
        'SELECT room_id FROM sessions WHERE token = ? AND room_id = ?',
        [req.headers.authorization, roomId],
        (err, results) => {
            if (err) {
                logger.error('Error checking session:', err);
                return res.status(500).send('Error leaving room');
            }

            if (results.length === 0) {
                return res.status(400).send('You are not in this room');
            }

            // Remove room_id from session and WebSocket client
            pool.query(
                'UPDATE sessions SET room_id = NULL WHERE token = ?',
                [req.headers.authorization],
                (err, result) => {
                    updateClientsRoomId(req.headers.authorization, null);
                    if (err) {
                        logger.error('Error updating session:', err);
                        return res.status(500).send('Error leaving room');
                    }
                    res.json({ message: 'Left room successfully' });
                }
            );
        }
    );
});

// Get room chat history
app.get('/rooms/:roomId/messages', authenticateSessionOnHTTPEndpoint, (req, res) => {
    const roomId = parseInt(req.params.roomId);
    const limit = parseInt(req.query.limit) || 100;
    const before = req.query.before ? new Date(req.query.before) : new Date();
    
    pool.query(
        `SELECT m.message_id, m.message_text, m.sent_at, 
                m.user_id, u.username
         FROM messages m
         JOIN users u ON m.user_id = u.user_id
         WHERE m.room_id = ? AND m.sent_at < ?
         ORDER BY m.sent_at DESC
         LIMIT ?`,
        [roomId, before, limit],
        (err, results) => {
            if (err) {
                logger.error('Error fetching messages:', err);
                return res.status(500).send('Error fetching messages');
            }
            res.json({
                messages: results
            });
        }
    );
});

// Create a new room (with empty contents)
app.post('/rooms', authenticateSessionOnHTTPEndpoint, (req, res) => {
    const { songName } = req.body;
    
    if (!songName) {
        return res.status(400).send('Song name is required');
    }

    // Initialize with empty contents
    const emptyContents = { tracks: [] };

    pool.query(
        'INSERT INTO rooms (song_name, created_by, contents) VALUES (?, ?, ?)',
        [songName, req.userId, JSON.stringify(emptyContents)],
        (err, result) => {
            if (err) {
                logger.error('Error creating room:', err);
                return res.status(500).send('Error creating room');
            }
            res.status(201).json({
                message: 'Room created successfully',
                roomId: result.insertId,
                songName,
                createdBy: req.userId
            });
        }
    );
});

// List all available rooms
app.get('/rooms', authenticateSessionOnHTTPEndpoint, (req, res) => {
    pool.query(
        'SELECT room_id, song_name, created_by, created_at FROM rooms',
        (err, results) => {
            if (err) {
                logger.error('Error fetching rooms:', err);
                return res.status(500).send('Error fetching rooms');
            }
            res.json({
                rooms: results
            });
        }
    );
});
