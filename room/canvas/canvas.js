import { Timeline } from './timeline.js';
import { 
    TrackStatus, 
    createTrackAudio, 
    formatTime,
    getRandomColor,
    calculateTrackPosition,
    updateTrackStatus 
} from './track-state.js';

// Initialize canvas component
export function initializeCanvas(roomState, ws) {
    const canvas = document.getElementById('timelineCanvas');
    const timeline = new Timeline(canvas);
    
    // Track state
    let audioMap = new Map(); // Maps trackId to audio elements
    let isPlaying = false;
    let playbackInterval = null;
    
    // Initialize playback controls
    const playButton = document.getElementById('playButton');
    const pauseButton = document.getElementById('pauseButton');
    const restartButton = document.getElementById('restartButton');

    // Watch for track changes
    roomState.watchTracks(tracks => {
        timeline.draw(tracks, roomState.playback.currentTime);
        syncAudioElements(tracks);
    });

    // Watch for playback state changes
    roomState.watchPlayback(playback => {
        if (playback.isPlaying !== isPlaying) {
            isPlaying = playback.isPlaying;
            if (isPlaying) {
                startPlayback();
            } else {
                pausePlayback();
            }
        }
    });

    // Playback controls
    playButton.addEventListener('click', () => {
        roomState.updatePlayback({
            isPlaying: true,
            currentTime: roomState.playback.currentTime
        });
    });

    pauseButton.addEventListener('click', () => {
        roomState.updatePlayback({
            isPlaying: false,
            currentTime: roomState.playback.currentTime
        });
    });

    restartButton.addEventListener('click', () => {
        roomState.updatePlayback({
            isPlaying: false,
            currentTime: 0
        });
        timeline.draw(roomState.tracks, 0);
        audioMap.forEach(audio => {
            audio.element.currentTime = 0;
        });
    });

    // Handle track audio synchronization
    async function syncAudioElements(tracks) {
        const currentAudioIds = new Set(audioMap.keys());
        
        // Remove audio elements for tracks that no longer exist
        currentAudioIds.forEach(id => {
            if (!tracks.find(t => t.id === id)) {
                const audio = audioMap.get(id);
                audio.source.disconnect();
                audioMap.delete(id);
            }
        });

        // Add new audio elements
        for (const track of tracks) {
            if (!audioMap.has(track.id) && track.audioUrl) {
                try {
                    const response = await fetch(track.audioUrl);
                    const blob = await response.blob();
                    const audio = await createTrackAudio(blob);
                    audioMap.set(track.id, audio);
                } catch (error) {
                    console.error('Error loading audio for track:', track.id, error);
                }
            }
        }
    }

    // Playback control functions
    function startPlayback() {
        if (!playbackInterval) {
            const startTime = performance.now() - (roomState.playback.currentTime * 1000);
            
            playbackInterval = setInterval(() => {
                const currentTime = (performance.now() - startTime) / 1000;
                
                if (currentTime >= 30) { // End of timeline
                    roomState.updatePlayback({
                        isPlaying: false,
                        currentTime: 0
                    });
                    return;
                }

                roomState.updatePlayback({
                    ...roomState.playback,
                    currentTime
                });

                timeline.draw(roomState.tracks, currentTime);
            }, 1000 / 60); // 60fps update

            // Start audio playback
            audioMap.forEach((audio, trackId) => {
                const track = roomState.tracks.find(t => t.id === trackId);
                if (track) {
                    const delay = (track.position / timeline.TIMELINE_CONFIG.totalWidth) * 30;
                    if (roomState.playback.currentTime >= delay) {
                        audio.element.currentTime = roomState.playback.currentTime - delay;
                        audio.element.play();
                    }
                }
            });
        }
    }

    function pausePlayback() {
        if (playbackInterval) {
            clearInterval(playbackInterval);
            playbackInterval = null;
            
            // Pause all audio
            audioMap.forEach(audio => {
                audio.element.pause();
            });
        }
    }

    // Clean up on destroy
    return function destroy() {
        if (playbackInterval) {
            clearInterval(playbackInterval);
        }
        audioMap.forEach(audio => {
            audio.source.disconnect();
        });
        audioMap.clear();
        timeline.destroy();
    };
}
