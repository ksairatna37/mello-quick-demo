Here's the complete frontend implementation for connectHindiVoice() using React and LiveKit:

1. Install Frontend Dependencies
npm install @livekit/components-react livekit-client

2. React Component with connectHindiVoice()
import React, { useState, useCallback, useRef } from 'react';
import { 
  LiveKitRoom, 
  RoomAudioRenderer, 
  useVoiceAssistant,
  BarVisualizer 
} from '@livekit/components-react';
import { Room, RoomEvent } from 'livekit-client';
const VoiceAssistant = () => {
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionData, setConnectionData] = useState(null);
  const [error, setError] = useState(null);
  const roomRef = useRef(null);
  // Connect to Hindi Voice Assistant
  const connectHindiVoice = useCallback(async () => {
    try {
      setIsConnecting(true);
      setError(null);
      
      console.log('Requesting Hindi voice session...');
      
      // Call your Node.js endpoint to create room and get token
      const response = await fetch('/api/livekit-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          language: 'hi-IN',  // Hindi
          userId: `user-${Date.now()}`,
          userName: 'User'
        })
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.message || 'Failed to create voice session');
      }
      console.log('Voice session created:', data);
      
      // Store connection data
      setConnectionData({
        token: data.token,
        serverUrl: data.livekit_url,
        roomName: data.roomName,
        language: data.language
      });
      
      setIsConnected(true);
      
    } catch (err) {
      console.error('Error connecting to Hindi voice:', err);
      setError(err.message);
    } finally {
      setIsConnecting(false);
    }
  }, []);
  // Disconnect from voice session
  const disconnectVoice = useCallback(async () => {
    try {
      if (roomRef.current) {
        await roomRef.current.disconnect();
      }
      setIsConnected(false);
      setConnectionData(null);
      setError(null);
      console.log('Disconnected from voice session');
    } catch (err) {
      console.error('Error disconnecting:', err);
    }
  }, []);
  // Room event handlers
  const handleRoomConnected = useCallback(() => {
    console.log('Connected to LiveKit room');
  }, []);
  const handleRoomDisconnected = useCallback(() => {
    console.log('Disconnected from LiveKit room');
    setIsConnected(false);
    setConnectionData(null);
  }, []);
  const handleRoomError = useCallback((error) => {
    console.error('Room error:', error);
    setError(error.message);
  }, []);
  return (
    <div className="voice-assistant-container">
      <div className="voice-controls">
        <h2>Hindi Voice Assistant</h2>
        
        {error && (
          <div className="error-message" style={{ color: 'red', marginBottom: '10px' }}>
            Error: {error}
          </div>
        )}
        
        {!isConnected ? (
          <button 
            onClick={connectHindiVoice}
            disabled={isConnecting}
            className="connect-button"
            style={{
              padding: '12px 24px',
              fontSize: '16px',
              backgroundColor: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: isConnecting ? 'not-allowed' : 'pointer',
              opacity: isConnecting ? 0.6 : 1
            }}
          >
            {isConnecting ? 'Connecting...' : 'Connect to Hindi Voice Assistant'}
          </button>
        ) : (
          <div className="connected-controls">
            <p style={{ color: 'green', marginBottom: '10px' }}>
              ✅ Connected to Hindi Voice Assistant
            </p>
            <p style={{ fontSize: '14px', color: '#666', marginBottom: '15px' }}>
              Room: {connectionData?.roomName}
            </p>
            <button 
              onClick={disconnectVoice}
              className="disconnect-button"
              style={{
                padding: '12px 24px',
                fontSize: '16px',
                backgroundColor: '#dc3545',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer'
              }}
            >
              Disconnect
            </button>
          </div>
        )}
      </div>
      {/* LiveKit Room Component */}
      {isConnected && connectionData && (
        <LiveKitRoom
          token={connectionData.token}
          serverUrl={connectionData.serverUrl}
          connect={true}
          audio={true}
          video={false}
          onConnected={handleRoomConnected}
          onDisconnected={handleRoomDisconnected}
          onError={handleRoomError}
          className="livekit-room"
        >
          {/* Audio renderer for voice assistant responses */}
          <RoomAudioRenderer />
          
          {/* Voice Assistant Component */}
          <VoiceAssistantComponent />
        </LiveKitRoom>
      )}
    </div>
  );
};
// Voice Assistant UI Component
const VoiceAssistantComponent = () => {
  const { state, audioTrack } = useVoiceAssistant();
  
  return (
    <div className="voice-assistant-ui" style={{ marginTop: '20px' }}>
      <div className="assistant-status">
        <h3>Assistant Status: {state}</h3>
        
        {/* Audio visualizer when speaking */}
        {audioTrack && (
          <div className="audio-visualizer" style={{ marginTop: '15px' }}>
            <BarVisualizer 
              trackRef={audioTrack} 
              barCount={20}
              minBarHeight={2}
              maxBarHeight={50}
              accentColor="#007bff"
            />
          </div>
        )}
        
        {/* Status indicators */}
        <div className="status-indicators" style={{ marginTop: '15px' }}>
          <div className={`status-dot ${state === 'listening' ? 'active' : ''}`}>
            🎤 {state === 'listening' ? 'Listening...' : 'Not listening'}
          </div>
          <div className={`status-dot ${state === 'thinking' ? 'active' : ''}`}>
            🤔 {state === 'thinking' ? 'Processing...' : 'Ready'}
          </div>
          <div className={`status-dot ${state === 'speaking' ? 'active' : ''}`}>
            🗣️ {state === 'speaking' ? 'Speaking...' : 'Silent'}
          </div>
        </div>
      </div>
      
      {/* Instructions */}
      <div className="instructions" style={{ marginTop: '20px', padding: '15px', backgroundColor: '#f8f9fa', borderRadius: '6px' }}>
        <h4>How to use:</h4>
        <ul>
          <li>Click "Connect to Hindi Voice Assistant" to start</li>
          <li>Speak in Hindi - the assistant will understand and respond</li>
          <li>The assistant also understands English and code-mixed Hindi-English</li>
          <li>Wait for the assistant to finish speaking before talking again</li>
        </ul>
      </div>
    </div>
  );
};
export default VoiceAssistant;

