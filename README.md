## Architecture Overview

```mermaid
graph TB
    subgraph Frontend
        Client[Browser Client]
    end

    subgraph Backend
        Server[server.js]
        
        subgraph Routes
            direction LR
            AR[auth.routes.js]
            UR[users.routes.js]
            RR[rooms.routes.js]
            IR[instruments.routes.js]
        end
        
        subgraph Services
            direction LR
            AS[auth.service.js]
            US[users.service.js]
            RS[rooms.service.js]
            IS[instruments.service.js]
        end
        
        subgraph WebSocket
            WS[ws-server.js]
            WSH[handlers/index.js]
            subgraph Handlers
                direction LR
                CH[chat.handler.js]
                IH[instruments.handler.js]
                RH[rooms.handler.js]
                UH[utils.handler.js]
            end
        end
        
        subgraph Utils
            Logger[logger.js]
            Crypto[crypto.js]
        end
        
        subgraph Database
            DBC[db-connection.js]
            DBQ[db-queries.js]
        end
        
        subgraph Middleware
            Auth[auth.middleware.js]
        end
    end

    subgraph MySQL
        DB[(MySQL)]
    end

    %% Core Flow
    Client <--> Server
    Client <-.-> WS
    
    %% Routes Flow
    Server --> AR & UR & RR & IR
    AR & UR & RR & IR --> Auth

    %% Service Flow
    AR --> AS
    UR --> US
    RR --> RS
    IR --> IS
    
    %% WebSocket Flow
    WS --> WSH
    WSH --> CH & IH & RH
    CH & IH & RH --> UH
    IH --> IS
    RH --> RS
    
    %% Database Access
    Services --> DBC
    DBQ --> DBC
    DBC --> DB
    Auth --> DBQ
    
    %% Utils Usage
    AS & US & RS & IS & DBQ --> Logger
    AS --> Crypto
    
    %% Style definitions and classes
    classDef primary fill:#2374e1,stroke:#fff,stroke-width:2px,color:#fff
    classDef auth fill:#006064,stroke:#fff,stroke-width:2px,color:#fff
    classDef users fill:#ad1457,stroke:#fff,stroke-width:2px,color:#fff
    classDef rooms fill:#ef6c00,stroke:#fff,stroke-width:2px,color:#fff
    classDef instruments fill:#2e7d32,stroke:#fff,stroke-width:2px,color:#fff
    classDef chat fill:#6a1b9a,stroke:#fff,stroke-width:2px,color:#fff
    classDef utility fill:#37474f,stroke:#fff,stroke-width:2px,color:#fff
    classDef database fill:#1b5e20,stroke:#fff,stroke-width:2px,color:#fff
    
    class Server,Client,WS,WSH primary
    class AR,AS,Auth auth
    class UR,US users
    class RR,RS,RH rooms
    class IR,IS,IH instruments
    class CH chat
    class Logger,Crypto,UH utility
    class DBC,DBQ,DB database
```

## WebSocket Message Types

### Room Management
- **join_room**: Join a specific room
  - Parameters: `{ roomId: string }`
  - Response: `{ type: 'room_joined', roomData: object }`

### Chat
- **chat_message**: Send a chat message
  - Parameters: `{ message: string }`
  - Response: `{ type: 'chat_message', userId: string, message: string }`

### Track Management
- **use_sound**: Create or update a track with a sound
  - Parameters: `{ trackId?: string, instrument: string, soundName: string, position?: number }`
  - Response: `{ type: 'sound_updated', trackId: string, success: boolean, isNewTrack: boolean }`

- **move_track**: Update track position in real-time
  - Parameters: `{ trackId: string, position: number }`
  - Response: `{ type: 'track_moved', trackId: string, position: number }`
  - Broadcast: Sends position updates to all users in the room
  - Note: Used for real-time track movement synchronization

- **track_status**: Update track editing status
  - Parameters: `{ trackId: string, status: string }`
  - Response: `{ type: 'track_status', trackId: string, status: string }`

### Real-time Collaboration
- **mouse_position**: Share cursor position
  - Parameters: `{ x: number, y: number }`
  - Broadcast: Sends position to other users in room

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

For messages & chat:
- [x] Fix room joining websockets (sometimes it doesn't properly connect to joined room)
- [x] Get connected users on your room, to be called when joining (async via websocket)

For room management:
- [x] Endpoint to list all available rooms to join
- [x] Endpoint to join room by its current name (note that name can change over time, it's not an ID)

For song management:
- [x] Websocket message to update your current track
    - [x] Also makes server update the db with the updated track
- [x] Endpoint to get current song on this room (read from db, "checkpointed")

For real-time editing experience:
- [x] Websocket message to send mouse position on the canvas over time
- [x] Websocket messages to send track status changes (connected but not editing, editing, marked as finished)
- [x] Real-time track movement synchronization between users

For auth:
- [x] Better auth validation on endpoint (no repeated usernames, valid emails, minimum password length)
- [x] Endpoint to change username
- [x] Endpoint to change password
- [x] Endpoint to delete account
