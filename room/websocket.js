import { config } from '../config.js';

// Fetch all audio files for a room
async function fetchRoomAudio(roomId) {
    try {
        console.log(`Fetching audio files for room ${roomId}`);
        const response = await fetch(`${config.API_BASE_URL}/rooms/${roomId}/audio`, {
            headers: {
                'Authorization': `${localStorage.getItem('authToken')}`
            }
        });
        
        if (!response.ok) {
            throw new Error(`Failed to fetch room audio: ${response.status}`);
        }
        
        // Get the zip file as an array buffer
        const zipArrayBuffer = await response.arrayBuffer();
        
        // Extract and decode audio files
        return extractAndDecodeAudio(zipArrayBuffer);
    } catch (error) {
        console.error('Error fetching room audio:', error);
        throw error;
    }
}

// Extract audio files from zip and decode them
async function extractAndDecodeAudio(zipArrayBuffer) {
    try {
        // Validate zip array buffer
        if (!zipArrayBuffer || zipArrayBuffer.byteLength === 0) {
            throw new Error('Invalid or empty zip file received');
        }

        // Use JSZip to extract the files
        const JSZip = await import('https://cdn.jsdelivr.net/npm/jszip@3.10.1/+esm');
        const zip = new JSZip.default();
        
        // Load the zip file
        const zipContents = await zip.loadAsync(zipArrayBuffer);
        
        // Ensure audio context is in running state
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        if (audioContext.state !== 'running') {
            await audioContext.resume();
        }
        
        // Process each file in the zip
        const audioBuffers = {};
        const decodePromises = [];
        
        for (const filename in zipContents.files) {
            if (zipContents.files[filename].dir) continue;
            
            // Extract file data
            const fileData = await zipContents.files[filename].async('arraybuffer');
            if (fileData.byteLength === 0) {
                console.warn(`Skipping empty file: ${filename}`);
                continue;
            }
            
            // Determine instrument type from filename or metadata
            let instrument = 'unknown';
            if (filename.includes('drums')) instrument = 'drums';
            else if (filename.includes('guitar')) instrument = 'guitar';
            else if (filename.includes('piano')) instrument = 'piano';
            else if (filename.includes('bases')) instrument = 'bases';
            else if (filename.includes('violin')) instrument = 'violin';
            else if (filename.includes('trumpet')) instrument = 'trumpet';

            // Decode audio data with retry logic
            const decodePromise = (async () => {
                let attempts = 0;
                const maxAttempts = 3;
                let lastError;

                while (attempts < maxAttempts) {
                    try {
                        const audioBuffer = await audioContext.decodeAudioData(fileData.slice());
                        const key = `${instrument}/${filename}`;
                        audioBuffers[key] = audioBuffer;
                        console.log(`Successfully decoded audio file: ${key} on attempt ${attempts + 1}`);
                        return;
                    } catch (error) {
                        attempts++;
                        lastError = error;
                        console.log(`Decode attempt ${attempts} failed for ${filename}:`, error);
                        
                        if (attempts < maxAttempts) {
                            await new Promise(resolve => setTimeout(resolve, 500));
                        } else {
                            console.error(`Failed to decode ${filename} after ${maxAttempts} attempts:`, lastError);
                        }
                    }
                }
            })();
            
            decodePromises.push(decodePromise);
        }
        
        // Wait for all decoding to complete
        await Promise.all(decodePromises);
        
        // Return audio buffers even if some failed to decode
        return audioBuffers;
    } catch (error) {
        console.error('Error extracting audio files:', error);
        // Return empty buffers object rather than throwing
        return {};
    }
}

