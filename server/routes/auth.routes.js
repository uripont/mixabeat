const express = require('express'); // npm install express
const router = express.Router();

const { loginUser, signupUser, logoutUser } = require('../services/auth.service');
const { authenticateSessionOnHTTPEndpoint } = require('../middleware/auth.middleware');
const logger = require('../utils/logger');

router.post('/login', async (req, res) => {
    const { username, password } = req.body;

    try {
        const result = await loginUser(username, password);
        res.json({
            message: 'Login successful',
            ...result
        });
    } catch (error) {
        logger.error('Login error:', error);
        res.status(error.message.includes('required') ? 400 : 401)
           .send(error.message);
    }
});

router.post('/signup', async (req, res) => {
    const { username, email, password } = req.body;

    try {
        const result = await signupUser(username, email, password);
        res.status(201).json(result);
    } catch (error) {
        logger.error('Signup error:', error);
        res.status(error.message.includes('required') ? 400 : 500)
           .send(error.message);
    }
});

router.post('/logout', authenticateSessionOnHTTPEndpoint, async (req, res) => {
    const token = req.headers.authorization;

    try {
        const result = await logoutUser(token);
        res.status(200).json(result);
    } catch (error) {
        logger.error('Logout error:', error);
        res.status(error.message.includes('token') ? 401 : 500)
           .send(error.message);
    }
});

module.exports = router;
