import { config } from '../../config.js';

// Fetch available sounds for a specific instrument
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
