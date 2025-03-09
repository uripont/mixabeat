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
    if (!instrument || !soundName) {
        socket.send(JSON.stringify({
            type: 'error',
            message: 'Missing required parameters'
        }));
        return;
    }

    try {
        // Get room contents
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

        // Initialize tracks array if it doesn't exist
        if (!roomContents.tracks) {
            roomContents.tracks = [];
        }

        // Verify sound exists (without loading the entire audio data)
        try {
            const sounds = await instrumentsService.getSoundNamesForInstrument(instrument);
            const sound = sounds.find(s => s.name === soundName);
            if (!sound) {
                throw new Error('Sound not found');
            }

            let track;
            let isNewTrack = false;
            const currentTime = message.currentTime || 0; // Get current time from message or default to 0
            const position = message.position || 150 * (roomContents.tracks.length + 1); // Use provided position or calculate

            // If trackId is provided, find and update existing track
            if (trackId) {
                track = roomContents.tracks.find(t => t.id === trackId);
                
                // Verify ownership if track exists
                if (track) {
                    if (track.ownerId !== socket.userId) {
                        throw new Error('You do not own this track');
                    }
                    
                    // Update existing track
                    track.audioFile = soundName;
                    track.instrument = instrument;
                    if (message.position) {
                        track.position = position;
                    }
                } else {
                    // Create new track with provided ID
                    isNewTrack = true;
                    track = {
                        id: trackId,
                        name: soundName,
                        instrument: instrument,
                        audioFile: soundName,
                        ownerId: socket.userId,
                        position: position,
                        color: message.color || `#${Math.floor(Math.random()*16777215).toString(16)}`
                    };
                    roomContents.tracks.push(track);
                }
            } else {
                // Create new track with generated ID
                isNewTrack = true;
                track = {
                    id: Date.now(), // Simple unique ID
                    name: soundName,
                    instrument: instrument,
                    audioFile: soundName,
                    ownerId: socket.userId,
                    position: position,
                    color: message.color || `#${Math.floor(Math.random()*16777215).toString(16)}`
                };
                roomContents.tracks.push(track);
            }

            // Update database
            await pool.promise().query(
                'UPDATE rooms SET contents = ? WHERE room_id = ?',
                [JSON.stringify(roomContents), socket.roomId]
            );

            // Broadcast to all clients in room except sender (without audio data)
            broadcastToRoom(socket.roomId, {
                type: 'track_updated',
                trackData: track,
                soundUrl: sound.url
            }, socket); // Exclude sender from broadcast

            // Send success response to sender
            socket.send(JSON.stringify({
                type: 'sound_updated',
                trackId: track.id,
                success: true,
                isNewTrack
            }));

        } catch (err) {
            logger.error('Error handling sound:', err);
            throw new Error('Sound not found or invalid');
        }

    } catch (err) {
        logger.error('Error handling use_sound:', err);
        socket.send(JSON.stringify({
            type: 'error',
            message: err.message
        }));
    }
};

// Handle track movement
const handleMoveTrack = async (socket, message, pool) => {
    if (!socket.roomId) {
        logger.error('Attempt to move track without room context');
        socket.send(JSON.stringify({
            type: 'error',
            message: 'You must join a room first'
        }));
        return;
    }

    const { trackId, position } = message;
    if (!trackId || position === undefined) {
        socket.send(JSON.stringify({
            type: 'error',
            message: 'Missing required parameters'
        }));
        return;
    }

    try {
        // Get room contents
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

        // Find the track
        const track = roomContents.tracks?.find(t => t.id === trackId);
        if (!track) {
            throw new Error('Track not found');
        }

        // Verify ownership
        if (track.ownerId !== socket.userId) {
            throw new Error('You do not own this track');
        }

        // Update track position
        track.position = position;

        // Update database
        await pool.promise().query(
            'UPDATE rooms SET contents = ? WHERE room_id = ?',
            [JSON.stringify(roomContents), socket.roomId]
        );

        // Only broadcast to other clients in room, no response to sender needed
        broadcastToRoom(socket.roomId, {
            type: 'track_moved',
            trackId,
            position
        }, socket); // Exclude sender from broadcast

    } catch (err) {
        logger.error('Error handling move_track:', err);
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
    handleMoveTrack,
    removeInstrumentAssignment
};