// Initialize WebSocket connection
export async function initializeWebSocket(token, roomId) {
    // Add auth headers as query parameters
    const authToken = localStorage.getItem('authToken');
    const userId = localStorage.getItem('userId');
    const WS_URL = `${config.WS_BASE_URL}/ws?token=${authToken}&userId=${userId}`;
    const ws = new WebSocket(WS_URL);
    
    return new Promise((resolve, reject) => {
    ws.onopen = () => {
        console.log('WebSocket connected');
        console.log('Attempting to join room:', roomId);
            
            // Send join_room message once connected
            ws.send(JSON.stringify({
                type: 'join_room',
                roomId: parseInt(roomId) // Backend expects roomId as number
            }));

            let hasJoinedRoom = false;
            let joinRoomTimeout = setTimeout(() => {
                if (!hasJoinedRoom) {
                    reject(new Error('Failed to join room: Connection timed out. Please try again.'));
                    ws.close();
                }
            }, 5000);

            // Handle WebSocket messages
            ws.addEventListener('message', (event) => {
                try {
                    const data = JSON.parse(event.data);
                    console.log('WebSocket message received:', data);
                    
                    switch (data.type) {
                        // Core state updates
                        case 'room_joined':
                            clearTimeout(joinRoomTimeout);
                            hasJoinedRoom = true;
                            console.log('Room joined successfully:', data);
                            // Filter uniqueness in the state update
                            const uniqueUsers = [];
                            const userIds = new Set();
                            (data.connectedUsers || []).forEach(user => {
                                if (user.userId && !userIds.has(user.userId)) {
                                    userIds.add(user.userId);
                                    uniqueUsers.push(user);
                                }
                            });
                            window.roomState.updateUsers(uniqueUsers);
                            
                            // Extract existing track info if present, or receive assigned instrument
                            const tracks = (data.song && data.song.tracks) || [];
                            
                            // Load existing tracks into room state
                            if (tracks.length > 0) {
                                console.log('Loading existing tracks:', tracks);
                                
                                // Add tracks first so they're visible
                                tracks.forEach(track => {
                                    window.roomState.addTrack(track);
                                    window.roomState.updateTrackLoadingState(track.id, 'loading');
                                });
                                
                                // Then try to load audio
                                fetchRoomAudio(window.roomState.roomId).then(audioBuffers => {
                                    console.log('Loaded audio buffers for room:', Object.keys(audioBuffers));
                                    
                                    // Process each track
                                    tracks.forEach(track => {
                                        const key = `${track.instrument}/${track.audioFile}`;
                                        if (audioBuffers[key]) {
                                            // Add to loaded sounds cache
                                            window.roomState.addLoadedSound(
                                                track.instrument,
                                                track.audioFile,
                                                audioBuffers[key]
                                            );
                                            
                                            // Update track with audio buffer
                                            window.roomState.updateTracks(track.id, {
                                                ...track,
                                                audioBuffer: audioBuffers[key]
                                            });
                                            window.roomState.updateTrackLoadingState(track.id, 'loaded');
                                        } else {
                                            window.roomState.updateTrackLoadingState(track.id, 'error', 'Failed to load audio');
                                        }
                                    });
                                }).catch(error => {
                                    console.error('Error loading room audio:', error);
                                    // Mark all tracks as error but keep them visible
                                    tracks.forEach(track => {
                                        window.roomState.updateTrackLoadingState(track.id, 'error', error.message);
                                    });
                                });
                            }
                            
                            // Set assigned instrument immediately
                            if (data.assignedInstrument) {
                                console.log('Setting assigned instrument:', data.assignedInstrument);
                                window.roomState.setCurrentInstrument(data.assignedInstrument);
                            }
                            
                            // If user has an existing track, use that instrument instead
                            const userTrack = tracks.find(track => track.ownerId === window.roomState.userId);
                            if (userTrack) {
                                console.log('User has existing track, using instrument:', userTrack.instrument);
                                window.roomState.setCurrentInstrument(userTrack.instrument);
                            }
                            // Update room info
                            window.roomState.updateRoomInfo({
                                roomId: data.roomId,
                                roomName: data.roomName
                            });
                            
                            // Resolve the WebSocket connection after room is fully joined
                            resolve(ws);
                            break;

                        case 'instrument_assigned':
                            window.roomState.setCurrentInstrument(data.instrument);
                            break;

                        case 'track_sound_updated':
                            // Event will be handled by sound-picker component
                            window.dispatchEvent(new CustomEvent('ws:track_sound_updated', {
                                detail: data
                            }));
                            break;

                        case 'user_joined':
                            window.roomState.updateUsers([
                                ...window.roomState.users,
                                {
                                    userId: data.userId,
                                    username: data.username
                                }
                            ]);
                            break;

                        case 'user_left':
                            window.roomState.updateUsers(
                                window.roomState.users.filter(u => u.userId !== data.userId)
                            );
                            break;

                        case 'mouse_position':
                            window.roomState.updateMousePosition(data.userId, data.position);
                            break;

                        case 'track_added':
                            console.log('Track added message received:', data.track);
                            if (data.track) {
                                // Ensure position is included
                                const trackWithPosition = {
                                    ...data.track,
                                    position: data.track.position ?? 0
                                };
                                window.roomState.addTrack(trackWithPosition);
                                
                                // Also apply position update immediately
                                window.roomState.updateTracks(data.track.id, {
                                    position: trackWithPosition.position
                                });
                            }
                            break;

                        case 'track_updated':
                            if (data.trackData && data.soundUrl) {
                                // Handle track update with sound URL
                                const processTrackUpdate = async () => {
                                    try {
                                        if (!window.roomState) {
                                            throw new Error('Room state not initialized');
                                        }

                                        console.log('Processing track update for:', data.soundUrl, 'with position:', data.trackData.position);

                                        // Create or update track with all data including position
                                        const fullTrackData = {
                                            ...data.trackData,
                                            position: data.trackData.position || 0,
                                            audioFile: data.trackData.audioFile,
                                            instrument: data.trackData.instrument
                                        };
                                        
                                        // First check if track exists, if not add it with full data
                                        const existingTrack = window.roomState.tracks.find(t => t.id === data.trackData.id);
                                        if (!existingTrack) {
                                            console.log('Track not found, adding new track:', fullTrackData);
                                            window.roomState.addTrack(fullTrackData);
                                        } else {
                                            console.log('Updating existing track with full data');
                                            window.roomState.updateTracks(data.trackData.id, fullTrackData);
                                        }
                                        
                                        window.roomState.updateTrackLoadingState(data.trackData.id, 'loading');

                                        // Get the existing buffer if available
                                        const key = `${data.trackData.instrument}/${data.trackData.audioFile}`;
                                        let existingBuffer = window.roomState.audio.loadedSounds.get(key);
                                        
                                        if (existingBuffer) {
                                            console.log('Using existing audio buffer for:', data.trackData.audioFile);
                                            window.roomState.updateTracks(data.trackData.id, {
                                                ...data.trackData,
                                                audioBuffer: existingBuffer
                                            });
                                            window.roomState.updateTrackLoadingState(data.trackData.id, 'loaded');
                                            return;
                                        }

                                        // Fetch the sound file
                                        const response = await fetch(`${config.API_BASE_URL}${data.soundUrl}`, {
                                            headers: {
                                                'Authorization': `${localStorage.getItem('authToken')}`
                                            }
                                        });
                                        
                                        if (!response.ok) {
                                            throw new Error(`Failed to fetch sound: ${response.status}`);
                                        }
                                        
                                        // Get zip file as array buffer
                                        const zipArrayBuffer = await response.arrayBuffer();
                                        if (zipArrayBuffer.byteLength === 0) {
                                            throw new Error('Received empty zip file');
                                        }
                                        console.log('Received zip file size:', zipArrayBuffer.byteLength);

                                        // Ensure audio context is created and resumed first
                                        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
                                        await audioContext.resume();
                                        console.log('Audio context state:', audioContext.state);

                                        // Extract audio from zip
                                        const JSZip = await import('https://cdn.jsdelivr.net/npm/jszip@3.10.1/+esm');
                                        const zip = new JSZip.default();
                                        const zipContents = await zip.loadAsync(zipArrayBuffer);
                                        
                                        // Get the first file in the zip
                                        const files = Object.keys(zipContents.files);
                                        if (files.length === 0) {
                                            throw new Error('No files found in the zip');
                                        }
                                        
                                        // Get the audio data
                                        const audioData = await zipContents.files[files[0]].async('arraybuffer');
                                        if (audioData.byteLength === 0) {
                                            throw new Error('Extracted empty audio data');
                                        }
                                        console.log('Extracted audio data size:', audioData.byteLength);

                                        // Add a small delay before decoding to ensure audio context is fully ready
                                        await new Promise(resolve => setTimeout(resolve, 100));
                                        
                                        // Decode audio data with retry logic
                                        let attempts = 0;
                                        const maxAttempts = 3;
                                        let lastError;

                                        while (attempts < maxAttempts) {
                                            try {
                                                const audioBuffer = await audioContext.decodeAudioData(audioData.slice());
                                                console.log('Successfully decoded audio on attempt:', attempts + 1);
                                                
                                                // Add sound to loaded sounds cache
                                                window.roomState.addLoadedSound(
                                                    data.trackData.instrument,
                                                    data.trackData.audioFile,
                                                    audioBuffer
                                                );
                                                
                                                // Update track with audio buffer
                                                window.roomState.updateTracks(data.trackData.id, {
                                                    ...data.trackData,
                                                    audioBuffer
                                                });
                                                window.roomState.updateTrackLoadingState(data.trackData.id, 'loaded');
                                                return;
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
                                        console.error('Error processing track update:', error);
                                        // Keep track but mark as error
                                        window.roomState.updateTrackLoadingState(data.trackData.id, 'error', error.message);
                                    }
                                };
                                processTrackUpdate();
                            } else {
                                // Handle simple track update
                                window.roomState.updateTracks(data.trackId, data.changes);
                            }
                            break;
                            
                        case 'track_moved':
                            // Only handle track movement if it's not our own track
                            const track = window.roomState.tracks.find(t => t.id === data.trackId);
                            if (track && track.ownerId !== window.roomState.userId) {
                                window.roomState.updateTracks(data.trackId, {
                                    position: data.position
                                });
                            }
                            break;

                        case 'track_removed':
                            window.roomState.removeTrack(data.trackId);
                            break;

                        // Other events bubble up as ws:type events
                        default:
                            window.dispatchEvent(new CustomEvent('ws:' + data.type, {
                                detail: data
                            }));
                            break;
                    }
                } catch (error) {
                    console.error('Error handling WebSocket message:', error);
                }
            });
        };

        ws.onclose = (event) => {
            console.log('WebSocket disconnected:', event.code, event.reason);
            // 1000 is normal closure, anything else is an error
            if (event.code !== 1000) {
                reject(new Error(`WebSocket closed unexpectedly: ${event.code} ${event.reason}`));
            }
            window.dispatchEvent(new CustomEvent('ws:disconnected', {
                detail: { code: event.code, reason: event.reason }
            }));
        };

        ws.onerror = (error) => {
            const errorMessage = 'Failed to establish WebSocket connection. Please check your internet connection and try again.';
            console.error('WebSocket error:', error);
            window.dispatchEvent(new CustomEvent('ws:error', {
                detail: { message: errorMessage }
            }));
            reject(new Error(errorMessage));
        };
    });
}

// Helper to send WebSocket messages
export function sendMessage(ws, type, data = {}) {
    if (!ws) {
        console.error('WebSocket not initialized');
        return;
    }
    
    // Add validation for move_track messages
    if (type === 'move_track' && !data.trackId) {
        return;
    }
    
    try {
        ws.send(JSON.stringify({
            type,
            ...data
        }));
    } catch (error) {
        console.error('Error sending WebSocket message:', error);
        window.dispatchEvent(new CustomEvent('ws:error', {
            detail: error
        }));
    }
}
