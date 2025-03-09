const express = require('express');
const router = express.Router();
const { authenticateSessionOnHTTPEndpoint } = require('../middleware/auth.middleware');
const instrumentsService = require('../services/instruments.service');

// List all available instruments
router.get('/', authenticateSessionOnHTTPEndpoint, async (req, res) => {
    try {
        const instruments = instrumentsService.getAvailableInstruments();
        res.json({ instruments });
    } catch (error) {
        console.error('Error fetching instruments:', error);
        res.status(500).json({ error: 'Failed to fetch instruments' });
    }
});

// List all available sounds for a specific instrument (metadata only)
router.get('/:instrument/sounds', authenticateSessionOnHTTPEndpoint, async (req, res) => {
    try {
        const { instrument } = req.params;
        const sounds = await instrumentsService.getSoundNamesForInstrument(instrument);
        res.json({ sounds });
    } catch (error) {
        if (error.message.includes('Invalid instrument type')) {
            return res.status(400).json({
                error: error.message,
                validInstruments: instrumentsService.validInstruments
            });
        }
        console.error('Error fetching instrument sounds:', error);
        res.status(500).json({ error: 'Failed to fetch instrument sounds' });
    }
});

// Get a specific sound file for an instrument (compressed)
router.get('/:instrument/sounds/:soundName', authenticateSessionOnHTTPEndpoint, async (req, res) => {
    try {
        const { instrument, soundName } = req.params;
        const compressedSoundData = await instrumentsService.getCompressedSoundFile(instrument, soundName);
        
        if (!compressedSoundData) {
            return res.status(404).json({ error: 'Sound not found' });
        }
        
        // Set content type for zip file
        res.set('Content-Type', 'application/zip');
        res.set('Content-Disposition', `attachment; filename="${instrument}-${soundName}.zip"`);
        
        res.send(compressedSoundData);
    } catch (error) {
        if (error.message.includes('Invalid instrument type')) {
            return res.status(400).json({
                error: error.message,
                validInstruments: instrumentsService.validInstruments
            });
        }
        console.error('Error fetching compressed sound file:', error);
        res.status(500).json({ error: 'Failed to fetch sound file' });
    }
});

module.exports = router;
