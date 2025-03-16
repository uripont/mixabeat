// Track state constants
export const TrackStatus = {
    IDLE: 'idle',
    EDITING: 'editing',
    FINISHED: 'finished'
};

// Initialize audio context only when needed
import { getAudioContext } from '../audio-context.js';

// Create audio element and source for a track
export async function createTrackAudio(audioBlob, trackId) {
    const audioElement = new Audio();
    audioElement.src = URL.createObjectURL(audioBlob);
    
    // Connect to audio context for precise timing
    const source = getAudioContext().createMediaElementSource(audioElement);
    const gainNode = getAudioContext().createGain();
    source.connect(gainNode);
    gainNode.connect(getAudioContext().destination);
    
    return {
        element: audioElement,
        source: source,
        gainNode: gainNode,
        trackId: trackId
    };
}

// Format time in seconds to MM:SS display
export function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

// Generate a random color for new tracks
export function getRandomColor() {
    const letters = '0123456789ABCDEF';
    let color = '#';
    for (let i = 0; i < 6; i++) {
        color += letters[Math.floor(Math.random() * 16)];
    }
    return color;
}

// Calculate ideal track position
export function calculateTrackPosition(existingTracks) {
    const defaultSpacing = 150;
    if (!existingTracks || existingTracks.length === 0) {
        return defaultSpacing;
    }
    return Math.max(...existingTracks.map(t => t.position)) + defaultSpacing;
}

// Update track status via WebSocket
export function updateTrackStatus(ws, trackId, status) {
    if (!ws) return;
    
    ws.send(JSON.stringify({
        type: 'track_status',
        trackId: trackId,
        status: status
    }));
}
