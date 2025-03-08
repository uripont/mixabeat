# MixaBeat Frontend

Test on: http://20.26.232.219

## Target directory structure after refactors

```
landing/          # TODO: Landing page with links to auth
└── ...

auth/            # Login and signup forms
└── ...

search/          # Room selection/creation screen
└── ...

room/            # Main music collaboration room
├── layout.html        # Main container for all room panels
├── room-state.js      # Global state management
├── websocket.js       # WebSocket connection & messaging
├── panel-resizer.js   # Panel resize logic
|
├── chat/...          # Right panel - Chat interface
├── canvas/...        # Center panel - Main workspace
├── sound-picker/...  # Left panel - Sound selection
└── sound-editor/...  # Bottom panel - Sound effects
```

## Auth and Session Management
Every page except the landing and auth pages implements session validation:

```javascript
// utils/auth.js
export async function requireAuth() {
    const token = localStorage.getItem('authToken');
    if (!token) { // Redirect to login if logged out
        window.location.href = '/auth.html';
        return false;
    }
    // Validate token with backend
    try {
        const response = await fetch('/api/auth/validate', {
            headers: { 'Authorization': token }
        });
        if (!response.ok) throw new Error('Invalid token');
        return true;
    } catch (error) { // Token invalid or expired
        localStorage.removeItem('authToken');
        window.location.href = '/auth.html';
        return false;
    }
}
```

## State Management

The room state system we have implemented is a wrapper over the browser's native DOM Event system, for simple yet flexible state management and UI updates.

### Room State Implementation

```javascript
// room/room-state.js
window.roomState = {
    // State is split into specific domains
    users: [],
    tracks: [],

    // and more (mouse positions, track status,...)
    
    // Update methods for each domain
    updateUsers(changes) {
        this.users = {...this.users, ...changes};
        // Notify only components watching users
        window.dispatchEvent(new CustomEvent('state:users', {
            detail: this.users
        }));
    },

    // Watch methods return cleanup functions
    watchUsers(callback) {
        const handler = e => callback(e.detail);
        window.addEventListener('state:users', handler);
        return () => window.removeEventListener('state:users', handler);
    }
};
```

Then the different logic parts of the application only subscribe to state they need, to *react* to changes.

Example: when adding a track clicking a button from sound-picker, it is updating the song's object, and we want to be making the canvas be aware of this change to display the new audio in the track correctly. This is why the song object (persisted as JSON) is stored in the room state, and the canvas is watching ("subscribed") for changes in the song object. We can have a handler that will be called every time the song object changes, and will re-render the canvas with the appropiate modifications.

### WebSocket Integration

WebSocket messages map directly to state updates:

```javascript
ws.addEventListener('message', (event) => {
    const data = JSON.parse(event.data);
    
    switch (data.type) {
        case 'user_joined':
            // Only notifies user list watchers
            window.roomState.updateUsers([...users, data.user]);
            break;
            
        case 'track_updated':
            // Only notifies track watchers
            window.roomState.updateTracks({
                [data.trackId]: data.changes
            });
            break;
    }
});
```

We can leave the "how this state change affects the overall interface" to the elements/scripts that are watching the state, and only care about the "what has changed" in the WebSocket handler. This way we have a centralized source of truth over which to read/write data, knowing that everything else is implemented to update accordingly.

This is part of the motivation behind modern frontend frameworks like React, where these pseudo-groups of DOM elements with logic are "components", and they are supposed to "react" to changes in the state of the application.

# Configuring VM for Static File Hosting

To serve static files via Apache on the VM:

1. Configure file permissions (one-time setup):
```bash
# Grant ownership to your admin user and www-data group
sudo chown -R uripont-admin:www-data /var/www/html/
# Set proper directory permissions
sudo chmod -R 775 /var/www/html/
```

2. Transfer files:
    - Use SFTP client (like FileZilla)
    - Connect to VM using admin credentials
    - Upload files to `/var/www/html/`

3. Access files:
    - Browse to your VM's public IP
    - Files in `/var/www/html/` will be served automatically
    - Verify that the files are accessible via a web browser (e.g. `http://<VM_IP>/` to access `index.html`)

Note: Apache serves files from `/var/www/html/` by default.
