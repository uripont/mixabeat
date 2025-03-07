const pool = require('../database/db-connection');
const logger = require('../utils/logger');
const { updateClientsRoomId } = require('../websocket/handlers');

async function listRooms() {
    return new Promise((resolve, reject) => {
        pool.query(
            'SELECT room_id, song_name, created_by, created_at FROM rooms',
            (err, results) => {
                if (err) {
                    logger.error('Error fetching rooms:', err);
                    reject(new Error('Error fetching rooms'));
                    return;
                }
                resolve(results);
            }
        );
    });
}

async function createRoom(songName, userId) {
    if (!songName) {
        throw new Error('Song name is required');
    }

    const emptyContents = { tracks: [] };

    return new Promise((resolve, reject) => {
        pool.query(
            'INSERT INTO rooms (song_name, created_by, contents) VALUES (?, ?, ?)',
            [songName, userId, JSON.stringify(emptyContents)],
            (err, result) => {
                if (err) {
                    logger.error('Error creating room:', err);
                    reject(new Error('Error creating room'));
                    return;
                }
                resolve({
                    message: 'Room created successfully',
                    roomId: result.insertId,
                    songName,
                    createdBy: userId
                });
            }
        );
    });
}

async function joinRoom(roomId, token) {
    return new Promise((resolve, reject) => {
        // First check if room exists
        pool.query(
            'SELECT room_id FROM rooms WHERE room_id = ?',
            [roomId],
            (err, results) => {
                if (err) {
                    logger.error('Error checking room:', err);
                    reject(new Error('Error joining room'));
                    return;
                }

                if (results.length === 0) {
                    reject(new Error('Room not found'));
                    return;
                }

                // Update session record and WebSocket client's room
                pool.query(
                    'UPDATE sessions SET room_id = ? WHERE token = ?',
                    [roomId, token],
                    (err, result) => {
                        if (err) {
                            logger.error('Error updating session:', err);
                            reject(new Error('Error joining room'));
                            return;
                        }
                        updateClientsRoomId(token, roomId);
                        resolve({ message: 'Joined room successfully', roomId });
                    }
                );
            }
        );
    });
}

async function leaveRoom(roomId, token) {
    return new Promise((resolve, reject) => {
        // Verify user is in this room
        pool.query(
            'SELECT room_id FROM sessions WHERE token = ? AND room_id = ?',
            [token, roomId],
            (err, results) => {
                if (err) {
                    logger.error('Error checking session:', err);
                    reject(new Error('Error leaving room'));
                    return;
                }

                if (results.length === 0) {
                    reject(new Error('You are not in this room'));
                    return;
                }

                // Remove room_id from session and WebSocket client
                pool.query(
                    'UPDATE sessions SET room_id = NULL WHERE token = ?',
                    [token],
                    (err, result) => {
                        if (err) {
                            logger.error('Error updating session:', err);
                            reject(new Error('Error leaving room'));
                            return;
                        }
                        updateClientsRoomId(token, null);
                        resolve({ message: 'Left room successfully' });
                    }
                );
            }
        );
    });
}

async function getRoomMessages(roomId, limit = 100, before = new Date()) {
    return new Promise((resolve, reject) => {
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
                    reject(new Error('Error fetching messages'));
                    return;
                }
                resolve({ messages: results });
            }
        );
    });
}

async function getRoomSong(roomId) {
    return new Promise((resolve, reject) => {
        pool.query(
            'SELECT contents FROM rooms WHERE room_id = ?',
            [roomId],
            (err, results) => {
                if (err) {
                    logger.error('Error fetching room song:', err);
                    reject(new Error('Error fetching room song'));
                    return;
                }

                if (results.length === 0) {
                    reject(new Error('Room not found'));
                    return;
                }

                // Check if contents is already an object (MySQL might parse JSON automatically)
                const contents = results[0].contents;
                if (typeof contents === 'object') {
                    resolve(contents);
                } else {
                    try {
                        resolve(JSON.parse(contents));
                    } catch (err) {
                        logger.error('Error parsing room contents:', err);
                        reject(new Error('Error parsing room contents'));
                    }
                }
            }
        );
    });
}


module.exports = {
    listRooms,
    createRoom,
    joinRoom,
    leaveRoom,
    getRoomMessages,
    getRoomSong
};
