const logger = require('../../utils/logger');
const { broadcastToRoom } = require('./utils.handler');
const instrumentsService = require('../../services/instruments.service');

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

const handleUseSound = async (socket, message, pool) => {
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

const removeInstrumentAssignment = (roomId, userId) => {
    const room = roomInstruments.get(roomId);
    if (room && room.assignedInstruments.has(userId)) {
        room.assignedInstruments.delete(userId);
    }
};

module.exports = {
    assignInstrumentToUser,
    handleUseSound,
    removeInstrumentAssignment
};
