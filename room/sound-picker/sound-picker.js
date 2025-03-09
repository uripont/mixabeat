import { fetchAvailableSounds, fetchSoundFile, base64ToAudioBuffer, previewSound } from './sound-picker-api.js';
import { sendMessage } from '../websocket.js';
import { getRandomColor, calculateTrackPosition } from '../canvas/track-state.js';

export function initializeSoundPicker(ws) {
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

    // Update displayed instrument when assigned
    window.roomState.watchAudio(({ currentInstrument }) => {
        if (currentInstrument) {
            const iconClass = getInstrumentIcon(currentInstrument);
            currentInstrumentEl.innerHTML = `
                <i class="fas ${iconClass}"></i>
                <span>${currentInstrument.charAt(0).toUpperCase() + currentInstrument.slice(1)}</span>
            `;
            loadAvailableSounds(currentInstrument);
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

    // Render sounds list
    function renderSoundsList(sounds) {
        soundsListEl.innerHTML = '';
        
        sounds.forEach(sound => {
            const soundItem = document.createElement('div');
            soundItem.className = 'sound-item';
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

            // Handle preview button click
            previewButton.addEventListener('click', (e) => {
                e.stopPropagation();
                togglePreview(previewButton, sound);
            });

            // Handle sound selection (clicking anywhere else on the item)
            soundItem.addEventListener('click', (e) => {
                if (!e.target.classList.contains('sound-item__preview')) {
                    selectSound(sound);
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
                
                // Find the specific button that triggered this preview
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
        // Remove previous selection
        const previousSelected = soundsListEl.querySelector('.sound-item.selected');
        if (previousSelected) {
            previousSelected.classList.remove('selected');
        }

        // Add new selection
        const selectedItem = Array.from(soundsListEl.children)
            .find(item => item.querySelector('.sound-item__name span').textContent === sound.name);
        if (selectedItem) {
            selectedItem.classList.add('selected');
        }

        // Create a new track with the selected sound
        const trackId = Date.now(); // Simple unique ID
        
        // Calculate position based on current playhead time
        let position;
        const totalWidth = 9000; // Same as in timeline.js
        const totalDuration = 30; // Same as in timeline.js
        
        if (window.roomState.playback && window.roomState.playback.currentTime > 0) {
            // Convert current time to position (same logic as timeline.getXFromTime)
            position = (window.roomState.playback.currentTime / totalDuration) * totalWidth;
            
            // Ensure position is not negative
            position = Math.max(0, position);
            
            console.log('Adding sound at playhead position:', position, 'for time:', window.roomState.playback.currentTime);
        } else {
            // Default position if playhead is at the beginning
            position = calculateTrackPosition(window.roomState.tracks);
            console.log('Adding sound at calculated position:', position);
        }
        
        const newTrack = {
            id: trackId,
            name: sound.name,
            instrument: window.roomState.audio.currentInstrument,
            soundName: sound.name,
            position: position,
            color: getRandomColor(),
            ownerId: window.roomState.userId
        };
        
        // Get the audio buffer
        const key = `${window.roomState.audio.currentInstrument}/${sound.name}`;
        const audioBuffer = window.roomState.audio.loadedSounds.get(key);
        
        if (audioBuffer) {
            newTrack.audioBuffer = audioBuffer;
        }
        
        // Add to room state
        window.roomState.addTrack(newTrack);
        
        // Send WebSocket message to use this sound
        sendMessage(ws, 'use_sound', {
            trackId: trackId,
            instrument: window.roomState.audio.currentInstrument,
            soundName: sound.name,
            position: position,
            currentTime: window.roomState.playback ? window.roomState.playback.currentTime : 0
        });
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
