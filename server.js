const express = require('express');
const mysql = require('mysql2');
const crypto = require('crypto');

// Express app configuration ------------------
const app = express();
app.use(express.json());
//---------------------------------------------

// Database configuration----------------------
require('dotenv').config();
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

const createSession = (userId) => {
    const token = generateSessionToken();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 1); // Session expires in 1 day

    return new Promise((resolve, reject) => {
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
                const token = await createSession(user.user_id);
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

app.get('/getUsers', (req, res) => {
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

app.post('/logout', (req, res) => {
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

app.listen(3000, () => {
    console.log('Server running on port 3000');
});
