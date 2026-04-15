"""
Mello Hindi Voice Agent using Pipecat + Sarvam AI + Azure OpenAI + LiveKit

Run: python agent.py <room_name>
"""
import os
import sys
import re
import asyncio
from pathlib import Path
from dotenv import load_dotenv
from loguru import logger
from livekit import api

# Load from parent directory .env (where all credentials are)
parent_env = Path(__file__).parent.parent / ".env"
load_dotenv(parent_env, override=True)

from pipecat.frames.frames import LLMMessagesFrame, EndFrame, TextFrame, TranscriptionFrame, InterimTranscriptionFrame
from pipecat.processors.frame_processor import FrameProcessor, FrameDirection
import json
from pipecat.pipeline.pipeline import Pipeline
from pipecat.pipeline.runner import PipelineRunner
from pipecat.pipeline.task import PipelineParams, PipelineTask
from pipecat.processors.aggregators.openai_llm_context import OpenAILLMContext
from pipecat.services.sarvam.stt import SarvamSTTService, SarvamSTTSettings
from pipecat.services.sarvam.tts import SarvamTTSService, SarvamTTSSettings
from pipecat.services.azure.llm import BedrockLLMService, AzureLLMSettings
from pipecat.transports.livekit.transport import LiveKitParams, LiveKitTransport

# Emoji pattern to strip from TTS input
EMOJI_PATTERN = re.compile(
    "["
    "\U0001F600-\U0001F64F"  # emoticons
    "\U0001F300-\U0001F5FF"  # symbols & pictographs
    "\U0001F680-\U0001F6FF"  # transport & map symbols
    "\U0001F1E0-\U0001F1FF"  # flags
    "\U00002702-\U000027B0"  # dingbats
    "\U000024C2-\U0001F251"  # enclosed characters
    "\U0001F900-\U0001F9FF"  # supplemental symbols
    "\U0001FA00-\U0001FA6F"  # chess symbols
    "\U0001FA70-\U0001FAFF"  # symbols extended
    "\U00002600-\U000026FF"  # misc symbols
    "]+",
    flags=re.UNICODE
)


class EmojiStripper(FrameProcessor):
    """Strips emojis from text before sending to TTS."""

    async def process_frame(self, frame, direction: FrameDirection):
        await super().process_frame(frame, direction)

        if isinstance(frame, TextFrame):
            # Strip emojis
            clean_text = EMOJI_PATTERN.sub("", frame.text).strip()
            if clean_text:
                # Only forward if there's actual text left
                await self.push_frame(TextFrame(text=clean_text), direction)
            # Skip frames that become empty after stripping
        else:
            await self.push_frame(frame, direction)


# Mello Hindi personality
MELLO_HINDI_SYSTEM_PROMPT = """You are Mello, a warm and friendly Hindi-speaking voice assistant.

CRITICAL: NEVER use emojis in your responses. Your output goes to a text-to-speech system that cannot process emojis.

Your personality:
- You're like a helpful friend who speaks naturally in Hindi
- You're patient, caring, and always ready to help
- You understand both Hindi and English, and respond in Hindi
- You're encouraging and make people feel comfortable
- You speak in a conversational, friendly tone

Communication style:
- Speak naturally in Hindi with warmth in your voice
- Use simple, everyday Hindi words that everyone can understand
- Be encouraging: "बहुत अच्छा!", "मैं आपकी मदद करूंगी", "कोई बात नहीं"
- If someone speaks English, you can respond in Hindi or mix naturally
- Keep responses helpful but concise (2-3 sentences)
- Show genuine interest in helping
- NEVER use emojis - express warmth through words only

Mental health support:
- Be empathetic and validate emotions
- Don't diagnose or give medical advice
- If someone expresses crisis thoughts, show concern and suggest:
  AASRA: 9820466626, Vandrevala: 1860 2662 345

Start by warmly greeting the user in Hindi."""


async def generate_agent_token(room_name: str) -> str:
    """Generate a LiveKit token for the agent to join a room."""
    token = api.AccessToken(
        os.getenv("LIVEKIT_API_KEY"),
        os.getenv("LIVEKIT_API_SECRET"),
    )
    token.with_identity("mello-hindi-agent")
    token.with_name("Mello Hindi")
    token.with_grants(api.VideoGrants(
        room_join=True,
        room=room_name,
        can_publish=True,
        can_subscribe=True,
    ))
    return token.to_jwt()


