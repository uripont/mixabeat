// Initialize and expose room state
export function initializeRoomState() {
    window.roomState = {
        // Core state
        userId: localStorage.getItem('userId'),
        connectedUsers: [],
        tracks: [],  // Will store audio tracks data
        
        // Local UI components watching for state changes
        uiComponents: [],  // Array of callbacks from UI components that need to react to state changes
        
        // Update state and notify UI components
        update(changes) {
            Object.assign(this, changes);
            this.notifyComponents();
        },
        
        // Register a UI component to watch state changes
        // Returns a cleanup function to unregister when component unmounts
        watchState(callback) {
            this.uiComponents.push(callback);
            // Call immediately with current state
            callback(this);
            return () => {
                this.uiComponents = this.uiComponents.filter(cb => cb !== callback);
            };
        },
        
        // Notify all registered UI components of state changes
        notifyComponents() {
            this.uiComponents.forEach(callback => callback(this));
        },

        // User management
        addUser(user) {
            if (!this.connectedUsers.some(u => u.userId === user.userId)) {
                this.update({
                    connectedUsers: [...this.connectedUsers, user]
                });
            }
        },

        removeUser(userId) {
            this.update({
                connectedUsers: this.connectedUsers.filter(user => user.userId !== userId)
            });
        },

        // Track management (to be used by canvas)
        addTrack(track) {
            this.update({
                tracks: [...this.tracks, track]
            });
        },

        updateTrack(trackId, changes) {
            this.update({
                tracks: this.tracks.map(track => 
                    track.id === trackId ? { ...track, ...changes } : track
                )
            });
        },

        removeTrack(trackId) {
            this.update({
                tracks: this.tracks.filter(track => track.id !== trackId)
            });
        }
    };

    return window.roomState;
}
