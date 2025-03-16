import { config } from '../../utils/config.js';
import { 
    getAudioContext,
    decodeAudioData,
    createAudioSource,
    cleanupAudio 
} from '../audio-context.js';

// Fetch available sounds for a specific instrument (metadata only)
export async function fetchAvailableSounds(instrument) {
    try {
        const response = await fetch(`${config.API_BASE_URL}/instruments/${instrument}/sounds`, {
            method: 'GET',
            headers: {
                'Authorization': `${localStorage.getItem('authToken')}`
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        return data.sounds;
    } catch (error) {
        console.error('Error fetching available sounds:', error);
        throw error;
    }
}

// Fetch a specific sound file (handles compressed zip files)
export async function fetchSoundFile(url) {
    try {
        console.log('Fetching sound file:', url);
        const response = await fetch(`${config.API_BASE_URL}${url}`, {
            method: 'GET',
            headers: {
                'Authorization': `${localStorage.getItem('authToken')}`
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        // Get the zip file as an array buffer
        const zipArrayBuffer = await response.arrayBuffer();
        if (zipArrayBuffer.byteLength === 0) {
            throw new Error('Received empty zip file');
        }
        console.log('Received zip file size:', zipArrayBuffer.byteLength);

        // Extract the audio file from the zip
        const audioArrayBuffer = await extractAudioFromZip(zipArrayBuffer);
        if (audioArrayBuffer.byteLength === 0) {
            throw new Error('Extracted empty audio file from zip');
        }
        console.log('Extracted audio file size:', audioArrayBuffer.byteLength);

        // Ensure audio context is in running state
        const context = getAudioContext();
        if (context.state !== 'running') {
            await context.resume();
        }

        // Decode audio data with retry logic
        let attempts = 0;
        const maxAttempts = 3;
        let lastError;

        while (attempts < maxAttempts) {
            try {
                const audioBuffer = await decodeAudioData(audioArrayBuffer.slice());
                console.log('Successfully decoded audio data on attempt:', attempts + 1);
                return audioBuffer;
            } catch (error) {
                attempts++;
                lastError = error;
                console.log(`Decode attempt ${attempts} failed:`, error);
                
                if (attempts < maxAttempts) {
                    // Wait before retrying
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
            }
        }

        throw new Error(`Failed to decode audio after ${maxAttempts} attempts. Last error: ${lastError.message}`);
    } catch (error) {
        console.error('Error fetching sound file:', error);
        throw error;
    }
}

// Extract audio file from zip
async function extractAudioFromZip(zipArrayBuffer) {
    try {
        // Use JSZip to extract the file
        const JSZip = await import('https://cdn.jsdelivr.net/npm/jszip@3.10.1/+esm');
        const zip = new JSZip.default();
        
        // Load the zip file
        const zipContents = await zip.loadAsync(zipArrayBuffer);
        
        // Get the first file in the zip (there should only be one)
        const files = Object.keys(zipContents.files);
        if (files.length === 0) {
            throw new Error('No files found in the zip');
        }
        
        // Get the audio file as an array buffer
        const audioFile = zipContents.files[files[0]];
        return await audioFile.async('arraybuffer');
    } catch (error) {
        console.error('Error extracting audio from zip:', error);
        throw error;
    }
}

// Convert base64 audio data to AudioBuffer
export async function base64ToAudioBuffer(base64String) {
    try {
        const binaryString = window.atob(base64String);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        
        for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }

        return await decodeAudioData(bytes.buffer);
    } catch (error) {
        console.error('Error converting base64 to AudioBuffer:', error);
        throw error;
    }
}

// Preview a sound from AudioBuffer
export function previewSound(audioBuffer) {
    const source = createAudioSource(audioBuffer);
    
    // Start playback
    try {
        source.start(0);
        console.log('Started audio playback');
    } catch (error) {
        console.error('Error starting audio playback:', error);
        throw error;
    }
    
    return source;
}

// Clean up when needed (export shared cleanupAudio)
export { cleanupAudio };