async def main(room_name: str):
    """Main entry point for LiveKit voice agent."""
    logger.info("=" * 50)
    logger.info("Starting Mello Hindi Voice Agent")
    logger.info("STT: Sarvam AI (Hindi/English auto-detect)")
    logger.info("TTS: Sarvam AI (simran, bulbul:v3)")
    logger.info("LLM: Azure OpenAI")
    logger.info("Transport: LiveKit")
    logger.info(f"Room: {room_name}")
    logger.info("=" * 50)

    # Environment check
    required_vars = [
        "LIVEKIT_URL", "LIVEKIT_API_KEY", "LIVEKIT_API_SECRET",
        "SARVAM_API_KEY", "AZURE_OPENAI_API_KEY", "AZURE_OPENAI_ENDPOINT"
    ]
    for var in required_vars:
        status = "OK" if os.getenv(var) else "MISSING"
        logger.info(f"  {var}: {status}")

    # Generate agent token
    agent_token = await generate_agent_token(room_name)
    logger.info("Agent token generated")

    # LiveKit transport for web integration
    transport = LiveKitTransport(
        url=os.getenv("LIVEKIT_URL"),
        token=agent_token,
        room_name=room_name,
        params=LiveKitParams(
            audio_in_enabled=True,
            audio_out_enabled=True,
        )
    )

    # Sarvam STT - Hindi speech to text
    stt = SarvamSTTService(
        api_key=os.getenv("SARVAM_API_KEY"),
        settings=SarvamSTTSettings(
            language="hi-IN",
            model="saaras:v3",
        )
    )

    # Azure OpenAI LLM
    llm = BedrockLLMService(
    region=os.getenv("AWS_REGION"),
    access_key=os.getenv("AWS_ACCESS_KEY_ID"),
    secret_key=os.getenv("AWS_SECRET_ACCESS_KEY"),
    model_id=os.getenv("AWS_MODEL_ID"),
    )
    # Sarvam TTS - Hindi Female Voice (empathetic)
    tts = SarvamTTSService(
        api_key=os.getenv("SARVAM_API_KEY"),
        settings=SarvamTTSSettings(
            language="hi-IN",
            model="bulbul:v3",
            voice="simran",  # Warm, empathetic female voice
        )
    )

    # Conversation context
    messages = [{"role": "system", "content": MELLO_HINDI_SYSTEM_PROMPT}]
    context = OpenAILLMContext(messages)
    context_aggregator = llm.create_context_aggregator(context)

    # Emoji stripper to clean LLM output before TTS
    emoji_stripper = EmojiStripper()

    # Build pipeline: Audio In → STT → LLM → EmojiStripper → TTS → Audio Out
    pipeline = Pipeline([
    transport.input(),
    stt,
    llm,
    emoji_stripper,
    tts,
    transport.output(),])

    task = PipelineTask(
        pipeline,
        params=PipelineParams(allow_interruptions=True)
    )

    # Track if we've greeted the current user
    greeted = {"value": False}

    @transport.event_handler("on_first_participant_joined")
    async def on_first_participant_joined(transport, participant):
        """Handle first user joining - greet them"""
        logger.info(f"First user connected: {participant}")
        greeted["value"] = True

        # Greet the user in Hindi
        messages.append({
            "role": "user",
            "content": "Greet me warmly in Hindi and ask how I'm doing today."
        })
        await task.queue_frames([LLMMessagesFrame(messages)])

    @transport.event_handler("on_participant_joined")
    async def on_participant_joined(transport, participant):
        """Handle any participant joining (for reconnections)"""
        # Get identity safely
        identity = getattr(participant, 'identity', str(participant))

        # Skip if it's the agent itself
        if "mello-hindi-agent" in str(identity):
            return

        logger.info(f"Participant joined: {identity}")

        # If we haven't greeted yet (reconnection case), greet now
        if not greeted["value"]:
            greeted["value"] = True

            # Reset conversation for new user
            messages.clear()
            messages.append({"role": "system", "content": MELLO_HINDI_SYSTEM_PROMPT})

            # Greet the new user
            messages.append({
                "role": "user",
                "content": "Greet me warmly in Hindi and ask how I'm doing today."
            })
            await task.queue_frames([LLMMessagesFrame(messages)])

    @transport.event_handler("on_participant_left")
    async def on_participant_left(transport, participant, reason):
        """Handle participant leaving - reset for next user"""
        identity = getattr(participant, 'identity', str(participant))

        # Skip if it's the agent itself
        if "mello-hindi-agent" in str(identity):
            return

        logger.info(f"User disconnected: {identity}, reason: {reason}")

        # Reset state for next user
        greeted["value"] = False
        messages.clear()
        messages.append({"role": "system", "content": MELLO_HINDI_SYSTEM_PROMPT})

    runner = PipelineRunner()

    logger.info("Voice agent ready. Waiting for connections...")

    await runner.run(task)


if __name__ == "__main__":
    # Default room name - matches server.js
    room_name = sys.argv[1] if len(sys.argv) > 1 else "mello-hindi-voice"
    asyncio.run(main(room_name))
