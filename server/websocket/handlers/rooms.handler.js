const WebSocket = require('ws');
const logger = require('../../utils/logger');
const { getUserById, getUserSession } = require('../../database/db-common-queries');
const { broadcastToRoom, clients } = require('./utils.handler');
const { assignInstrumentToUser, getAvailableInstruments } = require('./instruments.handler');

const handleJoinRoom = async (socket, message, pool) => {
    let userInstrument;
    try {
        const session = await getUserSession(socket._token);
        if (!session || !session.room_id || session.room_id !== message.roomId) {
            socket.send(JSON.stringify({
                type: 'error',
                message: 'First join the room using the /rooms/:roomId/join endpoint'
            }));
            return;
        }

        try {
            // Get user info first
            const user = await getUserById(socket.userId);
            if (!user) {
                throw new Error('User not found');
            }

            // Update socket and clients Map with user info
            const clientInfo = clients.get(socket);
            if (clientInfo) {
                clientInfo.roomId = message.roomId;
                clientInfo.username = user.username;
            } else {
                clients.set(socket, { 
                    userId: socket.userId,
                    roomId: message.roomId,
                    username: user.username
                });
            }

            // Set the room ID on the socket instance
            socket.roomId = message.roomId;

            logger.info(`User ${socket.userId} (${user.username}) joined room ${message.roomId}`);

            // Check if this is a new room by looking for other users
            const allUsers = Array.from(global.wss.clients)
                .filter(client => 
                    client.readyState === WebSocket.OPEN && 
                    client.roomId === message.roomId
                )
                .map(client => {
                    const clientInfo = clients.get(client);
                    return {
                        userId: client.userId,
                        username: clientInfo.username
                    };
                });

            // Filter connected users for the joining user (exclude self)
            const connectedUsers = allUsers.filter(u => u.userId !== socket.userId);

            // Get available instruments if it's a new room
            if (connectedUsers.length === 0) {
                userInstrument = 'piano'; // Default to piano for room creator
            } else {
                userInstrument = assignInstrumentToUser(message.roomId, socket.userId);
            }

            // Current user's info to be added to other users' lists
            const currentUser = {
                userId: socket.userId,
                username: user.username
            };

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

            // Prepare response data
            const responseData = {
                type: 'room_joined',
                roomId: message.roomId,
                connectedUsers,
                assignedInstrument: userInstrument,
                song: roomContents
            };

            // Send response to joining user
            try {
                logger.info(`Sending room joined response to user ${socket.userId}`);
                socket.send(JSON.stringify(responseData));
            } catch (err) {
                logger.error('Error sending room_joined message:', err);
                throw err;
            }

            // Update existing users' lists first
            try {
                logger.info(`Broadcasting user_joined for user ${socket.userId} to room ${message.roomId}`);
                broadcastToRoom(message.roomId, {
                    type: 'user_joined',
                    userId: socket.userId,
                    username: user.username,
                    timestamp: new Date().toISOString(),
                    connectedUsers: allUsers // Send complete user list to existing users
                }, socket);
            } catch (err) {
                logger.error('Error broadcasting user_joined message:', err);
            }
        } catch (err) {
        logger.error('Error in handleJoinRoom:', err);
        socket.send(JSON.stringify({
            type: 'error',
            message: 'Failed to join room'
        }));
        }
    }
    catch (err) {
        logger.error('Error in handleJoinRoom:', err);
        socket.send(JSON.stringify({
            type: 'error',
            message: 'Failed to join room'
        }));
    };
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

const handleUpdateTrack = async (socket, message, pool) => {
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

        // Broadcast track updates to all clients in the room
        broadcastToRoom(socket.roomId, {
            type: 'track_updated',
            tracks: message.tracks
        }, socket);

    } catch (err) {
        logger.error('Error handling update track message:', err);
        socket.send(JSON.stringify({
            type: 'error',
            message: 'Error updating track'
        }));
    }
};

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

module.exports = {
    handleJoinRoom,
    handleTrackStatus,
    handleUpdateTrack,
    handleMousePosition
};
