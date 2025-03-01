const { generateSessionToken, hashPassword, verifyPassword } = require('../utils/crypto');
const pool = require('../config/database');
const logger = require('../utils/logger');

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

const loginUser = async (username, password) => {
    return new Promise((resolve, reject) => {
        if (!username || !password) {
            reject(new Error('Username and password are required'));
            return;
        }

        pool.query(
            'SELECT user_id, username, password_hash FROM users WHERE username = ?',
            [username],
            async (err, results) => {
                if (err) {
                    logger.error('Error executing query:', err);
                    reject(new Error('Error during login'));
                    return;
                }

                if (results.length === 0) {
                    reject(new Error('Invalid username or password'));
                    return;
                }

                const user = results[0];
                const match = verifyPassword(password, user.password_hash);

                if (!match) {
                    reject(new Error('Invalid username or password'));
                    return;
                }

                try {
                    const token = await getSession(user.user_id);
                    resolve({
                        token,
                        userId: user.user_id,
                        username: user.username
                    });
                } catch (error) {
                    logger.error('Error creating session:', error);
                    reject(new Error('Error creating session'));
                }
            }
        );
    });
};

const signupUser = async (username, email, password) => {
    return new Promise((resolve, reject) => {
        if (!username || !email || !password) {
            reject(new Error('All fields are required'));
            return;
        }

        const hashedPassword = hashPassword(password);

        pool.query(
            'INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)',
            [username, email, hashedPassword],
            (err, result) => {
                if (err) {
                    logger.error('Error executing query:', err);
                    reject(new Error('Error creating user'));
                    return;
                }
                resolve({
                    userId: result.insertId,
                    message: 'User created successfully'
                });
            }
        );
    });
};

const logoutUser = async (token) => {
    return new Promise((resolve, reject) => {
        if (!token) {
            reject(new Error('No token provided'));
            return;
        }

        pool.query(
            'DELETE FROM sessions WHERE token = ?',
            [token],
            (err, result) => {
                if (err) {
                    logger.error('Error during logout:', err);
                    reject(new Error('Error during logout'));
                    return;
                }
                if (result.affectedRows === 0) {
                    reject(new Error('Invalid token'));
                    return;
                }
                resolve({ message: 'Logged out successfully' });
            }
        );
    });
};

module.exports = {
    getSession,
    loginUser,
    signupUser,
    logoutUser
};
