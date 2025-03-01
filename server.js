// Node modules
const express = require('express');
require('dotenv').config();
const WebSocket = require('ws');

// Utils
const { generateSessionToken, hashPassword, verifyPassword } = require('./utils/crypto');
const logger = require('./utils/logger');
const pool = require('./config/database');
const { authenticateSessionOnHTTPEndpoint } = require('./middleware/auth.middleware');
const { updateClientsRoomId } = require('./websocket/handlers');


// Express and Websocket configuration ------------------
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

// Create HTTP server
const httpServer = app.listen(3000, () => {
    logger.info('Server running on port 3000');
});

// Initialize WebSocket server
const setupWebSocketServer = require('./websocket/ws-server');
const wss = setupWebSocketServer(httpServer);




const getSession = async (userId) => {
    return new Promise((resolve, reject) => {
        // First try to get an existing valid session
        pool.query(
            'SELECT token FROM sessions WHERE user_id = ? AND expires_at > NOW()',
            [userId],
            async (err, results) => {
                if (err) {
                    reject(err);
                    return;
                }

                if (results.length > 0) {
                    // Return existing valid session token
                    resolve(results[0].token);
                    return;
                }

                // No valid session exists, create a new one
                const token = generateSessionToken();
                const expiresAt = new Date();
                expiresAt.setDate(expiresAt.getDate() + 1); // Session expires in 1 day

                pool.query(
                    'INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)',
                    [token, userId, expiresAt],
                    (err) => {
                        if (err) {
                            reject(err);
                            return;
                        }
                        resolve(token);
                    }
                );
            }
        );
    });
};

// Login route
app.post('/login', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).send('Username and password are required');
    }

    pool.query(
        'SELECT user_id, username, password_hash FROM users WHERE username = ?',
        [username],
        async (err, results) => {
            if (err) {
                logger.error('Error executing query:', err);
                return res.status(500).send('Error during login');
            }

            if (results.length === 0) {
                return res.status(401).send('Invalid username or password');
            }

            const user = results[0];
            const match = verifyPassword(password, user.password_hash);

            if (!match) {
                return res.status(401).send('Invalid username or password');
            }

            try {
                const token = await getSession(user.user_id);
                res.json({
                    message: 'Login successful',
                    token: token,
                    userId: user.user_id,
                    username: user.username
                });
            } catch (error) {
                logger.error('Error creating session:', error);
                res.status(500).send('Error creating session');
            }
        }
    );
});

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

app.post('/logout', authenticateSessionOnHTTPEndpoint, (req, res) => {
    const token = req.headers.authorization;

    if (!token) {
        return res.status(401).send('No token provided');
    }
        
    // Delete the session for the token you provided (as in session management, we assume you only know your token)
    pool.query(
        'DELETE FROM sessions WHERE token = ?',
        [token],
        (err, result) => {
            if (err) {
                logger.error('Error during logout:', err);
                return res.status(500).send('Error during logout');
            }
            if (result.affectedRows === 0) {
                return res.status(401).send('Invalid token');
            }
            res.status(200).send({ message: 'Logged out successfully' });
        }
    );
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

app.post('/signUp', (req, res) => {
    const { username, email, password } = req.body;
    
    if (!username || !email || !password) {
        return res.status(400).send('All fields are required');
    }

    const hashedPassword = hashPassword(password);

    pool.query(
        'INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)',
        [username, email, hashedPassword],
        (err, rows) => {
            if (err) {
                logger.error('Error executing query:', err);
                res.status(500).send('Error creating user');
                return;
            }
            logger.info('Added user:', rows);
            res.status(201).send({ message: 'User created successfully', userId: rows.insertId });
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


/* // Protected route
app.get('/profile', (req, res) => {
    if (req.session.user) {
        res.send(`Welcome, ${req.session.user}`);
    } else {
        res.status(401).send('Not authenticated');
            }
}); */
