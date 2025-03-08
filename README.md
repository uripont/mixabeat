# MixaBeat Frontend

[Previous content remains unchanged until the Audio Loading Strategy section]

## Audio Loading Strategy

```mermaid
sequenceDiagram
    participant Client1 as Client
    participant Server
    participant Client2 as Other Client
    
    Client1->>Server: Join room (GET /rooms/:roomId/song)
    Server-->>Client1: Song metadata with track info
    Client1->>Server: GET /rooms/:roomId/audio
    Server-->>Client1: ZIP with only audio files used in tracks
    
    Note over Client1: User wants to add new drum track
    Client1->>Server: GET /instruments/drums/audio
    Server-->>Client1: ZIP with all available drum sounds
    Note over Client1: User can now preview and add new sounds

    Note over Client2: Meanwhile, other client adds new track
    Client2->>Server: WebSocket: use_sound {trackId, instrument, soundName}
    Note over Server: Server checks if client owns track<br/>Server loads audio file
    Server-->>Client1: WebSocket: track_updated {trackData, audioBuffer}
    Note over Client1: Gets new audio instantly via WebSocket

```

1. Server stores audio files organized by instrument type in `/audio` directory
2. Room contents in database references both instrument type and audio filename
3. Client makes requests in two scenarios:
   - When joining a room:
     * GET metadata (track positions, names, instruments)
     * GET ZIP of only the audio files used in current tracks
   - When adding new tracks:
     * GET all available sounds for a specific instrument
4. Connected clients receive new audio tracks in real-time:
   - When a client wants to use a sound, it sends the instrument and sound name
   - Server verifies the client owns the track
   - Server loads and includes audio data in the WebSocket message
   - Other clients receive both track metadata and audio buffer
   - No need to request audio separately when tracks are added
   - Efficient: Only the audio data that was added is transmitted

[Rest of the content remains unchanged]
