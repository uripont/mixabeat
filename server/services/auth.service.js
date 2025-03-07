const { generateSessionToken, hashPassword, verifyPassword } = require('../utils/crypto');
const pool = require('../database/db-connection');
const logger = require('../utils/logger');

// Validation functions
const isValidUsername = (username) => {
    if (!username || typeof username !== 'string') return false;
    // Username should be 3-20 characters, alphanumeric and underscores only
    return /^[a-zA-Z0-9_]{3,20}$/.test(username);
};

const isValidEmail = (email) => {
    if (!email || typeof email !== 'string') return false;
    // Basic email validation with common patterns
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

const isValidPassword = (password) => {
    if (!password || typeof password !== 'string') return false;
    // Password should be at least 6 characters, 
    // contain at least one uppercase, one lowercase, one number
    return password.length >= 6 &&
           /[A-Z]/.test(password) &&
           /[a-z]/.test(password) &&
           /[0-9]/.test(password);
};

const validateUserData = (username, email, password) => {
    const errors = [];
    
    if (!isValidUsername(username)) {
        errors.push('Username must be 3-20 characters long and contain only letters, numbers, and underscores');
    }
    
    if (!isValidEmail(email)) {
        errors.push('Please provide a valid email address');
    }
    
    if (!isValidPassword(password)) {
        errors.push('Password must be at least 6 characters long and contain uppercase, lowercase, and numbers');
    }
    
    return errors;
};

const checkUsernameAvailable = async (username, excludeUserId = null) => {
    const [results] = await pool.promise().query(
        'SELECT user_id FROM users WHERE username = ? AND user_id != COALESCE(?, -1)',
        [username, excludeUserId]
    );
    return results.length === 0;
};

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
                    logger.info(`Reusing existing valid session for user ${userId}`);
                    resolve(results[0].token);
                    return;
                }

                logger.info(`Creating new session for user ${userId}`);

                // No valid session exists, create a new one
                const token = generateSessionToken();
                const expiresAt = new Date();
                expiresAt.setDate(expiresAt.getDate() + 1); // Session expires in 1 day

                pool.query(
                    'INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)',
                    [token, userId, expiresAt],
                    (err) => {
                        if (err) {
                            logger.error(`Failed to create session for user ${userId}:`, err);
                            reject(err);
                            return;
                        }
                        logger.info(`New session created for user ${userId}, expires at ${expiresAt}`);
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
                    logger.info(`Session created for user ${user.username} (ID: ${user.user_id})`);
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
                    if (err.code === 'ER_DUP_ENTRY') {
                        logger.warn(`Registration attempt with duplicate ${err.sqlMessage.includes('email') ? 'email' : 'username'}: ${err.sqlMessage.includes('email') ? email : username}`);
                    }
                    reject(new Error('Error creating user'));
                    return;
                }
                logger.info(`User account created - ID: ${result.insertId}, Username: ${username}, Email: ${email}`);
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

const changeUsername = async (userId, newUsername) => {
    if (!isValidUsername(newUsername)) {
        throw new Error('Invalid username format');
    }

    const isAvailable = await checkUsernameAvailable(newUsername, userId);
    if (!isAvailable) {
        throw new Error('Username already taken');
    }

    return new Promise((resolve, reject) => {
        pool.query(
            'UPDATE users SET username = ? WHERE user_id = ?',
            [newUsername, userId],
            (err, result) => {
                if (err) {
                    logger.error('Error changing username:', err);
                    reject(new Error('Error changing username'));
                    return;
                }
                if (result.affectedRows === 0) {
                    reject(new Error('User not found'));
                    return;
                }
                logger.info(`Username changed for user ${userId} to ${newUsername}`);
                resolve({
                    userId,
                    username: newUsername,
                    message: 'Username changed successfully'
                });
            }
        );
    });
};

const changePassword = async (userId, currentPassword, newPassword) => {
    if (!isValidPassword(newPassword)) {
        throw new Error('Invalid new password format');
    }

    // First verify current password
    const [[user]] = await pool.promise().query(
        'SELECT password_hash FROM users WHERE user_id = ?',
        [userId]
    );

    if (!user) {
        throw new Error('User not found');
    }

    const isCurrentPasswordValid = verifyPassword(currentPassword, user.password_hash);
    if (!isCurrentPasswordValid) {
        throw new Error('Current password is incorrect');
    }

    const hashedNewPassword = hashPassword(newPassword);

    return new Promise((resolve, reject) => {
        pool.query(
            'UPDATE users SET password_hash = ? WHERE user_id = ?',
            [hashedNewPassword, userId],
            (err, result) => {
                if (err) {
                    logger.error('Error changing password:', err);
                    reject(new Error('Error changing password'));
                    return;
                }
                logger.info(`Password changed for user ${userId}`);
                resolve({ message: 'Password changed successfully' });
            }
        );
    });
};

const deleteAccount = async (userId, password) => {
    // First verify password
    const [[user]] = await pool.promise().query(
        'SELECT password_hash FROM users WHERE user_id = ?',
        [userId]
    );

    if (!user) {
        throw new Error('User not found');
    }

    const isPasswordValid = verifyPassword(password, user.password_hash);
    if (!isPasswordValid) {
        throw new Error('Password is incorrect');
    }

    return new Promise((resolve, reject) => {
        pool.query(
            'DELETE FROM users WHERE user_id = ?',
            [userId],
            async (err, result) => {
                if (err) {
                    logger.error('Error deleting account:', err);
                    reject(new Error('Error deleting account'));
                    return;
                }
                
                // Also delete all sessions for this user
                try {
                    await pool.promise().query(
                        'DELETE FROM sessions WHERE user_id = ?',
                        [userId]
                    );
                } catch (error) {
                    logger.error('Error cleaning up sessions:', error);
                }
                
                logger.info(`Account deleted for user ${userId}`);
                resolve({ message: 'Account deleted successfully' });
            }
        );
    });
};

module.exports = {
    getSession,
    loginUser,
    signupUser,
    logoutUser,
    changeUsername,
    changePassword,
    deleteAccount,
    validateUserData
};
