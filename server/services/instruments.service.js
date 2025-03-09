const fs = require('fs').promises;
const path = require('path');
const logger = require('../utils/logger');

const validInstruments = ['drums', 'guitar', 'piano', 'trumpet', 'violin'];

// Get sound names for a specific instrument (metadata only)
async function getSoundNamesForInstrument(instrument) {
    try {
        // Validate instrument parameter
        if (!validInstruments.includes(instrument)) {
            throw new Error(`Invalid instrument type. Valid types are: ${validInstruments.join(', ')}`);
        }

        // Get the instrument directory path
        const soundsBasePath = process.env.SOUNDS_PATH || path.join(__dirname, '..', '..', '..', 'sounds');
        const instrumentDir = path.join(soundsBasePath, instrument);
        
        // Read the directory contents
        const files = await fs.readdir(instrumentDir);
        
        // Filter for audio files
        const audioFiles = files.filter(file => 
            file.endsWith('.wav') || file.endsWith('.mp3') || file.endsWith('.flac')
        );

        // Return just the file names
        return audioFiles.map(file => ({
            name: path.basename(file),
            url: `/instruments/${instrument}/sounds/${path.basename(file)}`
        }));
    } catch (error) {
        logger.error('Error in getSoundNamesForInstrument:', error);
        throw error;
    }
}

// Get a specific sound file for an instrument
async function getSoundFile(instrument, soundName) {
    try {
        // Validate instrument parameter
        if (!validInstruments.includes(instrument)) {
            throw new Error(`Invalid instrument type. Valid types are: ${validInstruments.join(', ')}`);
        }

        // Get the instrument directory path
        const soundsBasePath = process.env.SOUNDS_PATH || path.join(__dirname, '..', '..', '..', 'sounds');
        const instrumentDir = path.join(soundsBasePath, instrument);
        
        // Get the file path
        const filePath = path.join(instrumentDir, soundName);
        
        // Check if file exists
        try {
            await fs.access(filePath);
        } catch (error) {
            logger.error(`Sound file not found: ${filePath}`);
            return null;
        }
        
        // Read the file as binary data
        const fileData = await fs.readFile(filePath);
        return fileData;
    } catch (error) {
        logger.error('Error in getSoundFile:', error);
        throw error;
    }
}

// Get all sounds for a specific instrument (with audio data)
async function getSoundsForInstrument(instrument) {
    try {
        // Validate instrument parameter
        if (!validInstruments.includes(instrument)) {
            throw new Error(`Invalid instrument type. Valid types are: ${validInstruments.join(', ')}`);
        }

        // Get the instrument directory path
        const soundsBasePath = process.env.SOUNDS_PATH || path.join(__dirname, '..', '..', '..', 'sounds');
        const instrumentDir = path.join(soundsBasePath, instrument);
        
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

// Get a specific sound file for an instrument and compress it
async function getCompressedSoundFile(instrument, soundName) {
    try {
        // Validate instrument parameter
        if (!validInstruments.includes(instrument)) {
            throw new Error(`Invalid instrument type. Valid types are: ${validInstruments.join(', ')}`);
        }

        // Get the instrument directory path
        const soundsBasePath = process.env.SOUNDS_PATH || path.join(__dirname, '..', '..', '..', 'sounds');
        const instrumentDir = path.join(soundsBasePath, instrument);
        
        // Get the file path
        const filePath = path.join(instrumentDir, soundName);
        
        // Check if file exists
        try {
            await fs.access(filePath);
        } catch (error) {
            logger.error(`Sound file not found: ${filePath}`);
            return null;
        }
        
        // Create a zip file containing the audio file
        const AdmZip = require('adm-zip');
        const zip = new AdmZip();
        
        // Read the file
        const fileData = await fs.readFile(filePath);
        
        // Add the file to the zip
        zip.addFile(soundName, fileData);
        
        // Get the zip file as a buffer
        return zip.toBuffer();
    } catch (error) {
        logger.error('Error in getCompressedSoundFile:', error);
        throw error;
    }
}

module.exports = {
    getSoundsForInstrument,
    getSoundNamesForInstrument,
    getSoundFile,
    getCompressedSoundFile,
    getAvailableInstruments,
    validInstruments
};
