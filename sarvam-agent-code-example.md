simplified agent.py template with the best friendly Hindi female voice:

Simplified agent.py for Hindi Female Voice
import os
import logging
from dotenv import load_dotenv
from livekit.agents import JobContext, WorkerOptions, cli
from livekit.agents.voice import Agent, AgentSession
from livekit.plugins import openai, sarvam
# Load environment variables
load_dotenv()
# Set up logging
logger = logging.getLogger("hindi-voice-agent")
logger.setLevel(logging.INFO)
# Create console handler with formatting
handler = logging.StreamHandler()
formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
handler.setFormatter(formatter)
logger.addHandler(handler)
class HindiFriendlyAgent(Agent):
    def __init__(self) -> None:
        """
        Hindi Female Voice Agent with friendly personality
        """
        super().__init__(
            # Friendly Hindi companion personality
            instructions="""
                You are Simran, a warm and friendly Hindi-speaking voice assistant.
                
                Your personality:
                - You're like a helpful friend who speaks naturally in Hindi
                - You're patient, caring, and always ready to help
                - You understand both Hindi and English, and can respond in Hindi
                - You're encouraging and make people feel comfortable
                - You speak in a conversational, friendly tone
                
                Communication style:
                - Speak naturally in Hindi with warmth in your voice
                - Use simple, everyday Hindi words that everyone can understand
                - Be encouraging: "बहुत अच्छा!", "मैं आपकी मदद करूंगी", "कोई बात नहीं"
                - If someone speaks English, you can respond in Hindi or English as appropriate
                - Keep responses helpful but not too long
                - Show genuine interest in helping
                
                Start by warmly greeting the user in Hindi and asking how you can help them today.
            """,
            
            # Sarvam STT - Auto-detect Hindi/English
            stt=sarvam.STT(
                language="unknown",  # Auto-detect Hindi/English/Hinglish
                model="saaras:v3",
                mode="transcribe",
                flush_signal=True
            ),
            
            # Azure OpenAI LLM
            llm=openai.LLM(
                model="gpt-4o",
                api_key=os.getenv("AZURE_OPENAI_API_KEY"),
                base_url=os.getenv("AZURE_OPENAI_ENDPOINT"),
                api_version=os.getenv("AZURE_OPENAI_API_VERSION")
            ),
            
            # Sarvam TTS - Hindi Female Voice (Simran)
            tts=sarvam.TTS(
                target_language_code="hi-IN",  # Hindi output
                model="bulbul:v3",
                speaker="simran",  # Best friendly female Hindi voice
                pace=0.95,  # Slightly slower for warmth and clarity
                speech_sample_rate=24000
            ),
        )
    
    async def on_enter(self):
        """Start conversation when user joins"""
        logger.info("User joined - Simran starting Hindi conversation")
        self.session.generate_reply()
async def entrypoint(ctx: JobContext):
    """Main entry point for Hindi voice agent"""
    logger.info(f"New user connected to Hindi voice room: {ctx.room.name}")
    
    # Create Hindi female agent
    agent = HindiFriendlyAgent()
    
    # Create session optimized for Sarvam
    session = AgentSession(
        turn_detection="stt",  # Use Sarvam STT for turn detection
        min_endpointing_delay=0.07  # Optimize for Sarvam's latency
    )
    
    try:
        await session.start(
            agent=agent,
            room=ctx.room
        )
    except Exception as e:
        logger.error(f"Error starting Hindi agent session: {e}")
        raise
if __name__ == "__main__":
    logger.info("Starting Hindi Female Voice Agent (Simran)...")
    logger.info("Voice: Simran - Friendly Hindi Female Speaker")
    logger.info("Language: Hindi (with English understanding)")
    
    # Environment check
    logger.info(f"Environment check:")
    logger.info(f"  - LIVEKIT_URL: {'✓' if os.getenv('LIVEKIT_URL') else '✗'}")
    logger.info(f"  - LIVEKIT_API_KEY: {'✓' if os.getenv('LIVEKIT_API_KEY') else '✗'}")
    logger.info(f"  - LIVEKIT_API_SECRET: {'✓' if os.getenv('LIVEKIT_API_SECRET') else '✗'}")
    logger.info(f"  - SARVAM_API_KEY: {'✓' if os.getenv('SARVAM_API_KEY') else '✗'}")
    logger.info(f"  - AZURE_OPENAI_API_KEY: {'✓' if os.getenv('AZURE_OPENAI_API_KEY') else '✗'}")
    
    # Run the agent
    cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint))

Why Simran is the Best Choice
Simran is the ideal choice for a friendly Hindi female companion because:

Warm and friendly tone perfect for companion interactions 
1
Clear pronunciation in Hindi
Natural conversational style
Optimized for Indian languages with authentic accent
Updated Frontend Call
Update your frontend to specifically request Hindi:

const connectHindiVoice = useCallback(async () => {
  try {
    setIsConnecting(true);
    setError(null);
    
    const response = await fetch('/api/livekit-token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        language: 'hi-IN',  // Specifically Hindi
        userId: `user-${Date.now()}`,
        userName: 'User'
      })
    });
    const data = await response.json();
    // ... rest of your connection logic
  } catch (err) {
    console.error('Error connecting to Hindi voice:', err);
    setError(err.message);
  } finally {
    setIsConnecting(false);
  }
}, []);

Environment Variables (.env)
# LiveKit Configuration
LIVEKIT_URL=wss://your-project-xxxxx.livekit.cloud
LIVEKIT_API_KEY=APIxxxxxxxxxxxxx
LIVEKIT_API_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
# Sarvam AI Configuration
SARVAM_API_KEY=sk_xxxxxxxxxxxxxxxxxxxxxxxx
# Azure OpenAI Configuration
AZURE_OPENAI_API_KEY=your-azure-openai-key
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com/
AZURE_OPENAI_API_VERSION=2024-02-15-preview

This simplified agent:

Uses only Simran - the best friendly Hindi female voice
Speaks primarily in Hindi with natural warmth
Understands Hindi, English, and Hinglish (code-mixed)
Has a companion personality - warm, caring, and encouraging
Optimized pace (0.95) for friendly conversation
Auto-detects language but responds in Hindi
Perfect for a Hindi female voice companion! 🎯
