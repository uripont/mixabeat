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
    let selectedTrackId = null;
    let isDragging = false;
    let dragStartX = 0;
    let dragStartY = 0;
    let originalTrackPosition = 0;
    
    // Initialize playback controls
    const playButton = document.querySelector('.play-btn');
    const stopButton = document.querySelector('.stop-btn');
    const restartButton = document.querySelector('.restart-btn');

    // Watch for track changes
    roomState.watchTracks(tracks => {
        timeline.draw(tracks, roomState.playback.currentTime);
        syncAudioElements(tracks);
    });
    
    // Mouse event handlers for track interaction
    canvas.addEventListener('mousedown', (event) => {
        const rect = canvas.getBoundingClientRect();
        const mouseX = event.clientX - rect.left + timeline.scrollOffset;
        const mouseY = event.clientY - rect.top;
        
        // Check if a track was clicked
        const clickedTrack = findTrackAtPosition(mouseX, mouseY, roomState.tracks);
        
        if (clickedTrack) {
            // Only allow dragging tracks owned by the current user
            if (clickedTrack.ownerId === roomState.userId) {
                selectedTrackId = clickedTrack.id;
                isDragging = true;
                dragStartX = event.clientX;
                dragStartY = event.clientY;
                originalTrackPosition = clickedTrack.position;
                
                // Set cursor to indicate dragging
                canvas.style.cursor = 'grabbing';
            }
        }
    });
    
    canvas.addEventListener('mousemove', (event) => {
        if (isDragging && selectedTrackId) {
            const deltaX = event.clientX - dragStartX;
            
            // Find the selected track
            const track = roomState.tracks.find(t => t.id === selectedTrackId);
            if (track) {
                // Update track position locally
                const newPosition = Math.max(0, originalTrackPosition + deltaX);
                roomState.updateTracks(selectedTrackId, { position: newPosition });
            }
        }
    });
    
    canvas.addEventListener('mouseup', () => {
        if (isDragging && selectedTrackId) {
            const track = roomState.tracks.find(t => t.id === selectedTrackId);
            if (track) {
                // Send the final position to the server
                import('../websocket.js').then(({ sendMessage }) => {
                    sendMessage(ws, 'move_track', {
                        trackId: selectedTrackId,
                        position: track.position
                    });
                });
            }
            
            // Reset dragging state
            isDragging = false;
            selectedTrackId = null;
            canvas.style.cursor = 'default';
        }
    });
    
    canvas.addEventListener('mouseleave', () => {
        if (isDragging) {
            isDragging = false;
            selectedTrackId = null;
            canvas.style.cursor = 'default';
        }
    });
    
    // Helper function to find a track at a given position
    function findTrackAtPosition(x, y, tracks) {
        const trackHeight = 30;
        const trackPadding = 10;
        
        for (let i = 0; i < tracks.length; i++) {
            const track = tracks[i];
            const trackY = i * (trackHeight + trackPadding) + trackPadding + 40;
            
            if (x >= track.position && x <= track.position + 100 && 
                y >= trackY && y <= trackY + trackHeight) {
                return track;
            }
        }
        
        return null;
    }

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

    stopButton.addEventListener('click', () => {
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
            if (!audioMap.has(track.id)) {
                try {
                    if (track.audioBuffer) {
                        // Create audio from AudioBuffer directly
                        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
                        const source = audioContext.createBufferSource();
                        source.buffer = track.audioBuffer;
                        source.connect(audioContext.destination);
                        
                        const audio = {
                            element: {
                                play: () => source.start(),
                                pause: () => source.stop(),
                                currentTime: 0
                            },
                            source: source
                        };
                        
                        audioMap.set(track.id, audio);
                    } else if (track.audioUrl) {
                        // Fallback to URL if needed
                        const response = await fetch(track.audioUrl);
                        const blob = await response.blob();
                        const audio = await createTrackAudio(blob);
                        audioMap.set(track.id, audio);
                    }
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
                
                // Check if any tracks should start playing at this time
                roomState.tracks.forEach(track => {
                    if (!audioMap.has(track.id)) return;
                    
                    const audio = audioMap.get(track.id);
                    const delay = (track.position / timeline.TIMELINE_CONFIG.totalWidth) * 30;
                    
                    // If we've reached the track's start time and it's not already playing
                    if (currentTime >= delay && !audio.isPlaying) {
                        try {
                            audio.element.play();
                            audio.isPlaying = true;
                        } catch (error) {
                            console.error('Error playing audio for track:', track.id, error);
                        }
                    }
                });
            }, 1000 / 60); // 60fps update

            // Start audio playback for tracks that should already be playing
            audioMap.forEach((audio, trackId) => {
                const track = roomState.tracks.find(t => t.id === trackId);
                if (track) {
                    const delay = (track.position / timeline.TIMELINE_CONFIG.totalWidth) * 30;
                    if (roomState.playback.currentTime >= delay) {
                        try {
                            if (audio.element.currentTime !== undefined) {
                                audio.element.currentTime = roomState.playback.currentTime - delay;
                            }
                            audio.element.play();
                            audio.isPlaying = true;
                        } catch (error) {
                            console.error('Error starting audio playback:', error);
                        }
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
                try {
                    audio.element.pause();
                    audio.isPlaying = false;
                } catch (error) {
                    console.error('Error pausing audio:', error);
                }
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
