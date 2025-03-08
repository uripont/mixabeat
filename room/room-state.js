// Initialize and expose room state
export function initializeRoomState() {
    window.roomState = {
        // Core state with logical domains (shared between components)
        users: [],        // Used by chat (user list) and canvas (cursors)
        tracks: [],       // Used by canvas and sound-editor
        mousePositions: {},  // Used by canvas to show other users
        playback: {       // Used by all audio-related components
            isPlaying: false,
            currentTime: 0
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
        }
    };

    return window.roomState;
}
