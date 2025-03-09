const WebSocket = require('ws');
const logger = require('../utils/logger');
const pool = require('../database/db-connection');
const fs = require('fs').promises;
const path = require('path');
const { getUserById, getUserSession } = require('../database/db-common-queries');

// WebSocket client tracking, to know which clients are in which rooms
const clients = new Map();

const instrumentsService = require('../services/instruments.service');

// Available instruments and their assignments per room
const roomInstruments = new Map(); // { roomId -> { availableInstruments, assignedInstruments } }

// Initialize room instruments if not already set
function getOrInitRoomInstruments(roomId) {
    if (!roomInstruments.has(roomId)) {
        roomInstruments.set(roomId, {
            availableInstruments: instrumentsService.getAvailableInstruments(),
            assignedInstruments: new Map() // userId -> instrument
        });
    }
    return roomInstruments.get(roomId);
}

// Get a random available instrument for a user
function assignInstrumentToUser(roomId, userId) {
    const room = getOrInitRoomInstruments(roomId);
    
    // If user already has an instrument assigned, return it
    if (room.assignedInstruments.has(userId)) {
        return room.assignedInstruments.get(userId);
    }
    
    // Get available instruments (not yet assigned)
    const assignedSet = new Set(room.assignedInstruments.values());
    const available = room.availableInstruments.filter(i => !assignedSet.has(i));
    
    if (available.length === 0) {
        // If no instruments available, assign a random one from all instruments
        const instrument = room.availableInstruments[Math.floor(Math.random() * room.availableInstruments.length)];
        room.assignedInstruments.set(userId, instrument);
        return instrument;
    }
    
    // Assign random available instrument
    const instrument = available[Math.floor(Math.random() * available.length)];
    room.assignedInstruments.set(userId, instrument);
    return instrument;
}

// Mouse position and track status handlers
const handleMousePosition = (socket, message) => {
    if (!socket.roomId) {
        logger.error('Attempt to send mouse position without room context');
        socket.send(JSON.stringify({
            type: 'error',
            message: 'You must join a room first'
        }));
        return;
    }
    
    broadcastToRoom(socket.roomId, {
        type: 'broadcast_mouse_position',
        userId: socket.userId,
        x: message.x,
        y: message.y,
        timestamp: message.timestamp
    }, socket);
};

const handleTrackStatus = (socket, message) => {
    if (!socket.roomId) {
        logger.error('Attempt to send track status without room context');
        socket.send(JSON.stringify({
            type: 'error',
            message: 'You must join a room first'
        }));
        return;
    }
    
    broadcastToRoom(socket.roomId, {
        type: 'broadcast_track_status',
        userId: socket.userId,
        trackId: message.trackId,
        status: message.status
    }, socket);
};

const updateClientsRoomId = (token, newRoomId) => {
    clients.forEach((client, socket) => {
        if (socket._token === token) {
            client.roomId = newRoomId;
            socket.roomId = newRoomId;
        }
    });
};

