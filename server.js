// Node modules
const express = require('express');
const mysql = require('mysql2');
require('dotenv').config();
const WebSocket = require('ws');

// Built-in modules
const crypto = require('crypto');
const url = require('url');
const fs = require('fs');


// Logging setup-----------------------------------------
const logDirectory = 'log';

// Check if the directory exists, create it if not
if (!fs.existsSync(logDirectory)) {
    fs.mkdirSync(logDirectory);
}

const logStream = fs.createWriteStream(`${logDirectory}/server.log`, { flags: 'a' });

const logger = {
    persistLog: function(level, message) {
        const timestamp = new Date().toISOString();
        console.log(message); // Keep console output
        logStream.write(`${timestamp} - ${level.toUpperCase()}: ${message}\n`); // Write to log file
    },
    log: function(message) {
        this.persistLog('info', message);
    },
    error: function(message) {
        this.persistLog('error', message);
    }
};
//-------------------------------------------------------


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

const wss = new WebSocket.Server({ server: app.listen(3000, () => {
    logger.log('Server running on port 3000');
}) });

// WebSocket client tracking
const clients = new Map();

const updateClientsRoomId = (token, newRoomId) => {
    // Find socket for this token and update room
    clients.forEach((client, socket) => {
        if (socket._token === token) {
            client.roomId = newRoomId;
            socket.roomId = newRoomId;
        }
    });
};

// WebSocket authentication middleware
const authenticateWSConnection = async (socket, request) => {
    const { query } = url.parse(request.url, true);
    const token = query.token;
    socket._token = token; // Store token for later use

    if (!token) {
        socket.close(4001, 'No token provided');
        return false;
    }

    try {
        const [results] = await pool.promise().query(
            'SELECT user_id, room_id FROM sessions WHERE token = ? AND expires_at > NOW()',
            [token]
        );

        if (results.length === 0) {
            socket.close(4001, 'Invalid token');
            return false;
        }

        const session = results[0];
        socket.userId = session.user_id;
        socket.roomId = session.room_id;
        
        // Store client info
        clients.set(socket, {
            userId: session.user_id,
            roomId: session.room_id
        });

        return true;
    } catch (err) {
        logger.error('WebSocket auth error:', err);
        socket.close(4001, 'Authentication error');
        return false;
    }
};