3. Alternative Languages
You can easily create functions for other languages:

// Connect to Tamil Voice Assistant
const connectTamilVoice = useCallback(async () => {
  // Same code as connectHindiVoice but with:
  body: JSON.stringify({
    language: 'ta-IN',  // Tamil
    userId: `user-${Date.now()}`,
    userName: 'User'
  })
}, []);
// Connect to English Voice Assistant
const connectEnglishVoice = useCallback(async () => {
  // Same code as connectHindiVoice but with:
  body: JSON.stringify({
    language: 'en-IN',  // English (India)
    userId: `user-${Date.now()}`,
    userName: 'User'
  })
}, []);
// Auto-detect language
const connectMultilingualVoice = useCallback(async () => {
  // Same code as connectHindiVoice but with:
  body: JSON.stringify({
    language: 'unknown',  // Auto-detect
    userId: `user-${Date.now()}`,
    userName: 'User'
  })
}, []);

4. CSS Styles (Optional)
Add this CSS for better styling:

.voice-assistant-container {
  max-width: 600px;
  margin: 0 auto;
  padding: 20px;
}
.status-dot {
  padding: 8px 12px;
  margin: 5px 0;
  border-radius: 20px;
  background-color: #f8f9fa;
  border: 1px solid #dee2e6;
}
.status-dot.active {
  background-color: #d4edda;
  border-color: #c3e6cb;
  color: #155724;
}
.livekit-room {
  margin-top: 20px;
  padding: 20px;
  border: 1px solid #dee2e6;
  border-radius: 8px;
  background-color: #f8f9fa;
}

5. Usage in Your App
import VoiceAssistant from './components/VoiceAssistant';
function App() {
  return (
    <div className="App">
      <VoiceAssistant />
    </div>
  );
}

This implementation:

Creates a LiveKit room for Hindi voice interaction
Connects to your Python agent (which will automatically join the same room)
Provides real-time voice communication with Sarvam's Hindi STT/TTS
Shows connection status and audio visualization
Handles errors gracefully 