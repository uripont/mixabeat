const express = require('express');
const router = express.Router();
const { getUsers } = require('../services/users.service');
const { authenticateSessionOnHTTPEndpoint } = require('../middleware/auth.middleware');
const logger = require('../utils/logger');

router.get('/', authenticateSessionOnHTTPEndpoint, async (req, res) => {
    try {
        const users = await getUsers();
        res.json(users);
    } catch (error) {
        logger.error('Error fetching users:', error);
        res.status(500).send('Error fetching users');
    }
});

module.exports = router;
