const pool = require('../config/database');
const logger = require('./logger');

const getUserById = async (userId) => {
    try {
        const [results] = await pool.promise().query(
            'SELECT username FROM users WHERE user_id = ?',
            [userId]
        );
        return results.length > 0 ? results[0] : null;
    } catch (err) {
        logger.error('Error getting user:', err);
        throw err;
    }
};

const getRoomById = async (roomId) => {
    try {
        const [results] = await pool.promise().query(
            'SELECT room_id, song_name, created_by FROM rooms WHERE room_id = ?',
            [roomId]
        );
        return results.length > 0 ? results[0] : null;
    } catch (err) {
        logger.error('Error getting room:', err);
        throw err;
    }
};

const getUserSession = async (token) => {
    try {
        const [results] = await pool.promise().query(
            'SELECT user_id, room_id, expires_at FROM sessions WHERE token = ?',
            [token]
        );
        return results.length > 0 ? results[0] : null;
    } catch (err) {
        logger.error('Error getting user session:', err);
        throw err;
    }
};

module.exports = {
    getUserById,
    getRoomById,
    getUserSession
};
