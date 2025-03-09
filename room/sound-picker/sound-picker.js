import { fetchAvailableSounds, fetchSoundFile, base64ToAudioBuffer, previewSound, cleanupAudio } from './sound-picker-api.js';
import { sendMessage } from '../websocket.js';
import { getRandomColor, calculateTrackPosition } from '../canvas/track-state.js';
import { TIMELINE_CONFIG } from '../canvas/timeline.js';

export function initializeSoundPicker(ws) {
    // Clean up audio context when page unloads
    window.addEventListener('unload', () => {
        cleanupAudio();
    });

    const currentInstrumentEl = document.getElementById('current-instrument');
    const soundsLoadingEl = document.getElementById('sounds-loading');
    const soundsListEl = document.getElementById('sounds-list');
    let currentPreviewSource = null;
    let isPlaying = false;

    // Helper to get the appropriate icon for each instrument
    function getInstrumentIcon(instrument) {
        switch(instrument.toLowerCase()) {
            case 'drums': return 'fa-drum';
            case 'bass': return 'fa-guitar';
            case 'synth': return 'fa-wave-square';
            default: return 'fa-music';
        }
    }

    // Initialize with current instrument if exists
    async function initializeWithCurrentInstrument() {
        const currentInstrument = window.roomState.audio.currentInstrument;
        if (currentInstrument) {
            try {
                // First update the UI to show the instrument
                const iconClass = getInstrumentIcon(currentInstrument);
                currentInstrumentEl.innerHTML = `
                    <i class="fas ${iconClass}"></i>
                    <span>${currentInstrument.charAt(0).toUpperCase() + currentInstrument.slice(1)}</span>
                `;

                // Show loading state while fetching sounds
                soundsLoadingEl.style.display = 'block';
                soundsListEl.style.display = 'none';

                // Load available sounds
                await loadAvailableSounds(currentInstrument);
            } catch (error) {
                console.error('Error initializing with current instrument:', error);
                soundsLoadingEl.innerHTML = `
                    <i class="fas fa-exclamation-circle"></i>
                    <span>Error loading sounds. Please refresh.</span>
                `;
            }
        }
    }

    // Initialize immediately if instrument exists
    initializeWithCurrentInstrument();

    // Update displayed instrument when it changes
    window.roomState.watchAudio(async ({ currentInstrument }) => {
        if (currentInstrument) {
            try {
                // First update the UI to show the instrument
                const iconClass = getInstrumentIcon(currentInstrument);
                currentInstrumentEl.innerHTML = `
                    <i class="fas ${iconClass}"></i>
                    <span>${currentInstrument.charAt(0).toUpperCase() + currentInstrument.slice(1)}</span>
                `;

                // Show loading state while fetching sounds
                soundsLoadingEl.style.display = 'block';
                soundsListEl.style.display = 'none';

                // Load available sounds
                await loadAvailableSounds(currentInstrument);
            } catch (error) {
                console.error('Error in watchAudio:', error);
                soundsLoadingEl.innerHTML = `
                    <i class="fas fa-exclamation-circle"></i>
                    <span>Error loading sounds. Please refresh.</span>
                `;
            }
        }
    });

    // Load available sounds for the instrument
    async function loadAvailableSounds(instrument) {
        try {
            soundsLoadingEl.style.display = 'block';
            soundsListEl.style.display = 'none';

            const sounds = await fetchAvailableSounds(instrument);
            window.roomState.setAvailableSounds(instrument, sounds);
            
            renderSoundsList(sounds);
            
            soundsLoadingEl.style.display = 'none';
            soundsListEl.style.display = 'block';
        } catch (error) {
            console.error('Error loading sounds:', error);
            soundsLoadingEl.innerHTML = `
                <i class="fas fa-exclamation-circle"></i>
                <span>Error loading sounds. Please try again.</span>
            `;
        }
    }

    // Toggle play/pause for preview
    function togglePreview(button, sound) {
        if (isPlaying) {
            if (currentPreviewSource) {
                try {
                    currentPreviewSource.stop();
                } catch (error) {
                    console.error('Error stopping preview:', error);
                }
                currentPreviewSource = null;
            }
            button.innerHTML = '<i class="fas fa-play"></i> Preview';
            isPlaying = false;
        } else {
            previewSoundItem(sound, button).then(() => {
                button.innerHTML = '<i class="fas fa-stop"></i> Stop';
                isPlaying = true;
            }).catch(error => {
                console.error('Error starting preview:', error);
                button.innerHTML = '<i class="fas fa-play"></i> Preview';
                isPlaying = false;
            });
        }
    }

    // Handler for preview button click
    function handlePreviewClick(e, button, sound) {
        e.preventDefault();
        e.stopPropagation();
        
        console.log('Preview click handler:', { sound });
        if (!sound || !sound.url) {
            console.error('Invalid sound object:', sound);
            return;
        }
        
        togglePreview(button, sound);
    }

    // Handler for sound selection
    function handleSoundSelect(e, sound) {
        e.preventDefault();
        e.stopPropagation();
        
        console.log('Sound select handler:', { sound });
        if (!sound || !sound.name) {
            console.error('Invalid sound object:', sound);
            return;
        }
        
        selectSound(sound);
    }

    // Render sounds list
    function renderSoundsList(sounds) {
        soundsListEl.innerHTML = '';
        
        sounds.forEach(sound => {
            const soundItem = document.createElement('div');
            soundItem.className = 'sound-item';
            soundItem.dataset.soundName = sound.name; // Store sound name for reference
            soundItem.innerHTML = `
                <div class="sound-item__name">
                    <i class="fas fa-file-audio"></i>
                    <span>${sound.name}</span>
                </div>
                <button class="sound-item__preview">
                    <i class="fas fa-play"></i>
                    Preview
                </button>
            `;

            const previewButton = soundItem.querySelector('.sound-item__preview');

            // Bind preview button event
            previewButton.addEventListener('mousedown', (e) => {
                if (e.button === 0) { // Left click only
                    handlePreviewClick(e, previewButton, sound);
                }
            });

            // Bind sound selection event
            soundItem.addEventListener('mousedown', (e) => {
                if (e.button === 0 && // Left click only
                    !e.target.classList.contains('sound-item__preview') && 
                    !e.target.closest('.sound-item__preview')) {
                    handleSoundSelect(e, sound);
                }
            });

            soundsListEl.appendChild(soundItem);
        });
    }

    // Preview a sound
    async function previewSoundItem(sound, button) {
        try {
            // Stop any currently playing preview
            if (currentPreviewSource) {
                try {
                    currentPreviewSource.stop();
                } catch (error) {
                    console.error('Error stopping previous preview:', error);
                }
                currentPreviewSource = null;
            }

            if (!sound || !sound.url) {
                throw new Error('Invalid sound object or missing URL');
            }

            // Get or load the audio buffer
            const key = `${window.roomState.audio.currentInstrument}/${sound.name}`;
            let audioBuffer = window.roomState.audio.loadedSounds.get(key);

            if (!audioBuffer) {
                console.log('Loading sound file for preview:', sound.name);
                audioBuffer = await fetchSoundFile(sound.url);
                window.roomState.addLoadedSound(
                    window.roomState.audio.currentInstrument, 
                    sound.name, 
                    audioBuffer
                );
            }

            // Create and play the preview
            currentPreviewSource = previewSound(audioBuffer);
            
            // Set up the onended event handler
            currentPreviewSource.onended = () => {
                console.log('Preview playback ended');
                isPlaying = false;
                currentPreviewSource = null;
                
                if (button) {
                    button.innerHTML = '<i class="fas fa-play"></i> Preview';
                }
            };
            
            return currentPreviewSource;
        } catch (error) {
            console.error('Error previewing sound:', error);
            isPlaying = false;
            currentPreviewSource = null;
            throw error;
        }
    }

    // Select a sound for use
    function selectSound(sound) {
        if (!sound || !sound.name) {
            console.error('Invalid sound object:', sound);
            return;
        }

        console.log('selectSound called for:', sound.name);
        
        // Find the selected item once and use it for all operations
        const selectedItem = Array.from(soundsListEl.children)
            .find(item => item.dataset.soundName === sound.name);
            
        // Show loading state
        if (selectedItem) {
            selectedItem.classList.add('loading');
            const loadingSpinner = document.createElement('div');
            loadingSpinner.className = 'sound-item__loading';
            loadingSpinner.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
            selectedItem.appendChild(loadingSpinner);
        }
        
        // Remove previous selection
        const previousSelected = soundsListEl.querySelector('.sound-item.selected');
        if (previousSelected) {
            previousSelected.classList.remove('selected');
            console.log('Removed previous selection');
        }

        // Add new selection
        if (selectedItem) {
            selectedItem.classList.add('selected');
        }

        // Create a new track with the selected sound
        const trackId = Date.now(); // Simple unique ID
        
        // Calculate position based on current playhead time
        let position;
        
        // Calculate 3s boundary position (yellow line)
        const maxPosition = (TIMELINE_CONFIG.loopPoint / TIMELINE_CONFIG.totalDuration) * 
                          TIMELINE_CONFIG.totalWidth - 100; // Subtract track width
        
        // Get position based on playhead or default position
        let rawPosition;
        if (window.roomState.playback && window.roomState.playback.currentTime > 0) {
            rawPosition = (window.roomState.playback.currentTime / TIMELINE_CONFIG.totalDuration) * 
                         TIMELINE_CONFIG.totalWidth;
        } else {
            rawPosition = calculateTrackPosition(window.roomState.tracks);
        }
        
        // Ensure position is within bounds
        position = Math.min(Math.max(0, rawPosition), maxPosition);
        console.log('Adding sound at position:', position, '(max allowed:', maxPosition, ')');
        
        const newTrack = {
            id: trackId,
            name: sound.name,
            instrument: window.roomState.audio.currentInstrument,
            soundName: sound.name,
            position: position,
            color: getRandomColor(),
            ownerId: window.roomState.userId
        };
        
        // Get or fetch the audio buffer
        const key = `${window.roomState.audio.currentInstrument}/${sound.name}`;
        const audioBuffer = window.roomState.audio.loadedSounds.get(key);
        
        // Send track creation with position first
        sendMessage(ws, 'use_sound', {
            trackId: trackId,
            instrument: window.roomState.audio.currentInstrument,
            soundName: sound.name,
            position: position,
            currentTime: window.roomState.playback ? window.roomState.playback.currentTime : 0,
            track: newTrack // Include full track data
        });

        // Send multiple move_track messages with delays to ensure position sync
        const sendPositionUpdates = () => {
            let updatesSent = 0;
            const maxUpdates = 5;
            const updateInterval = 200; // 200ms between updates

            const sendUpdate = () => {
                if (updatesSent < maxUpdates) {
                    sendMessage(ws, 'move_track', {
                        trackId: trackId,
                        position: position
                    });
                    updatesSent++;
                    setTimeout(sendUpdate, updateInterval);
                }
            };

            // Start sending updates after initial delay
            setTimeout(sendUpdate, 100);
        };

        // Start position update sequence
        sendPositionUpdates();

        // Then add track locally
        if (audioBuffer) {
            console.log('Found existing audio buffer for:', sound.name);
            newTrack.audioBuffer = audioBuffer;
            window.roomState.addTrack(newTrack);
        } else if (sound.url) {
            console.log('No audio buffer found for:', sound.name, 'attempting to fetch...');
            // First add track to state so it appears
            window.roomState.addTrack(newTrack);

            // Then fetch audio buffer
            fetchSoundFile(sound.url).then(buffer => {
                console.log('Successfully fetched audio buffer for:', sound.name);
                window.roomState.addLoadedSound(
                    window.roomState.audio.currentInstrument,
                    sound.name,
                    buffer
                );
                window.roomState.updateTracks(trackId, { audioBuffer: buffer });
                
                // Remove loading state
                if (selectedItem) {
                    selectedItem.classList.remove('loading');
                    const loadingSpinner = selectedItem.querySelector('.sound-item__loading');
                    if (loadingSpinner) {
                        loadingSpinner.remove();
                    }
                }
            }).catch(error => {
                console.error('Failed to fetch audio buffer for:', sound.name, error);
                
                // Show error state and remove loading state
                if (selectedItem) {
                    selectedItem.classList.remove('loading');
                    selectedItem.classList.add('error');
                    const loadingSpinner = selectedItem.querySelector('.sound-item__loading');
                    if (loadingSpinner) {
                        loadingSpinner.remove();
                    }
                    
                    // Show error message
                    const errorMsg = document.createElement('div');
                    errorMsg.className = 'sound-item__error';
                    errorMsg.innerHTML = `<i class="fas fa-exclamation-circle"></i> Failed to load sound`;
                    selectedItem.appendChild(errorMsg);
                    
                    // Remove error message after 3 seconds
                    setTimeout(() => {
                        selectedItem.classList.remove('error');
                        errorMsg.remove();
                    }, 3000);
                }
                
                // Remove the track since we couldn't load its audio
                window.roomState.removeTrack(trackId);
            });
        } else {
            console.error('Cannot load sound: no audio buffer and no URL provided');
            return;
        }
    }

    // Handle incoming WebSocket messages
    window.addEventListener('ws:track_sound_updated', async (event) => {
        const { trackId, audioData } = event.detail;
        try {
            const audioBuffer = await base64ToAudioBuffer(audioData);
            const key = `${window.roomState.audio.currentInstrument}/${event.detail.soundName}`;
            window.roomState.addLoadedSound(
                window.roomState.audio.currentInstrument,
                event.detail.soundName,
                audioBuffer
            );
            window.roomState.updateTracks(trackId, { 
                audioBuffer,
                soundName: event.detail.soundName
            });
        } catch (error) {
            console.error('Error processing track sound update:', error);
        }
    });
}
