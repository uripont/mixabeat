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
        // Use JSZip to extract the files
        const JSZip = await import('https://cdn.jsdelivr.net/npm/jszip@3.10.1/+esm');
        const zip = new JSZip.default();
        
        // Load the zip file
        const zipContents = await zip.loadAsync(zipArrayBuffer);
        
        // Create audio context for decoding
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        
        // Process each file in the zip
        const audioBuffers = {};
        const decodePromises = [];
        
        for (const filename in zipContents.files) {
            if (zipContents.files[filename].dir) continue;
            
            // Extract file data
            const fileData = await zipContents.files[filename].async('arraybuffer');
            
            // Determine instrument type from filename or metadata
            // This assumes files are named with a pattern that indicates the instrument
            let instrument = 'unknown';
            if (filename.includes('drums')) instrument = 'drums';
            else if (filename.includes('guitar')) instrument = 'guitar';
            else if (filename.includes('piano')) instrument = 'piano';
            else if (filename.includes('bass')) instrument = 'bass';
            else if (filename.includes('synth')) instrument = 'synth';
            else if (filename.includes('violin')) instrument = 'violin';
            else if (filename.includes('trumpet')) instrument = 'trumpet';
            
            // Decode audio data
            const decodePromise = audioContext.decodeAudioData(fileData).then(audioBuffer => {
                const key = `${instrument}/${filename}`;
                audioBuffers[key] = audioBuffer;
                console.log(`Decoded audio file: ${key}`);
            }).catch(error => {
                console.error(`Error decoding audio file ${filename}:`, error);
            });
            
            decodePromises.push(decodePromise);
        }
        
        // Wait for all decoding to complete
        await Promise.all(decodePromises);
        
        return audioBuffers;
    } catch (error) {
        console.error('Error extracting audio files:', error);
        throw error;
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

            // Handle WebSocket messages
            ws.addEventListener('message', (event) => {
                try {
                    const data = JSON.parse(event.data);
                    console.log('WebSocket message received:', data);
                    
                    switch (data.type) {
                        // Core state updates
                        case 'room_joined':
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
                                
                                // First, fetch all audio files for the room
                                fetchRoomAudio(window.roomState.roomId).then(audioBuffers => {
                                    console.log('Loaded audio buffers for room:', Object.keys(audioBuffers));
                                    
                                    // Process each track
                                    tracks.forEach(track => {
                                        // Add track to room state first
                                        const trackWithAudio = { ...track };
                                        
                                        // If we have the audio buffer for this track, add it
                                        const key = `${track.instrument}/${track.audioFile}`;
                                        if (audioBuffers[key]) {
                                            trackWithAudio.audioBuffer = audioBuffers[key];
                                            
                                            // Also add to loaded sounds cache
                                            window.roomState.addLoadedSound(
                                                track.instrument,
                                                track.audioFile,
                                                audioBuffers[key]
                                            );
                                        }
                                        
                                        // Add track to room state
                                        window.roomState.addTrack(trackWithAudio);
                                    });
                                }).catch(error => {
                                    console.error('Error loading room audio:', error);
                                    
                                    // Fallback: Add tracks without audio and request them individually
                                    tracks.forEach(track => {
                                        // Add track to room state first (without audio buffer)
                                        window.roomState.addTrack(track);
                                        
                                        // If track has an audioFile, load it
                                        if (track.audioFile) {
                                            // This will trigger loading the audio file
                                            sendMessage(ws, 'use_sound', {
                                                trackId: track.id,
                                                instrument: track.instrument,
                                                soundName: track.audioFile,
                                                position: track.position,
                                                currentTime: 0
                                            });
                                        }
                                    });
                                });
                            }
                            
                            // Set current instrument based on user's track or assigned instrument
                            const userTrack = tracks.find(track => track.ownerId === window.roomState.userId);
                            if (userTrack) {
                                window.roomState.setCurrentInstrument(userTrack.instrument);
                            } else if (data.assignedInstrument) {
                                window.roomState.setCurrentInstrument(data.assignedInstrument);
                            }
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
                            window.roomState.addTrack(data.track);
                            break;

                        case 'track_updated':
                            if (data.trackData && data.soundUrl) {
                                // Handle track update with sound URL
                                const processTrackUpdate = async () => {
                                    try {
                                        // Fetch the sound file
                                        const response = await fetch(`${config.API_BASE_URL}${data.soundUrl}`, {
                                            headers: {
                                                'Authorization': `${localStorage.getItem('authToken')}`
                                            }
                                        });
                                        
                                        if (!response.ok) {
                                            throw new Error(`Failed to fetch sound: ${response.status}`);
                                        }
                                        
                                        // Convert to AudioBuffer
                                        const arrayBuffer = await response.arrayBuffer();
                                        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
                                        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
                                        
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
                                    } catch (error) {
                                        console.error('Error processing track update:', error);
                                    }
                                };
                                processTrackUpdate();
                            } else {
                                // Handle simple track update
                                window.roomState.updateTracks(data.trackId, data.changes);
                            }
                            break;
                            
                        case 'track_moved':
                            // Handle track movement
                            window.roomState.updateTracks(data.trackId, {
                                position: data.position
                            });
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
            
            resolve(ws);
        };

        ws.onclose = () => {
            console.log('WebSocket disconnected');
            // Let components handle reconnection if needed
            window.dispatchEvent(new CustomEvent('ws:disconnected'));
        };

        ws.onerror = (error) => {
            console.error('WebSocket error:', error);
            window.dispatchEvent(new CustomEvent('ws:error', {
                detail: error
            }));
            reject(error);
        };
    });
}

// Helper to send WebSocket messages
export function sendMessage(ws, type, data = {}) {
    if (!ws) {
        console.error('WebSocket not initialized');
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
