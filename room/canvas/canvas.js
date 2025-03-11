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

    // Room info update handler
    function updateRoomInfo(roomInfo) {
        const roomNameEl = document.querySelector('.room-name');
        const roomIdEl = document.querySelector('.room-id');
        
        if (roomNameEl && roomIdEl) {
            // If no room name, use "Room" + ID
            roomNameEl.textContent = roomInfo.roomName || `Room ${roomInfo.roomId}`;
            roomIdEl.textContent = `#${roomInfo.roomId}`;
        }
    }

    // Initial room info update
    updateRoomInfo({
        roomId: roomState.roomId,
        roomName: roomState.roomName
    });

    // Watch for room info changes
    window.addEventListener('state:room', (e) => updateRoomInfo(e.detail));

    // Store user colors map
    const userColors = new Map();
    
    // Throttle helper
    let lastMouseUpdate = 0;
    const MOUSE_UPDATE_INTERVAL = 50; // Send updates every 50ms
    
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
        const controlsContainer = document.querySelector('.control-group');
        if (!controlsContainer) {
            console.error('Controls container not found');
            return;
        }

        const playButton = controlsContainer.querySelector('.play-btn');
        const stopButton = controlsContainer.querySelector('.stop-btn');
        const restartButton = controlsContainer.querySelector('.restart-btn');
        
        if (!playButton || !stopButton || !restartButton) {
            console.error('Playback controls not found');
            return;
        }

        // Mute others button
        const muteOthersButton = document.createElement('button');
        muteOthersButton.className = 'mute-others-btn';
        muteOthersButton.innerHTML = roomState.playback.muteOthers ? '🔇' : '🔈';
        muteOthersButton.title = 'Mute Others\' Tracks';
        muteOthersButton.dataset.active = roomState.playback.muteOthers;
        controlsContainer.appendChild(muteOthersButton);

        playButton.addEventListener('click', () => {
            roomState.updatePlayback({
                ...roomState.playback,
                isPlaying: true,
                currentTime: roomState.playback.currentTime,
                isLooping: true
            });
        });

        // Toggle mute others state
        muteOthersButton.addEventListener('click', () => {
            const newMuteState = !roomState.playback.muteOthers;
            roomState.updatePlayback({
                ...roomState.playback,
                muteOthers: newMuteState
            });
            muteOthersButton.innerHTML = newMuteState ? '🔇' : '🔈';
            muteOthersButton.dataset.active = newMuteState;
            
            // Stop all audio and restart playback to apply new mute state
            if (isPlaying) {
                stopAllAudio();
                startPlayback();
            }
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
        const rect = canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;

        // Handle track dragging
        if (isDragging && selectedTrackId) {
            const deltaX = event.clientX - dragStartX;
            
            // Find the selected track and preserve all its data
            const track = roomState.tracks.find(t => t.id === selectedTrackId);

            if (track) {
                // Calculate 3s boundary based on canvas width
                const maxAllowedPosition = timeline.getMaxAllowedPosition() - 100; // Subtract track width
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

        // Send cursor position to other users with throttling
        const now = Date.now();
        if (now - lastMouseUpdate >= MOUSE_UPDATE_INTERVAL) {
            import('../websocket.js').then(({ sendMessage }) => {
                sendMessage(ws, 'mouse_position', { x, y });
            });
            lastMouseUpdate = now;
        }
    });

    // Watch for mouse position updates from other users
    roomState.watchMousePositions((positions) => {
        // Get user colors or generate new ones
        Object.keys(positions).forEach(userId => {
            if (!userColors.has(userId)) {
                userColors.set(userId, getRandomColor());
            }
        });

        // Force redraw with cursor positions
        timeline.draw(roomState.tracks, roomState.playback.currentTime);

        // Draw cursors on top
        const ctx = canvas.getContext('2d');
        Object.entries(positions).forEach(([userId, pos]) => {
            if (userId === roomState.userId) return; // Skip own cursor

            // Draw cursor
            ctx.fillStyle = userColors.get(userId);
            ctx.beginPath();
            ctx.moveTo(pos.x, pos.y);
            ctx.lineTo(pos.x + 10, pos.y + 10);
            ctx.lineTo(pos.x + 4, pos.y + 10);
            ctx.lineTo(pos.x, pos.y + 16);
            ctx.closePath();
            ctx.fill();

            // Draw username if available
            const user = roomState.users.find(u => u.userId === userId);
            if (user) {
                ctx.font = '12px Arial';
                ctx.fillStyle = userColors.get(userId);
                ctx.fillText(user.username, pos.x + 12, pos.y + 12);
            }
        });
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
                    trackId: track.id,  // Store trackId in the audio object
                    element: {
                        play: () => {
                            const context = getAudioContext();
                            if (audio.scheduledSource) {
                                audio.scheduledSource.stop();
                            }
                            const currentTime = context.currentTime;
                            const source = createScheduledSource(audio.buffer, currentTime, 0);
                            audio.scheduledSource = source;
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
                audio.trackId = track.id;  // Store trackId in the audio object
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
                    const delay = (track.position / timeline.getMaxAllowedPosition()) * TIMELINE_CONFIG.loopPoint;
                    
                    // If we've reached the track's start time and it's not already playing
                    if (currentTime >= delay && !audio.isPlaying) {
                        // Only play if it's your track or mute others is off
                        const shouldPlay = !roomState.playback.muteOthers || track.ownerId === roomState.userId;
                        try {
                            if (!audio.isPlaying && shouldPlay) {
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
                    const delay = (track.position / timeline.getMaxAllowedPosition()) * TIMELINE_CONFIG.loopPoint;
                    if (roomState.playback.currentTime >= delay) {
                        // Only start if it's your track or mute others is off
                        const shouldPlay = !roomState.playback.muteOthers || track.ownerId === roomState.userId;
                        try {
                            if (!audio.isPlaying && shouldPlay) {
                                const offset = roomState.playback.currentTime - delay;
                                const source = createScheduledSource(audio.buffer, currentAudioTime, offset);
                                audio.scheduledSource = source;
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