const broadcastToRoom = (roomId, message, excludeSocket = null) => {
    logger.info(`Broadcasting to room ${roomId}: ${JSON.stringify(message)}`);
    clients.forEach((client, ws) => {
        if (ws.readyState === WebSocket.OPEN && client.roomId === roomId) {
            logger.info(`Found client in room ${roomId}: ${client.userId}`);
            if (ws === excludeSocket) {
                logger.info('Skipping this socket (sender)');
                return;
            }
            try {
                ws.send(JSON.stringify(message));
                logger.info('Message sent successfully');
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
    logger.info(`Handling chat message in room ${socket.roomId}`);
    const userId = socket.userId;
    
    try {
        // Save message to database
        const [result] = await pool.promise().query(
            'INSERT INTO messages (room_id, user_id, message_text) VALUES (?, ?, ?)',
            [socket.roomId, userId, message.message]
        );

        const user = await getUserById(userId);
        if (!user) {
            throw new Error('User not found');
        }

        const broadcastMessage = {
            type: 'message',
            messageId: result.insertId,
            userId: userId,
            username: user.username,
            message: message.message,
            timestamp: new Date().toISOString()
        };

        broadcastToRoom(socket.roomId, broadcastMessage, socket);
    } catch (err) {
        logger.error('Error handling chat message:', err);
        socket.send(JSON.stringify({
            type: 'error',
            message: 'Error sending message'
        }));
    }
};

const handleUseSound = async (socket, message) => {
    if (!socket.roomId) {
        logger.error('Attempt to use sound without room context');
        socket.send(JSON.stringify({
            type: 'error',
            message: 'You must join a room first'
        }));
        return;
    }

    const { trackId, instrument, soundName } = message;
    if (!trackId || !instrument || !soundName) {
        socket.send(JSON.stringify({
            type: 'error',
            message: 'Missing required parameters'
        }));
        return;
    }

    try {
        // Get room contents to verify track ownership
        const [[roomResult]] = await pool.promise().query(
            'SELECT contents FROM rooms WHERE room_id = ?',
            [socket.roomId]
        );

        if (!roomResult) {
            throw new Error('Room not found');
        }

        let roomContents = roomResult.contents;
        if (typeof roomContents === 'string') {
            roomContents = JSON.parse(roomContents);
        }

        // Find the track and verify ownership
        const track = roomContents.tracks.find(t => t.id === trackId);
        if (!track) {
            throw new Error('Track not found');
        }
        if (track.ownerId !== socket.userId) {
            throw new Error('You do not own this track');
        }

        // Get sound from instruments service
        try {
            const sounds = await instrumentsService.getSoundsForInstrument(instrument);
            const sound = sounds.find(s => s.name === soundName);
            if (!sound) {
                throw new Error('Sound not found');
            }
            const base64Audio = sound.audioData;
            // Update track in database
            track.audioFile = soundName;
            track.instrument = instrument;
            await pool.promise().query(
                'UPDATE rooms SET contents = ? WHERE room_id = ?',
                [JSON.stringify(roomContents), socket.roomId]
            );

            // Broadcast to all clients in room except sender
            broadcastToRoom(socket.roomId, {
                type: 'track_updated',
                trackData: track,
                audioBuffer: base64Audio
            }, socket);

            // Send success response to sender
            socket.send(JSON.stringify({
                type: 'sound_updated',
                trackId,
                success: true
            }));

        } catch (err) {
            logger.error('Error loading audio file:', err);
            throw new Error('Audio file not found');
        }

    } catch (err) {
        logger.error('Error handling use_sound:', err);
        socket.send(JSON.stringify({
            type: 'error',
            message: err.message
        }));
    }
};

const handleJoinRoom = async (socket, message) => {
    try {
        const session = await getUserSession(socket._token);
        if (!session || !session.room_id || session.room_id !== message.roomId) {
            socket.send(JSON.stringify({
                type: 'error',
                message: 'First join the room using the /rooms/:roomId/join endpoint'
            }));
            return;
        }

        // Update socket and map with new room ID that user just joined
        socket.roomId = message.roomId;
        if (clients.has(socket)) {
            clients.get(socket).roomId = message.roomId;
        }

        const user = await getUserById(socket.userId);
        if (!user) {
            throw new Error('User not found');
        }

        // Get all connected users in this room (excluding the joining user)
        const connectedUsers = [];
        for (const [clientSocket, clientInfo] of clients.entries()) {
            if (clientInfo.roomId === message.roomId && 
                clientSocket.readyState === WebSocket.OPEN && 
                clientInfo.userId !== socket.userId) {
                const userInfo = await getUserById(clientInfo.userId);
                if (userInfo) {
                    connectedUsers.push({
                        userId: clientInfo.userId,
                        username: userInfo.username
                    });
                }
            }
        }

        // Assign an instrument to the user
        const assignedInstrument = assignInstrumentToUser(message.roomId, socket.userId);

        // Get room data to check for existing tracks
        const [[roomResult]] = await pool.promise().query(
            'SELECT contents FROM rooms WHERE room_id = ?',
            [message.roomId]
        );

        let roomContents = null;
        if (roomResult && roomResult.contents) {
            roomContents = typeof roomResult.contents === 'string' 
                ? JSON.parse(roomResult.contents)
                : roomResult.contents;
        }

        // Send connected users list and instrument assignment to the joining user
        socket.send(JSON.stringify({
            type: 'room_joined',
            roomId: message.roomId,
            connectedUsers,
            assignedInstrument,
            song: roomContents
        }));

        broadcastToRoom(message.roomId, {
            type: 'user_joined',
            userId: socket.userId,
            username: user.username,
            timestamp: new Date().toISOString()
        });

    } catch (err) {
        logger.error('Error in join_room:', err);
        socket.send(JSON.stringify({
            type: 'error',
            message: 'Failed to join room'
        }));
    }
};

const handleDisconnect = async (socket) => {
    const clientInfo = clients.get(socket);
    if (clientInfo && clientInfo.roomId) {
        // Update session in database to remove room_id
        try {
            await pool.promise().query(
                'UPDATE sessions SET room_id = NULL WHERE token = ?',
                [socket._token]
            );

            const user = await getUserById(clientInfo.userId);

            if (user) {
                // Free up the assigned instrument when user leaves
                const room = roomInstruments.get(clientInfo.roomId);
                if (room && room.assignedInstruments.has(clientInfo.userId)) {
                    room.assignedInstruments.delete(clientInfo.userId);
                }

                broadcastToRoom(clientInfo.roomId, {
                    type: 'user_left',
                    userId: clientInfo.userId,
                    username: user.username,
                    timestamp: new Date().toISOString()
                });
            }
        } catch (err) {
            logger.error('Error handling client disconnect:', err);
        }
    }
    
    clients.delete(socket);
};

const handleUpdateTrack = async (socket, message) => {
    if (!socket.roomId) {
        logger.error('Attempt to update track without room context');
        socket.send(JSON.stringify({
            type: 'error',
            message: 'You must join a room before updating track'
        }));
        return;
    }
    logger.info(`Handling update track message in room ${socket.roomId}`);

    try {
        // Update room contents in database
        const [[roomResult]] = await pool.promise().query(
            'SELECT contents FROM rooms WHERE room_id = ?',
            [socket.roomId]
        );
        if (!roomResult) {
            throw new Error('Room not found');
        }

        let roomContents = roomResult.contents;
        if (typeof roomContents === 'string') {
            roomContents = JSON.parse(roomContents);
        }
        roomContents.tracks = message.tracks; // Assuming message.tracks is the updated tracks array

        await pool.promise().query(
            'UPDATE rooms SET contents = ? WHERE room_id = ?',
            [JSON.stringify(roomContents), socket.roomId]
        );

        const broadcastMessage = {
            type: 'track_updated',
            tracks: message.tracks
        };
        broadcastToRoom(socket.roomId, broadcastMessage, socket);

    } catch (err) {
        logger.error('Error handling update track message:', err);
        socket.send(JSON.stringify({
            type: 'error',
            message: 'Error updating track'
        }));
    }
};

module.exports = {
    clients,
    updateClientsRoomId,
    broadcastToRoom,
    handleChatMessage,
    handleJoinRoom,
    handleDisconnect,
    handleUpdateTrack,
    handleMousePosition,
    handleTrackStatus,
    handleUseSound
};
