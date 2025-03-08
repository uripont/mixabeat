# MixaBeat Frontend

## Target directory structure after refactors

```
landing/          # TODO: Landing page with links to auth
├── landing.html
└── landing.css

auth/            # Login and signup forms
├── auth.html
└── auth.css

search/          # Room selection/creation screen
├── search.html
└── search.css

room/            # Main music collaboration room
├── layout.html  # Main container for all room panels
├── layout.css   # Panel layout styles
│
├── chat/        # Right panel - Chat interface
│   ├── chat.html
│   └── chat.css
│
├── canvas/      # Center panel - Main workspace
│   ├── canvas.html
│   └── canvas.css
│
├── sound-picker/    # Left panel - Sound selection
│   ├── sound-picker.html
│   └── sound-picker.css
│
└── sound-editor/    # Bottom panel - Sound effects
    ├── sound-editor.html
    └── sound-editor.css
```

### Screen Descriptions

- **Landing**: TODO - Will be the entry point with links to login/signup
- **Auth**: Login and signup forms for user authentication
- **Search**: Room selection and creation interface
- **Room**: Main application view split into panels:
  - Chat (Right): Real-time messaging between room participants
  - Canvas (Center): Main workspace for music collaboration
  - Sound Picker (Left): Interface for selecting sounds/instruments
  - Sound Editor (Bottom): Controls for sound effects and editing

Each screen has its own HTML and CSS files to maintain a clear separation of concerns. The room screen uses a layout file to compose its different panels into a cohesive interface while keeping each panel's code modular and maintainable.

Test on: http://20.26.232.219

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

## Current frontend TODOs

Landing page and login:
- [ ] Make index page be a landing page showcasing the interface / features, with a button to redirect to sign up or log in (instead of a full screen login form)
- [x] UI-based feedback on form filling errors:
    - [x] Client-side validation for required fields
    - [x] Client-side email format validation
    - [x] Client-side password length validation (min 6 chars)
    - [x] Username already exists (after endpoint response)
    - [x] Wrong password (after endpoint response)
    - [x] Username not found (after endpoint response)
    - [x] Loading states during API calls
    - [x] Error message display with auto-dismiss
    - [x] Store user info in localStorage
    - [x] Success feedback before redirect

Room Selection Screen:
- [x] List available rooms with song names
- [x] Create room functionality
- [x] Join room by ID functionality
- [x] Basic error handling and loading states
- [x] Auto-refresh room list
- [x] Separate search screen API wrapper
- [x] Dedicated styles for room selection
- [ ] Show room creator usernames (requires backend changes)
- [ ] Add room deletion if you're the creator

Migration Status (as of latest update):
1. Completed:
   - Set up auth HTML structure with login/signup forms
   - Implemented auth API wrapper (login, signup, logout)
   - Added client-side form validation
   - Added loading states and error handling
   - Fixed module loading issues
   - Updated redirects to main page
   - Fixed auth route paths and error handling
   - Refactored search screen with its own API wrapper
   - Fixed room creation and joining functionality
   - Improved error handling for room operations
   - Added fallback for undefined creator names

2. Next Steps:
   - Auto redirect to room selection if already logged in (token in localStorage is still valid)
   - Implement real-time chat interface in room
   - Add room creator username to room list from backend
   - Allow room deletion for creators

For room management:
- [ ] Screen to show all available rooms (after endpoint response), as well as small moving song creation form to small widget on this screen
- [ ] Join room by room name option (small widget)
- [ ] UI Errors on both room creation and room joining
- [ ] Section on this page that allows changing username / password / logout / delete account, using backend endnpoints


For song room interface:
- [ ] Left side, list all available sounds in your track based on its instrument/role
- [ ] Left side, list as well uploaded sounds during this session
- [ ] Click on sound to instantiate it on the timeline ON the current time position
- [ ] Drag to move selected sound on the track
- [ ] Click on sound inside track to open a small widget with options to delete / edit parameters: change volume / pitch / ...?
- [ ] Click space to play / pause the song
- [ ] Click keys on keyboard to instantiate sounds on the track
    - [ ] Lower part "pad": associate different available sounds to different keys
    - [ ] "Pad": click on a box to edit the sound associated to that key
- [ ] Click square buttom to move audio time to the beginning
- [ ] Use mouse scroll to horizontally scroll the timeline (your track is always centered / at the top, other tracks are shown smaller because you can't edit them)
- [ ] Button to confirm your track is finished (= send message to others as finished editing track)
- [ ] Button to leave the room, back to room selection screen
- [ ] Button to download the song inside room (encodes client-side the current song to a file, and gets downloaded automatically). 

For song update management (yours):
- [ ] Send websocket message to notify when you have connected to a track
- [ ] Send websocket message to notify when you have made changes to a track you have not confirmed yet
- [ ] Send websocket message to notify when you have finished editing that change
- [ ] Send websocket message to notify when you have stopped editing the track (disconnected)

- [ ] Send websocket messages continuously with the mouse position on the canvas (when it changes)


For song update management (others):
- [ ] When receiving that someone has connected to its track, show the track background highlighted (to know that track is being edited)
- [ ] When someone is editing the track, show the track background highlighted differently (to know that track is being edited as of now)
- [ ] When someone has finished editing the track, show the track background highlighted differently (to know that track has been edited, and that the edit will aply as soon as possible when you are not reproducing the song's audio).
    - [ ] Apply song changes from the queue of pending updates to apply, re-rendering canvas for other's tracks.
- [ ] When someone has disconnected from the track, show the track background as normal (to know that track is not being edited anymore, owner has disconnected).

- [ ] Use received positions to show the mouse position of other users on the canvas, color matching their color on the connected users widget on the chat
    - [ ] Smoothly interpolate mouse position from the last received position to the current one, to make it look like a smooth movement over time.