// Message handlers
const broadcastToRoom = (roomId, message, excludeSocket = null) => {
    logger.log(`Broadcasting to room ${roomId}: ${JSON.stringify(message)}`);
    clients.forEach((client, ws) => {
        if (ws.readyState === WebSocket.OPEN && client.roomId === roomId) {
            // Log each eligible client for debugging
            logger.log(`Found client in room ${roomId}: ${client.userId}`);
            if (ws === excludeSocket) {
                logger.log('Skipping sender');
                return;
            }
            try {
                ws.send(JSON.stringify(message));
                logger.log('Message sent successfully');
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
    logger.log(`Handling chat message in room ${socket.roomId}`);
    const userId = socket.userId;
    
    try {
        // Save to database
        const [result] = await pool.promise().query(
            'INSERT INTO messages (room_id, user_id, message_text) VALUES (?, ?, ?)',
            [socket.roomId, userId, message.message]
        );

        // Get user info
        const [userResult] = await pool.promise().query(
            'SELECT username FROM users WHERE user_id = ?',
            [userId]
        );

        // Prepare broadcast message
        const broadcastMessage = {
            type: 'message',
            messageId: result.insertId,
            userId: userId,
            username: userResult[0].username,
            message: message.message,
            timestamp: new Date().toISOString()
        };

        // Broadcast to room
        broadcastToRoom(socket.roomId, broadcastMessage, socket);
    } catch (err) {
        logger.error('Error handling chat message:', err);
        socket.send(JSON.stringify({
            type: 'error',
            message: 'Error sending message'
        }));
    }
};

// WebSocket connection handling
wss.on('connection', async (socket, request) => {
    const authenticated = await authenticateWSConnection(socket, request);
    if (!authenticated) return;

    // Handle incoming messages
    socket.on('message', async (data) => {
        try {
            // Convert Buffer to string before parsing
            const message = JSON.parse(data.toString());
            logger.log('Received message: ' + data.toString());
            
            switch (message.type) {
                case 'message':
                    await handleChatMessage(socket, message);
                    break;
                case 'join_room':
                    try {
                        // First verify that user has joined this room via HTTP endpoint
                        const [sessionResult] = await pool.promise().query(
                            'SELECT room_id FROM sessions WHERE token = ? AND room_id = ?',
                            [socket._token, message.roomId]
                        );

                        if (sessionResult.length === 0) {
                            socket.send(JSON.stringify({
                                type: 'error',
                                message: 'First join the room using the /rooms/:roomId/join endpoint'
                            }));
                            return;
                        }

                        // Update socket and client's room context
                        socket.roomId = message.roomId;
                        if (clients.has(socket)) {
                            clients.get(socket).roomId = message.roomId;
                        }

                        // Get user info for broadcasting
                        const [userResult] = await pool.promise().query(
                            'SELECT username FROM users WHERE user_id = ?',
                            [socket.userId]
                        );

                        // Get all connected users in this room
                        const connectedUsers = [];
                        for (const [clientSocket, clientInfo] of clients.entries()) {
                            if (clientInfo.roomId === message.roomId && clientSocket.readyState === WebSocket.OPEN) {
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
                    break;
            }
        } catch (err) {
            logger.error('WebSocket message error:', err);
        }
    });

    // Handle client disconnect
    socket.on('close', () => {
        clients.delete(socket);
    });
});

// Authentication middleware, used on all endpoints that require authentication
const authenticateSession = (req, res, next) => {
    const token = req.headers.authorization;

    if (!token) {
        return res.status(401).send('No token provided');
    }

    pool.query(
        'SELECT user_id, expires_at FROM sessions WHERE token = ?',
        [token],
        (err, results) => {
            if (err) {
                logger.error('Error verifying session:', err);
                return res.status(500).send('Error verifying session');
            }

            if (results.length === 0) {
                return res.status(401).send('Invalid token');
            }

            const session = results[0];
            if (new Date(session.expires_at) < new Date()) {
                // Session has expired, delete it and return error
                pool.query('DELETE FROM sessions WHERE token = ?', [token]);
                return res.status(401).send('Session expired');
            }

            // Add user info to request object
            req.userId = session.user_id;
            next();
        }
    );
};
//---------------------------------------------

// Database configuration----------------------
const config = {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE
};

// Create connection pool
const pool = mysql.createPool(config);

// Test database connection
pool.getConnection((err, connection) => {
    if (err) {
        logger.error('Error connecting to database:', err);
        return;
    }
    logger.log('Connected to database');
    connection.release();
});
//--------------------------------------------

// Crypto helper functions---------------------
const generateSessionToken = () => {
    return crypto.randomBytes(32).toString('hex');
};

const hashPassword = (password) => {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
    return `${salt}:${hash}`;
};

const verifyPassword = (password, storedHash) => {
    const [salt, hash] = storedHash.split(':');
    const verifyHash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
    return hash === verifyHash;
};
//---------------------------------------------

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

app.get('/getUsers', authenticateSession, (req, res) => {
    logger.log('Getting users');
    pool.query('SELECT user_id, username, email, created_at FROM users', (err, rows) => {
        if (err) {
            logger.error('Error executing query:', err);
            return res.status(500).send('Error fetching users');
        }
        logger.log('Got users:', rows);
        res.json(rows);
    });
});

app.post('/logout', authenticateSession, (req, res) => {
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
app.put('/rooms/:roomId/join', authenticateSession, (req, res) => {
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
app.put('/rooms/:roomId/leave', authenticateSession, (req, res) => {
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
app.get('/rooms/:roomId/messages', authenticateSession, (req, res) => {
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
app.post('/rooms', authenticateSession, (req, res) => {
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
            logger.log('Added user:', rows);
            res.status(201).send({ message: 'User created successfully', userId: rows.insertId });
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
