// Initialize and expose room state
export function initializeRoomState() {
    window.roomState = {
        // Core state with logical domains (shared between components)
        userId: null,     // Current user's ID
        users: [],        // Used by chat (user list) and canvas (cursors)
        tracks: [],       // Used by canvas and sound-editor
        mousePositions: {},  // Used by canvas to show other users
        playback: {       // Used by all audio-related components
            isPlaying: false,
            currentTime: 0
        },

        // Audio state management
        audio: {
            loadedSounds: new Map(),  // {instrumentName/soundName -> AudioBuffer}
            availableSounds: {},      // Sounds available per instrument
            currentInstrument: null,  // Set when joining room
        },

        // Update methods for each domain
        updateUsers(changes) {
            this.users = [...this.users];
            Object.assign(this.users, changes);
            window.dispatchEvent(new CustomEvent('state:users', {
                detail: this.users
            }));
        },

        updateTracks(trackId, changes) {
            this.tracks = this.tracks.map(track => 
                track.id === trackId ? { ...track, ...changes } : track
            );
            window.dispatchEvent(new CustomEvent('state:tracks', {
                detail: this.tracks
            }));
        },

        addTrack(track) {
            this.tracks = [...this.tracks, track];
            window.dispatchEvent(new CustomEvent('state:tracks', {
                detail: this.tracks
            }));
        },

        removeTrack(trackId) {
            this.tracks = this.tracks.filter(track => track.id !== trackId);
            window.dispatchEvent(new CustomEvent('state:tracks', {
                detail: this.tracks
            }));
        },

        updateMousePosition(userId, position) {
            this.mousePositions = {
                ...this.mousePositions,
                [userId]: position
            };
            window.dispatchEvent(new CustomEvent('state:mouse', {
                detail: this.mousePositions
            }));
        },

        updatePlayback(changes) {
            this.playback = {
                ...this.playback,
                ...changes
            };
            window.dispatchEvent(new CustomEvent('state:playback', {
                detail: this.playback
            }));
        },

        // Audio state update methods
        updateAudio(changes) {
            this.audio = {
                ...this.audio,
                ...changes
            };
            window.dispatchEvent(new CustomEvent('state:audio', {
                detail: this.audio
            }));
        },

        setCurrentInstrument(instrument) {
            this.audio.currentInstrument = instrument;
            window.dispatchEvent(new CustomEvent('state:audio', {
                detail: this.audio
            }));
        },

        addLoadedSound(instrument, soundName, audioBuffer) {
            const key = `${instrument}/${soundName}`;
            this.audio.loadedSounds.set(key, audioBuffer);
            window.dispatchEvent(new CustomEvent('state:audio', {
                detail: this.audio
            }));
        },

        setAvailableSounds(instrument, sounds) {
            this.audio.availableSounds[instrument] = sounds;
            window.dispatchEvent(new CustomEvent('state:audio', {
                detail: this.audio
            }));
        },

        // Watch methods for each domain
        watchUsers(callback) {
            const handler = e => callback(e.detail);
            window.addEventListener('state:users', handler);
            return () => window.removeEventListener('state:users', handler);
        },

        watchTracks(callback) {
            const handler = e => callback(e.detail);
            window.addEventListener('state:tracks', handler);
            return () => window.removeEventListener('state:tracks', handler);
        },

        watchMousePositions(callback) {
            const handler = e => callback(e.detail);
            window.addEventListener('state:mouse', handler);
            return () => window.removeEventListener('state:mouse', handler);
        },

        watchPlayback(callback) {
            const handler = e => callback(e.detail);
            window.addEventListener('state:playback', handler);
            return () => window.removeEventListener('state:playback', handler);
        },

        watchAudio(callback) {
            const handler = e => callback(e.detail);
            window.addEventListener('state:audio', handler);
            return () => window.removeEventListener('state:audio', handler);
        }
    };

    return window.roomState;
}
