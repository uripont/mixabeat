import { fetchAvailableSounds, base64ToAudioBuffer, previewSound } from './sound-picker-api.js';
import { sendMessage } from '../websocket.js';

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
                currentPreviewSource.stop();
                currentPreviewSource = null;
            }
            button.innerHTML = '<i class="fas fa-play"></i> Preview';
            isPlaying = false;
        } else {
            previewSoundItem(sound).then(() => {
                button.innerHTML = '<i class="fas fa-stop"></i> Stop';
                isPlaying = true;
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
    async function previewSoundItem(sound) {
        try {
            if (currentPreviewSource) {
                currentPreviewSource.stop();
                currentPreviewSource = null;
            }

            const key = `${window.roomState.audio.currentInstrument}/${sound.name}`;
            let audioBuffer = window.roomState.audio.loadedSounds.get(key);

            if (!audioBuffer) {
                audioBuffer = await base64ToAudioBuffer(sound.audioData);
                window.roomState.addLoadedSound(
                    window.roomState.audio.currentInstrument, 
                    sound.name, 
                    audioBuffer
                );
            }

            currentPreviewSource = previewSound(audioBuffer);
            currentPreviewSource.onended = () => {
                isPlaying = false;
                const button = soundsListEl.querySelector('.sound-item__preview');
                if (button) {
                    button.innerHTML = '<i class="fas fa-play"></i> Preview';
                }
            };
        } catch (error) {
            console.error('Error previewing sound:', error);
            isPlaying = false;
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

        // Send WebSocket message to use this sound
        sendMessage(ws, 'use_sound', {
            instrument: window.roomState.audio.currentInstrument,
            soundName: sound.name
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
