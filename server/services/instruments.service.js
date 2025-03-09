const fs = require('fs').promises;
const path = require('path');
const logger = require('../utils/logger');

const validInstruments = ['drums', 'guitar', 'piano', 'trumpet', 'violin'];

// Get all sounds for a specific instrument
async function getSoundsForInstrument(instrument) {
    try {
        // Validate instrument parameter
        if (!validInstruments.includes(instrument)) {
            throw new Error(`Invalid instrument type. Valid types are: ${validInstruments.join(', ')}`);
        }

        // Get the instrument directory path
        const instrumentDir = path.join(__dirname, '..', '..', '..', 'sounds', instrument);
        
        // Read the directory contents
        const files = await fs.readdir(instrumentDir);
        
        // Filter for audio files and get their contents
        const audioFiles = files.filter(file => 
            file.endsWith('.wav') || file.endsWith('.mp3') || file.endsWith('.flac')
        );

        // Process each file and get its contents
        const sounds = await Promise.all(audioFiles.map(async file => {
            const audioData = await fs.readFile(path.join(instrumentDir, file), { encoding: 'base64' });
            return {
                name: path.basename(file),
                audioData
            };
        }));

        return sounds;
    } catch (error) {
        logger.error('Error in getSoundsForInstrument:', error);
        throw error;
    }
}

// List all available instruments
function getAvailableInstruments() {
    return validInstruments;
}

module.exports = {
    getSoundsForInstrument,
    getAvailableInstruments,
    validInstruments
};
