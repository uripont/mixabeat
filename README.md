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
- MySQL database configured (see Database Setup)

### Database Setup
The application uses MySQL with two users:
- **root**: Admin access (local & remote) for database configuration
- **serverUser**: Limited privileges for Node.js application (localhost only)

1. Run database setup (note: passwords are templates, replace with secure values):
```bash
mysql -u root -p < creating_database.sql
```

2. Configure application:
```bash
cp env-template.txt .env
# Update .env with proper credentials
```

For direct database access from IDE, temporarily open VM port 3306 via Azure portal.

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
- [x] DB schema for rooms and messages
- [ ] Create a new room (new entries on DB)
- [ ] Set up websocket connections
    - [ ] Join a room
    - [ ] Leave a room
- [ ] Implement callback on websocket message sent/received
    - [ ] Replace sillyserver message sending to listeners of this room with new websocket message sending
    - [ ] Persist messages into database (when received)
- [ ] Endpoint to get chat history for specific room

For user authentication:
- [x] DB schema for users
- [x] Manual session management (cookies, session stored in DB)
- [x] Endpoint to register a new user (password is hashed+salted)
- [x] Endpoint to login a user (returns a session token)
- [ ] Endpoint to logout a user (deletes session token)
- [ ] Implement user session management on all endpoints (middleware to reuse logic)

For music stuff:
- [ ] Make session schema also store the room's current song (json object with song info)
- [ ] Endpoint to set the room's current song from client (update done after finishing track)
- [ ] Endpoint to get the room's current song (for clients to sync)
