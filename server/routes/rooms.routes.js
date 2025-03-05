const express = require('express');
const router = express.Router();
const { authenticateSessionOnHTTPEndpoint } = require('../middleware/auth.middleware');
const {
    listRooms,
    createRoom,
    joinRoom,
    leaveRoom,
    getRoomMessages
} = require('../services/rooms.service');
const logger = require('../utils/logger');

// List all available rooms
router.get('/', authenticateSessionOnHTTPEndpoint, async (req, res) => {
    try {
        const rooms = await listRooms();
        res.json({ rooms });
    } catch (error) {
        logger.error('Error fetching rooms:', error);
        res.status(500).send('Error fetching rooms');
    }
});

// Create a new room
router.post('/', authenticateSessionOnHTTPEndpoint, async (req, res) => {
    try {
        const result = await createRoom(req.body.songName, req.userId);
        res.status(201).json(result);
    } catch (error) {
        logger.error('Error creating room:', error);
        res.status(error.message.includes('required') ? 400 : 500)
           .send(error.message);
    }
});

// Join a room
router.put('/:roomId/join', authenticateSessionOnHTTPEndpoint, async (req, res) => {
    const roomId = parseInt(req.params.roomId);
    try {
        const result = await joinRoom(roomId, req.headers.authorization);
        res.json(result);
    } catch (error) {
        logger.error('Error joining room:', error);
        res.status(error.message.includes('not found') ? 404 : 500)
           .send(error.message);
    }
});

// Leave a room
router.put('/:roomId/leave', authenticateSessionOnHTTPEndpoint, async (req, res) => {
    const roomId = parseInt(req.params.roomId);
    try {
        const result = await leaveRoom(roomId, req.headers.authorization);
        res.json(result);
    } catch (error) {
        logger.error('Error leaving room:', error);
        res.status(error.message.includes('not in this room') ? 400 : 500)
           .send(error.message);
    }
});

// Get room chat history
router.get('/:roomId/messages', authenticateSessionOnHTTPEndpoint, async (req, res) => {
    const roomId = parseInt(req.params.roomId);
    const limit = parseInt(req.query.limit) || 100;
    const before = req.query.before ? new Date(req.query.before) : new Date();
    
    try {
        const result = await getRoomMessages(roomId, limit, before);
        res.json(result);
    } catch (error) {
        logger.error('Error fetching messages:', error);
        res.status(500).send('Error fetching messages');
    }
});

module.exports = router;
