import { Timeline, TIMELINE_CONFIG } from './timeline.js';
import { 
    TrackStatus, 
    createTrackAudio, 
    formatTime,
    getRandomColor,
    calculateTrackPosition,
    updateTrackStatus 
} from './track-state.js';
import { 
    getAudioContext,
    createScheduledSource,
    cleanupAudio,
    createAudioSource
} from '../audio-context.js';

// Initialize canvas component
export function initializeCanvas(roomState, ws) {
    const canvas = document.getElementById('timelineCanvas');
    if (!canvas) throw new Error('Canvas element not found');
    
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
    let lastUpdateTime = 0;
    const UPDATE_INTERVAL = 100; // Minimum time (ms) between position updates

    // Initialize playback controls
    const initializePlaybackControls = () => {
        const playButton = document.querySelector('.play-btn');
        const stopButton = document.querySelector('.stop-btn');
        const restartButton = document.querySelector('.restart-btn');

        if (!playButton || !stopButton || !restartButton) {
            console.error('Playback controls not found');
            return;
        }

        playButton.addEventListener('click', () => {
            roomState.updatePlayback({
                isPlaying: true,
                currentTime: roomState.playback.currentTime,
                isLooping: true
            });
        });

        stopButton.addEventListener('click', () => {
            roomState.updatePlayback({
                isPlaying: false,
                currentTime: roomState.playback.currentTime,
                isLooping: true
            });
        });

        restartButton.addEventListener('click', () => {
            roomState.updatePlayback({
                isPlaying: false,
                currentTime: 0,
                isLooping: true
            });
            timeline.draw(roomState.tracks, 0);
            stopAllAudio();
        });
    };

    // Watch for track changes
    roomState.watchTracks(tracks => {
        // Don't respond to external updates for tracks we're dragging
        if (isDragging) {
            const nonDraggedTracks = tracks.map(track => {
                if (track.id === selectedTrackId) {
                    // Keep our local version of the dragged track
                    return roomState.tracks.find(t => t.id === selectedTrackId);
                }
                return track;
            });
            timeline.draw(nonDraggedTracks, roomState.playback.currentTime);
            syncAudioElements(nonDraggedTracks);
        } else {
            timeline.draw(tracks, roomState.playback.currentTime);
            syncAudioElements(tracks);
        }
    });
    
    // Mouse event handlers for track interaction
    canvas.addEventListener('mousedown', (event) => {
        const rect = canvas.getBoundingClientRect();
        const mouseX = event.clientX - rect.left;
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
            
            // Find the selected track and preserve all its data
            const track = roomState.tracks.find(t => t.id === selectedTrackId);
            if (track) {
                // Calculate new position ensuring track doesn't go beyond yellow line (3s boundary)
                const maxAllowedPosition = (TIMELINE_CONFIG.loopPoint / TIMELINE_CONFIG.totalDuration) * 
                                        TIMELINE_CONFIG.totalWidth - 100; // Subtract track width
                const newPosition = Math.max(0, Math.min(
                    originalTrackPosition + deltaX,
                    maxAllowedPosition
                ));

                // Preserve all track data while updating position
                const updatedTrack = {
                    ...track,
                    position: newPosition
                };
                
                // Update track locally
                roomState.updateTracks(selectedTrackId, updatedTrack);
                
                // Force immediate redraw
                const tracks = roomState.tracks.map(t => 
                    t.id === selectedTrackId ? updatedTrack : t
                );
                timeline.draw(tracks, roomState.playback.currentTime);
                
                // Send updates to other users with rate limiting
                const now = Date.now();
                if (now - lastUpdateTime >= UPDATE_INTERVAL) {
                    import('../websocket.js').then(({ sendMessage }) => {
                        sendMessage(ws, 'move_track', {
                            trackId: selectedTrackId,
                            position: newPosition
                        });
                    });
                    lastUpdateTime = now;
                }
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
        for (let i = 0; i < tracks.length; i++) {
            const track = tracks[i];
            const trackY = i * (TIMELINE_CONFIG.trackHeight + TIMELINE_CONFIG.trackPadding) + 
                          TIMELINE_CONFIG.topMargin;
            
            if (x >= track.position && x <= track.position + 100 && 
                y >= trackY && y <= trackY + TIMELINE_CONFIG.trackHeight) {
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

    // Stop all playing audio
    function stopAllAudio() {
        audioMap.forEach(audio => {
            if (audio.scheduledSource) {
                audio.scheduledSource.stop();
            }
            audio.isPlaying = false;
        });
    }

    // Handle track audio synchronization
    async function syncAudioElements(tracks) {
        const currentAudioIds = new Set(audioMap.keys());
        
        // Remove audio elements for tracks that no longer exist
        currentAudioIds.forEach(id => {
            if (!tracks.find(t => t.id === id)) {
                const audio = audioMap.get(id);
                if (audio.scheduledSource) {
                    audio.scheduledSource.stop();
                }
                audioMap.delete(id);
                roomState.resetLoadRetry(id);
            }
        });

        // Add new audio elements
        for (const track of tracks) {
            if (!audioMap.has(track.id)) {
                await loadTrackAudio(track);
            }
        }
    }

    async function loadTrackAudio(track) {
        try {
            roomState.updateTrackLoadingState(track.id, 'loading');
            
            if (track.audioBuffer) {
                const audio = {
                    buffer: track.audioBuffer,
                    scheduledSource: null,
                    isPlaying: false,
                    element: {
                        play: () => {
                            const context = getAudioContext();
                            if (audio.scheduledSource) {
                                audio.scheduledSource.stop();
                            }
                            const currentTime = context.currentTime;
                            audio.scheduledSource = createScheduledSource(audio.buffer, currentTime);
                            audio.isPlaying = true;
                        },
                        pause: () => {
                            if (audio.scheduledSource) {
                                audio.scheduledSource.stop();
                                audio.isPlaying = false;
                            }
                        }
                    }
                };
                audioMap.set(track.id, audio);
                roomState.updateTrackLoadingState(track.id, 'loaded');
                roomState.resetLoadRetry(track.id);
            } else if (track.audioUrl) {
                const response = await fetch(track.audioUrl);
                const blob = await response.blob();
                const audio = await createTrackAudio(blob);
                audioMap.set(track.id, audio);
                roomState.updateTrackLoadingState(track.id, 'loaded');
                roomState.resetLoadRetry(track.id);
            }
        } catch (error) {
            console.error('Error loading audio for track:', track.id, error);
            roomState.updateTrackLoadingState(track.id, 'error', error.message);
            
            // Implement retry mechanism
            if (roomState.canRetryLoad(track.id)) {
                const retryCount = roomState.incrementLoadRetry(track.id);
                console.log(`Retrying audio load for track ${track.id}, attempt ${retryCount}`);
                setTimeout(() => loadTrackAudio(track), 1000 * retryCount); // Exponential backoff
            }
        }
    }

    // Update drawTracks to show loading state
    function drawTracks(tracks) {
        tracks.forEach((track, index) => {
            const y = index * (TIMELINE_CONFIG.trackHeight + TIMELINE_CONFIG.trackPadding) + 
                      TIMELINE_CONFIG.topMargin;
            const x = track.position;

            // Get loading state
            const loadingState = roomState.trackLoadingState.get(track.id);
            let trackColor = track.color;
            let statusText = '';

            if (loadingState) {
                switch (loadingState.status) {
                    case 'loading':
                        trackColor = '#cccccc';
                        statusText = 'Loading...';
                        break;
                    case 'error':
                        trackColor = '#ffcccc';
                        statusText = 'Error - Retrying...';
                        break;
                }
            }

            // Draw track
            ctx.fillStyle = trackColor;
            ctx.fillRect(x, y, 100, TIMELINE_CONFIG.trackHeight);
            ctx.strokeStyle = '#666';
            ctx.lineWidth = 2;
            ctx.strokeRect(x, y, 100, TIMELINE_CONFIG.trackHeight);

            // Draw track name and status
            ctx.fillStyle = '#000';
            ctx.font = '12px Montserrat, sans-serif';
            ctx.fillText(track.name, x + 5, y + (TIMELINE_CONFIG.trackHeight / 2));
            if (statusText) {
                ctx.fillText(statusText, x + 5, y + (TIMELINE_CONFIG.trackHeight * 0.8));
            }
        });
    }

    // Playback control functions
    function startPlayback() {
        if (!playbackInterval) {
            const startTime = performance.now() - (roomState.playback.currentTime * 1000);
            const audioContext = getAudioContext();
            
            playbackInterval = setInterval(() => {
                const currentTime = (performance.now() - startTime) / 1000;
                
                if (currentTime >= TIMELINE_CONFIG.loopPoint) {
                    // Stop all audio
                    stopAllAudio();
                    
                    // Reset playback to beginning (like restart button)
                    roomState.updatePlayback({
                        isPlaying: false,
                        currentTime: 0,
                        isLooping: true
                    });
                    
                    // Redraw timeline with cursor at beginning
                    timeline.draw(roomState.tracks, 0);
                    
                    // Small delay to ensure UI updates before restarting
                    setTimeout(() => {
                        // Restart playback (like play button)
                        roomState.updatePlayback({
                            isPlaying: true,
                            currentTime: 0,
                            isLooping: true
                        });
                    }, 50);
                    
                    return;
                }

                roomState.updatePlayback({
                    ...roomState.playback,
                    currentTime
                });

                timeline.draw(roomState.tracks, currentTime);
                
                // Schedule audio playback
                roomState.tracks.forEach(track => {
                    if (!audioMap.has(track.id)) return;
                    
                    const audio = audioMap.get(track.id);
                    const delay = (track.position / TIMELINE_CONFIG.totalWidth) * TIMELINE_CONFIG.totalDuration;
                    
                    // If we've reached the track's start time and it's not already playing
                    if (currentTime >= delay && !audio.isPlaying) {
                        try {
                            if (!audio.isPlaying) {
                                audio.element.play();
                                console.log('Started playing track:', track.id, 'at time:', currentTime, 'with delay:', delay);
                            }
                        } catch (error) {
                            console.error('Error playing audio for track:', track.id, error);
                        }
                    }
                });
            }, 1000 / 60); // 60fps update

            // Start audio playback for tracks that should already be playing
            const currentAudioTime = audioContext.currentTime;
            audioMap.forEach((audio, trackId) => {
                const track = roomState.tracks.find(t => t.id === trackId);
                if (track) {
                    const delay = (track.position / TIMELINE_CONFIG.totalWidth) * TIMELINE_CONFIG.totalDuration;
                    if (roomState.playback.currentTime >= delay) {
                        try {
                            if (!audio.isPlaying) {
                                const offset = roomState.playback.currentTime - delay;
                                audio.scheduledSource = createScheduledSource(audio.buffer, currentAudioTime, offset);
                                audio.isPlaying = true;
                            }
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
            stopAllAudio();
        }
    }

    // Initialize playback controls after ensuring DOM is ready
    initializePlaybackControls();

    // Clean up on destroy
    return function destroy() {
        if (playbackInterval) {
            clearInterval(playbackInterval);
        }
        stopAllAudio();
        audioMap.clear();
        timeline.destroy();
        cleanupAudio();
    };
}
