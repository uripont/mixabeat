const logger = require('../utils/logger');
const pool = require('../config/database');
const url = require('url');

const authenticateSessionOnHTTPEndpoint = (req, res, next) => {
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
                return res.status(401).send('Invalid token: not found on db query');
            }

            const session = results[0];
            const sessionExpired = new Date(session.expires_at) < new Date();
            if (sessionExpired) {
                pool.query('DELETE FROM sessions WHERE token = ?', [token]);
                return res.status(401).send('Session has expired');
            }

            // If auth has been successful, add user info to request object, and pass execution to next middleware/route
            req.userId = session.user_id;
            next();
        }
    );
};

const authenticateWSConnection = async (socket, request) => {
    const { query } = url.parse(request.url, true);
    const token = query.token;
    if (!token) {
        socket.close(4001, 'No token provided');
        return false;
    }

    socket._token = token;

    try {
        const [results] = await pool.promise().query(
            'SELECT user_id, room_id FROM sessions WHERE token = ? AND expires_at > NOW()',
            [token]
        );

        if (results.length === 0) {
            socket.close(4001, 'Invalid token: no non-expired session found on db query');
            return false;
        }

        const session = results[0];
        socket.userId = session.user_id;
        socket.roomId = session.room_id;
        
        return { userId: session.user_id, roomId: session.room_id };
    } catch (err) {
        logger.error('WebSocket auth error:', err);
        socket.close(4001, 'Authentication error');
        return false;
    }
};

module.exports = {
    authenticateSessionOnHTTPEndpoint,
    authenticateWSConnection
};
