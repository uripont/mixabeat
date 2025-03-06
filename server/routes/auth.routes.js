const express = require('express');
const router = express.Router();

const { loginUser, signupUser, logoutUser } = require('../services/auth.service');
const { authenticateSessionOnHTTPEndpoint } = require('../middleware/auth.middleware');
const logger = require('../utils/logger');

router.post('/login', async (req, res) => {
    const { username, password } = req.body;

    try {
        const result = await loginUser(username, password);
        logger.info(`User logged in successfully: ${username} (ID: ${result.userId})`);
        res.json({
            message: 'Login successful',
            ...result
        });
    } catch (error) {
        logger.error('Login error:', error);
        const status = error.message.includes('required') ? 400 : 401;
        res.status(status).json({
            error: true,
            message: error.message || 'Invalid username or password'
        });
    }
});

router.post('/signup', async (req, res) => {
    const { username, email, password } = req.body;

    try {
        const result = await signupUser(username, email, password);
        logger.info(`New user signed up: ${username} (ID: ${result.userId}, Email: ${email})`);
        
        // After signup, automatically log them in
        const loginResult = await loginUser(username, password);
        logger.info(`New user automatically logged in: ${username} (ID: ${loginResult.userId})`);
        
        res.status(201).json({
            message: 'Signup successful',
            ...loginResult
        });
    } catch (error) {
        logger.error('Signup error:', error);
        let status = 500;
        let message = 'An error occurred during signup';

        if (error.message.includes('required')) {
            status = 400;
            message = error.message;
        } else if (error.code === 'ER_DUP_ENTRY') {
            status = 409;
            if (error.sqlMessage.includes('email')) {
                message = 'Email already in use';
            } else if (error.sqlMessage.includes('username')) {
                message = 'Username already taken';
            }
        }

        res.status(status).json({
            error: true,
            message
        });
    }
});

router.post('/logout', authenticateSessionOnHTTPEndpoint, async (req, res) => {
    const token = req.headers.authorization;

    try {
        const result = await logoutUser(token);
        logger.info(`User logged out: ${req.userId}`);
        res.status(200).json(result);
    } catch (error) {
        logger.error('Logout error:', error);
        res.status(error.message.includes('token') ? 401 : 500).json({
            error: true,
            message: error.message || 'Error during logout'
        });
    }
});

module.exports = router;
