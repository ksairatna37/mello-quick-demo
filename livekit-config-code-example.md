Here's the complete code for the /api/livekit-token endpoint to add to your server.js:

1. Install Required Package
First, install the LiveKit Server SDK:

npm install livekit-server-sdk

2. Add to your server.js
const { AccessToken, RoomServiceClient } = require('livekit-server-sdk');
// Initialize LiveKit Room Service Client
const roomService = new RoomServiceClient(
  process.env.LIVEKIT_URL,
  process.env.LIVEKIT_API_KEY,
  process.env.LIVEKIT_API_SECRET
);
// API endpoint to create room and generate token
app.post('/api/livekit-token', async (req, res) => {
  try {
    const { 
      language = 'en-IN', 
      userId = `user-${Date.now()}`,
      userName = 'User'
    } = req.body;
    
    // Generate unique room name
    const roomName = `voice-session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    console.log(`Creating LiveKit room: ${roomName} for user: ${userId}`);
    
    // Create room with configuration
    await roomService.createRoom({
      name: roomName,
      emptyTimeout: 300, // Room closes after 5 minutes of being empty
      maxParticipants: 10,
      metadata: JSON.stringify({
        language: language,
        createdAt: new Date().toISOString()
      })
    });
    
    // Generate access token for user
    const token = new AccessToken(
      process.env.LIVEKIT_API_KEY,
      process.env.LIVEKIT_API_SECRET,
      {
        identity: userId,
        name: userName,
        // Token expires in 1 hour
        ttl: '1h'
      }
    );
    
    // Add permissions to the token
    token.addGrant({
      room: roomName,
      roomJoin: true,
      canPublish: true,      // Can send audio
      canSubscribe: true,    // Can receive audio
      canPublishData: true,  // Can send data messages
      canUpdateOwnMetadata: true
    });
    
    // Generate JWT token
    const jwt = await token.toJwt();
    
    console.log(`Room created successfully: ${roomName}`);
    
    // Return connection details
    res.json({
      success: true,
      token: jwt,
      roomName: roomName,
      livekit_url: process.env.LIVEKIT_URL,
      language: language,
      userId: userId,
      expiresIn: 3600 // 1 hour in seconds
    });
    
  } catch (error) {
    console.error('Error creating LiveKit room:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to create room',
      message: error.message 
    });
  }
});
// Optional: Endpoint to list active rooms (for debugging)
app.get('/api/livekit-rooms', async (req, res) => {
  try {
    const rooms = await roomService.listRooms();
    res.json({
      success: true,
      rooms: rooms.map(room => ({
        name: room.name,
        numParticipants: room.numParticipants,
        creationTime: room.creationTime,
        metadata: room.metadata
      }))
    });
  } catch (error) {
    console.error('Error listing rooms:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to list rooms' 
    });
  }
});
// Optional: Endpoint to delete a room (cleanup)
app.delete('/api/livekit-room/:roomName', async (req, res) => {
  try {
    const { roomName } = req.params;
    await roomService.deleteRoom(roomName);
    res.json({
      success: true,
      message: `Room ${roomName} deleted successfully`
    });
  } catch (error) {
    console.error('Error deleting room:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to delete room' 
    });
  }
});

3. Environment Variables
Make sure these are in your .env file or Azure App Service configuration:

LIVEKIT_URL=wss://your-project-xxxxx.livekit.cloud
LIVEKIT_API_KEY=APIxxxxxxxxxxxxx
LIVEKIT_API_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

4. Usage Example
Your frontend can call this endpoint like:

// From your React app
const response = await fetch('/api/livekit-token', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    language: 'hi-IN',  // or 'en-IN', 'ta-IN', etc.
    userId: 'user123',
    userName: 'John Doe'
  })
});
const data = await response.json();
console.log('LiveKit connection details:', data);
// Returns: { token, roomName, livekit_url, language, userId }

This endpoint will:

Create a unique LiveKit room
Generate a secure access token for the user
Return all the connection details needed for your React frontend to join the room
The Python agent (running separately) will automatically join the same room to handle voice processing