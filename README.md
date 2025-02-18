## Server Deployment Guide

### VM Setup
1. If the VM is shut down, start it using:
    - Azure portal
    - Cloud provider dashboard
    - CLI tooling

### Prerequisites
- Apache server (pre-installed and running on VM)
- SSH access credentials
- VM public IP: http://20.26.232.219

### Connecting to VM
Connect via SSH using your development machine:

```bash
ssh -i '/Users/uripont/.../Mixabeat-Server-VM_key.pem' uripont-admin@20.26.232.219
```

### Starting the API Server
Launch the Node.js server as a background process:

```bash
node server/server.js &
```

### Testing the API
Test the root endpoint from your local machine:

```bash
curl -v http://20.26.232.219:3000/
```

Note: Currently only the root endpoint ("/") is available.

## Current backend TODOs

For messages and real-time chat:
- [ ] DB schema for rooms and messages
- [ ] Create a new room (new entries on DB)
- [ ] Set up websocket connections
    - [ ] Join a room
    - [ ] Leave a room
- [ ] Implement callback on websocket message sent/received
    - [ ] Replace sillyserver message sending to listeners of this room with new websocket message sending
    - [ ] Persist messages into database (when received)
- [ ] Endpoint to get chat history for specific room

For user authentication:
- [ ] DB schema for users (password is hashed+salted)
- [ ] Use express-session for user session management (cookies, session stored in DB)
- [ ] Endpoint to register a new user
- [ ] Endpoint to login a user (returns a session token)
- [ ] Endpoint to logout a user (deletes session token)
- [ ] Implement user session management on all endpoints (middleware to reuse logic)

For music stuff:
- [ ] Make session schema also store the room's current song (json object with song info)
- [ ] Endpoint to set the room's current song from client (update done after finishing track)
- [ ] Endpoint to get the room's current song (for clients to sync)