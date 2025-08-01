const logger = require('../utils/logger');
const db = require('../database/db-common-queries');
const pool = require('../database/db-connection');
const url = require('url');

const authenticateSessionOnHTTPEndpoint = async (req, res, next) => {
    const token = req.headers.authorization;

    if (!token) {
        return res.status(401).send('No token provided');
    }

    try {
        const session = await db.getUserSession(token);
        
        if (!session) {
            return res.status(401).send('Invalid token: not found on db query');
        }

        const sessionExpired = new Date(session.expires_at) < new Date();
        if (sessionExpired) {
            await pool.promise().query('DELETE FROM sessions WHERE token = ?', [token]);
            return res.status(401).send('Session expired');
        }

        // If auth has been successful, add user info to request object, and pass execution to next middleware/route
        req.userId = session.user_id;
        next();
    } catch (err) {
        logger.error('Error verifying session on middleware:', err);
        return res.status(500).send('Error verifying session');
    }
};

const authenticateWSConnection = async (socket, request) => {
    const { query } = url.parse(request.url, true);
    const token = query.token;
    const userId = query.userId;
    const clientIp = request.socket.remoteAddress;

    if (!token) {
        logger.warn(`WebSocket authentication failed: No token provided from ${clientIp}`);
        socket.close(4001, 'No token provided');
        return false;
    }

    socket._token = token;

    try {
        const session = await db.getUserSession(token);
        if (!session || session.user_id !== parseInt(userId)) {
            logger.warn(`WebSocket authentication failed: Invalid token or mismatched user ID from ${clientIp}`);
            socket.close(4001, 'Invalid credentials');
            return false;
        }

        const sessionExpired = new Date(session.expires_at) < new Date();
        if (sessionExpired) {
            logger.info(`WebSocket session expired for user ${session.user_id} from ${clientIp}`);
            socket.close(4001, 'Invalid or expired token');
            return false;
        }

        socket.userId = session.user_id;
        socket.roomId = session.room_id;
        
        logger.info(`WebSocket authenticated for user ${session.user_id} from ${clientIp}`);
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
