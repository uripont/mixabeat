# MixaBeat Frontend Refactor Status

## Completed ✅
- [x] Auth module with error handling
- [x] Room selection and creation
- [x] Room layout structure

## Next Steps: Room & Chat Implementation

### Room Connection Flow
1. After successful room join:
   - Connect to websocket server
   - Join room-specific channel
   - Load room state (contents/song data)
   - Load chat history

### Chat Module Implementation
1. Chat Panel
   - Load message history from backend
   - Display messages with sender info
   - Message input and sending
   - Real-time updates via websocket

### WebSocket Integration
1. Connection Management
   ```javascript
   // On room join
   ws = new WebSocket(WS_URL);
   ws.onopen = () => {
     sendJoinRoom(roomId);
   };
   ```

2. Message Types
   ```javascript
   // Server -> Client
   {
     type: 'chat_message',
     data: { sender, message, timestamp }
   }
   {
     type: 'room_state',
     data: { contents, users }
   }

   // Client -> Server
   {
     type: 'join_room',
     data: { roomId }
   }
   {
     type: 'chat_message',
     data: { message }
   }
   ```

3. Error Handling
   - Connection loss detection
   - Automatic reconnection
   - Message queue for offline period

## Testing Checklist

### WebSocket Connection
- [ ] Connects on room join
- [ ] Receives initial room state
- [ ] Handles disconnects properly

### Chat Functionality
- [ ] Loads chat history
- [ ] Sends messages successfully
- [ ] Receives real-time messages
- [ ] Shows user join/leave updates

### Room State
- [ ] Receives initial song data
- [ ] Handles room state updates
- [ ] Persists state on refresh
