// Node modules
const express = require('express');
const mysql = require('mysql2');
require('dotenv').config();
const WebSocket = require('ws');

// Built-in modules
const crypto = require('crypto');
const url = require('url');


// Express and Websocket configuration ------------------
const app = express();
app.use(express.json());

const wss = new WebSocket.Server({ server: app.listen(3000, () => {
    console.log('Server running on port 3000');
}) });

// WebSocket client tracking
const clients = new Map();

// WebSocket authentication middleware
const authenticateWSConnection = async (socket, request) => {
    const { query } = url.parse(request.url, true);
    const token = query.token;

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
        console.error('WebSocket auth error:', err);
        socket.close(4001, 'Authentication error');
        return false;
    }
};

// Message handlers
/* const handleChatMessage = async (socket, message) => {
    const userId = socket.userId;
    
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
    broadcastToRoom(socket, broadcastMessage);
};

const broadcastToRoom = (socket, message) => {
    clients.forEach((client, ws) => {
        if (ws !== socket && client.roomId === socket.roomId) {
            ws.send(JSON.stringify(message));
        }
    });
}; */

// WebSocket connection handling
wss.on('connection', async (socket, request) => {
    const authenticated = await authenticateWSConnection(socket, request);
    if (!authenticated) return;

    // Handle incoming messages
    socket.on('message', async (data) => {
        try {
            // Convert Buffer to string before parsing
            const message = JSON.parse(data.toString());
            console.log('Received message:', data);
            
            switch (message.type) {
                case 'message':
                    console.log('This is a message', message);
                    // Pending to test:
                    /* if (socket.roomId) {
                        await handleChatMessage(socket, message);
                    } */
                    break;
                    //TODO: joining/leaving rooms messages
            }
        } catch (err) {
            console.error('WebSocket message error:', err);
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
                console.error('Error verifying session:', err);
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
        console.error('Error connecting to database:', err);
        return;
    }
    console.log('Connected to database');
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
                console.error('Error executing query:', err);
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
                console.error('Error creating session:', error);
                res.status(500).send('Error creating session');
            }
        }
    );
});

app.get('/getUsers', authenticateSession, (req, res) => {
    console.log('Getting users');
    pool.query('SELECT user_id, username, email, created_at FROM users', (err, rows) => {
        if (err) {
            console.error('Error executing query:', err);
            return res.status(500).send('Error fetching users');
        }
        console.log('Got users:', rows);
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
                console.error('Error during logout:', err);
                return res.status(500).send('Error during logout');
            }
            if (result.affectedRows === 0) {
                return res.status(401).send('Invalid token');
            }
            res.status(200).send({ message: 'Logged out successfully' });
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
                console.error('Error creating room:', err);
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
                console.error('Error executing query:', err);
                res.status(500).send('Error creating user');
                return;
            }
            console.log('Added user:', rows);
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
