// Shared audio context singleton
let sharedAudioContext;
let gainNode;

// Get or create the shared audio context
export function getAudioContext() {
    if (!sharedAudioContext) {
        sharedAudioContext = new (window.AudioContext || window.webkitAudioContext)();
        gainNode = sharedAudioContext.createGain();
        gainNode.connect(sharedAudioContext.destination);
    }

    // Resume context if it was suspended (browsers require user interaction)
    if (sharedAudioContext.state === 'suspended') {
        sharedAudioContext.resume();
    }

    return sharedAudioContext;
}

// Get the main gain node
export function getGainNode() {
    if (!gainNode) {
        getAudioContext(); // This will create both the context and gain node
    }
    return gainNode;
}

// Create an audio source for playback
export function createAudioSource(audioBuffer, options = {}) {
    const context = getAudioContext();
    const source = context.createBufferSource();
    source.buffer = audioBuffer;

    // Connect through gain node for volume control
    source.connect(getGainNode());
    
    // Set optional parameters
    if (options.loop !== undefined) source.loop = options.loop;
    if (options.playbackRate !== undefined) source.playbackRate.value = options.playbackRate;

    return source;
}

// Clean up audio context
export function cleanupAudio() {
    if (sharedAudioContext) {
        sharedAudioContext.close().then(() => {
            sharedAudioContext = null;
            gainNode = null;
            console.log('Audio context closed');
        }).catch(error => {
            console.error('Error closing audio context:', error);
        });
    }
}

// Helper to decode audio data
export async function decodeAudioData(arrayBuffer) {
    const context = getAudioContext();
    try {
        return await context.decodeAudioData(arrayBuffer);
    } catch (error) {
        console.error('Error decoding audio data:', error);
        throw error;
    }
}

// Create a scheduled playback source
export function createScheduledSource(audioBuffer, startTime, offset = 0) {
    const source = createAudioSource(audioBuffer);
    const context = getAudioContext();
    
    if (startTime !== undefined) {
        source.start(startTime, offset);
    }
    
    return {
        source,
        startTime,
        stop: () => {
            try {
                source.stop();
            } catch (e) {
                console.log('Error stopping source:', e);
            }
        }
    };
}
