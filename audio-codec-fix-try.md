You're absolutely right! This is a **known compatibility issue** between Sarvam's WebSocket API and LiveKit's audio decoder. Let me help you fix this.

## The Problem

- **Sarvam TTS WebSocket** returns audio in **MP3 format** by default
- **LiveKit agents** expect **WAV format** for audio processing
- This causes the "error decoding WAV audio" you're seeing

## Solution: Configure Sarvam TTS for WAV Output

Based on the Sarvam documentation, you can specify the audio output format. Here's the fix:

### Updated agent.py with WAV Output

```python
import os
import logging
from dotenv import load_dotenv
from livekit.agents import JobContext, WorkerOptions, cli
from livekit.agents.voice import Agent, AgentSession
from livekit.plugins import openai, sarvam

# Load environment variables
load_dotenv()

# Set up logging
logger = logging.getLogger("mello-hindi-agent")
logger.setLevel(logging.INFO)

# Create console handler with formatting
handler = logging.StreamHandler()
formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
handler.setFormatter(formatter)
logger.addHandler(handler)


class MelloHindiAgent(Agent):
    def __init__(self) -> None:
        """
        Mello Hindi Female Voice Agent with WAV audio output
        """
        super().__init__(
            # Friendly Hindi companion personality
            instructions="""
                You are Simran, a warm and friendly Hindi-speaking voice assistant for Mello.
                
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
            
            # Sarvam TTS - Hindi Female Voice with WAV output
            tts=sarvam.TTS(
                target_language_code="hi-IN",
                model="bulbul:v3",
                speaker="simran",
                pace=0.95,
                speech_sample_rate=16000,  # Standard sample rate
                # ✅ KEY FIX: Force WAV output format
                output_audio_codec="wav",  # Instead of default MP3
                output_audio_bitrate="128k"
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
    agent = MelloHindiAgent()
    
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
    logger.info("=" * 50)
    logger.info("Starting Mello Hindi Voice Agent")
    logger.info("Voice: Simran - Warm, Friendly Hindi Female")
    logger.info("Audio: WAV format for LiveKit compatibility")
    logger.info("Language: Hindi (with English understanding)")
    logger.info("=" * 50)
    
    # Environment check
    logger.info("Environment check:")
    logger.info(f"  LIVEKIT_URL: {'OK' if os.getenv('LIVEKIT_URL') else 'MISSING'}")
    logger.info(f"  LIVEKIT_API_KEY: {'OK' if os.getenv('LIVEKIT_API_KEY') else 'MISSING'}")
    logger.info(f"  LIVEKIT_API_SECRET: {'OK' if os.getenv('LIVEKIT_API_SECRET') else 'MISSING'}")
    logger.info(f"  SARVAM_API_KEY: {'OK' if os.getenv('SARVAM_API_KEY') else 'MISSING'}")
    logger.info(f"  AZURE_OPENAI_API_KEY: {'OK' if os.getenv('AZURE_OPENAI_API_KEY') else 'MISSING'}")
    logger.info(f"  AZURE_OPENAI_ENDPOINT: {'OK' if os.getenv('AZURE_OPENAI_ENDPOINT') else 'MISSING'}")
    
    # Run the agent
    cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint))
```

## Supported Audio Formats from Sarvam Documentation

According to the Sarvam TTS streaming documentation, these audio formats are supported [^1]:

| Format | Description |
|--------|-------------|
| `mp3` | Default format |
| `wav` | ✅ **Use this for LiveKit** |
| `aac` | Advanced Audio Coding |
| `opus` | Opus codec |
| `flac` | Free Lossless Audio Codec |
| `pcm` | Raw PCM (LINEAR16) |
| `mulaw` | μ-law encoding |
| `alaw` | A-law encoding |

## Alternative Configuration Options

If `output_audio_codec="wav"` doesn't work, try these alternatives:

### Option 1: PCM Format
```python
tts=sarvam.TTS(
    target_language_code="hi-IN",
    model="bulbul:v3",
    speaker="simran",
    pace=0.95,
    speech_sample_rate=16000,
    output_audio_codec="pcm",  # Raw PCM format
    output_audio_bitrate="128k"
),
```

### Option 2: Lower Sample Rate
```python
tts=sarvam.TTS(
    target_language_code="hi-IN",
    model="bulbul:v3",
    speaker="simran",
    pace=0.95,
    speech_sample_rate=8000,   # Lower sample rate
    output_audio_codec="wav",
    output_audio_bitrate="64k"  # Lower bitrate
),
```

## Test the Fix

Run your agent again:

```bash
python agent.py dev
```

You should now see in the logs that the TTS config includes `"output_audio_codec": "wav"` instead of the default MP3, which should resolve the LiveKit decoder compatibility issue [^1].

[^1]: https://docs.sarvam.ai/api-reference-docs/api-guides-tutorials/text-to-speech/streaming-api/web-socket