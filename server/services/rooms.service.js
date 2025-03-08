const pool = require('../database/db-connection');
const logger = require('../utils/logger');
const { updateClientsRoomId } = require('../websocket/handlers');
const AdmZip = require('adm-zip');
const path = require('path');
const fs = require('fs').promises;

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
    logger.info(`Leave room attempt - Room ID: ${roomId}`);
    return new Promise((resolve, reject) => {
        // Verify user is in this room
        pool.query(
            'SELECT s.user_id, r.song_name FROM sessions s LEFT JOIN rooms r ON r.room_id = s.room_id WHERE s.token = ? AND s.room_id = ?',
            [token, roomId],
            (err, results) => {
                if (err) {
                    logger.error('Error checking session:', err);
                    reject(new Error('Error leaving room'));
                    return;
                }

                if (results.length === 0) {
                    logger.warn(`Failed to leave room ${roomId}: user not in room`);
                    reject(new Error('You are not in this room'));
                    return;
                }

                const userId = results[0].user_id;
                const songName = results[0].song_name;

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
                        logger.info(`User ${userId} left room ${roomId} ("${songName}")`);
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

async function getRoomAudio(roomId) {
    try {
        // Get the room's song data to know which audio files are needed
        const songData = await getRoomSong(roomId);
        
        // Get unique audio files needed with their instrument types
        const uniqueAudioFiles = new Map(); // Map<filename, instrumentType>
        songData.tracks.forEach(track => {
            if (track.audioFile && track.instrument) {
                uniqueAudioFiles.set(track.audioFile, track.instrument);
            }
        });

        // Create a ZIP containing the needed audio files
        const zip = new AdmZip();
        const audioBaseDir = path.join(__dirname, '../audio');

        for (const [fileName, instrumentType] of uniqueAudioFiles) {
            const filePath = path.join(audioBaseDir, instrumentType, fileName);
            try {
                await fs.access(filePath);
                zip.addLocalFile(filePath);
            } catch (err) {
                logger.error(`Audio file not found: ${filePath}`);
                // Continue with other files if one is missing
            }
        }

        return zip.toBuffer();
    } catch (err) {
        logger.error('Error preparing room audio:', err);
        throw new Error('Error preparing room audio');
    }
}

async function getInstrumentAudio(instrumentName) {
    try {
        const zip = new AdmZip();
        const instrumentDir = path.join(__dirname, '../audio', instrumentName);

        // Check if instrument directory exists
        try {
            await fs.access(instrumentDir);
        } catch (err) {
            throw new Error(`Instrument "${instrumentName}" not found`);
        }

        // Read all files in the instrument directory
        const files = await fs.readdir(instrumentDir);
        
        // Add all audio files to zip
        for (const file of files) {
            if (file.endsWith('.mp3') || file.endsWith('.wav')) {
                zip.addLocalFile(path.join(instrumentDir, file));
            }
        }

        return zip.toBuffer();
    } catch (err) {
        logger.error(`Error preparing ${instrumentName} audio:`, err);
        throw new Error(`Error preparing ${instrumentName} audio`);
    }
}

async function joinRoomByName(roomName, token) {
    logger.info(`Attempting to join room by name: "${roomName}"`);
    return new Promise((resolve, reject) => {
        // First check if room exists by name
        pool.query(
            'SELECT r.room_id, s.user_id FROM rooms r LEFT JOIN sessions s ON s.token = ? WHERE r.song_name = ?',
            [token, roomName],
            (err, results) => {
                if (err) {
                    logger.error('Error checking room by name:', err);
                    reject(new Error('Error joining room'));
                    return;
                }

                if (results.length === 0) {
                    logger.warn(`Failed to join: Room "${roomName}" not found`);
                    reject(new Error('Room not found'));
                    return;
                }

                const roomId = results[0].room_id;
                const userId = results[0].user_id;

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
                        logger.info(`User ${userId} joined room "${roomName}" (ID: ${roomId})`);
                        resolve({ message: 'Joined room successfully', roomId });
                    }
                );
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
    getRoomSong,
    getRoomAudio,
    getInstrumentAudio,
    joinRoomByName
};
