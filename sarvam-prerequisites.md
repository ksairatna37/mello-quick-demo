Node.js App Service Requirements
1. Install LiveKit Server SDK
npm install livekit-server-sdk

The livekit-server-sdk supports Node.js 16+ so your v23.4.0 is excellent.

2. Node.js Environment Variables
Add these to your existing Node.js App Service:

LIVEKIT_URL=wss://your-project-xxxxx.livekit.cloud
LIVEKIT_API_KEY=APIxxxxxxxxxxxxx
LIVEKIT_API_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

3. Node.js Code for Room Creation
Add this to your existing server.js:

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
    const { language = 'en-IN', userId = 'user' } = req.body;
    const roomName = `voice-session-${Date.now()}`;
    
    // Create room
    await roomService.createRoom({
      name: roomName,
      emptyTimeout: 300, // 5 minutes
      maxParticipants: 10
    });
    
    // Generate access token for user
    const token = new AccessToken(
      process.env.LIVEKIT_API_KEY,
      process.env.LIVEKIT_API_SECRET,
      {
        identity: userId,
        name: `User-${userId}`,
      }
    );
    
    token.addGrant({
      room: roomName,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
    });
    
    const jwt = await token.toJwt();
    
    res.json({
      token: jwt,
      roomName: roomName,
      livekit_url: process.env.LIVEKIT_URL,
      language: language
    });
    
  } catch (error) {
    console.error('Error creating LiveKit room:', error);
    res.status(500).json({ error: 'Failed to create room' });
  }
});

Complete Setup Summary
Python App Service (Voice Agent)
# Dependencies
pip install "livekit-agents[sarvam,openai,silero]" python-dotenv
# Environment Variables
LIVEKIT_URL=wss://your-project-xxxxx.livekit.cloud
LIVEKIT_API_KEY=APIxxxxxxxxxxxxx
LIVEKIT_API_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
SARVAM_API_KEY=sk_xxxxxxxxxxxxxxxxxxxxxxxx
AZURE_OPENAI_API_KEY=your-azure-openai-key
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com/
AZURE_OPENAI_API_VERSION=2024-02-15-preview
# Startup Command
python agent.py dev

Node.js App Service (Your Web App)
# Additional dependency
npm install livekit-server-sdk
# Environment Variables (add to existing)
LIVEKIT_URL=wss://your-project-xxxxx.livekit.cloud
LIVEKIT_API_KEY=APIxxxxxxxxxxxxx
LIVEKIT_API_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
# Your existing startup
node server.js

Frontend Integration (React)
For your React frontend, you'll also need:

npm install @livekit/components-react livekit-client

Your Node.js v23.4.0 is perfect for this setup! The LiveKit Server SDK will work flawlessly with your current version 