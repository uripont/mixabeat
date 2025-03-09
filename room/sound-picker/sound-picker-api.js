import { config } from '../../config.js';

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
        
        // Extract the audio file from the zip
        const audioArrayBuffer = await extractAudioFromZip(zipArrayBuffer);
        
        // Decode the audio data
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const audioBuffer = await audioContext.decodeAudioData(audioArrayBuffer);
        return audioBuffer;
    } catch (error) {
        console.error('Error fetching sound file:', error);
        throw error;
    }
}

// Extract audio file from zip
async function extractAudioFromZip(zipArrayBuffer) {
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

        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const audioBuffer = await audioContext.decodeAudioData(bytes.buffer);
        return audioBuffer;
    } catch (error) {
        console.error('Error converting base64 to AudioBuffer:', error);
        throw error;
    }
}

// Preview a sound from AudioBuffer
export function previewSound(audioBuffer) {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const source = audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(audioContext.destination);
    source.start();
    return source;
}
