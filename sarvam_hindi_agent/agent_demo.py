"""
Mello Hindi Voice Agent - DEMO MODE
Plays pre-scripted conversation through LiveKit (no mic needed)

Run: python agent_demo.py
Then connect from web app with Hindi selected to hear Mello speak.
"""
import os
import sys
import re
import asyncio
from dotenv import load_dotenv
from loguru import logger
from livekit import api

from pipecat.frames.frames import TextFrame, EndFrame, TTSStoppedFrame
from pipecat.processors.frame_processor import FrameProcessor, FrameDirection
from pipecat.pipeline.pipeline import Pipeline
from pipecat.pipeline.runner import PipelineRunner
from pipecat.pipeline.task import PipelineParams, PipelineTask
from pipecat.services.sarvam.tts import SarvamTTSService, SarvamTTSSettings
from pipecat.services.azure.llm import AzureLLMService, AzureLLMSettings
from pipecat.transports.livekit.transport import LiveKitParams, LiveKitTransport

load_dotenv(override=True)

# Emoji pattern to strip from TTS input
EMOJI_PATTERN = re.compile(
    "["
    "\U0001F600-\U0001F64F"
    "\U0001F300-\U0001F5FF"
    "\U0001F680-\U0001F6FF"
    "\U0001F1E0-\U0001F1FF"
    "\U00002702-\U000027B0"
    "\U000024C2-\U0001F251"
    "\U0001F900-\U0001F9FF"
    "\U0001FA00-\U0001FA6F"
    "\U0001FA70-\U0001FAFF"
    "\U00002600-\U000026FF"
    "]+",
    flags=re.UNICODE
)


class EmojiStripper(FrameProcessor):
    """Strips emojis from text before sending to TTS."""

    async def process_frame(self, frame, direction: FrameDirection):
        await super().process_frame(frame, direction)

        if isinstance(frame, TextFrame):
            clean_text = EMOJI_PATTERN.sub("", frame.text).strip()
            if clean_text:
                await self.push_frame(TextFrame(text=clean_text), direction)
        else:
            await self.push_frame(frame, direction)


class TTSCompletionNotifier(FrameProcessor):
    """Notifies when TTS has finished speaking."""

    def __init__(self):
        super().__init__()
        self.tts_done = asyncio.Event()

    async def process_frame(self, frame, direction: FrameDirection):
        await super().process_frame(frame, direction)

        if isinstance(frame, TTSStoppedFrame):
            self.tts_done.set()

        await self.push_frame(frame, direction)

    def reset(self):
        self.tts_done.clear()

    async def wait_for_completion(self, timeout=30):
        """Wait for TTS to complete."""
        try:
            await asyncio.wait_for(self.tts_done.wait(), timeout=timeout)
        except asyncio.TimeoutError:
            logger.warning("TTS completion timeout")
        self.reset()


# Demo conversation script - Extended version
DEMO_SCRIPT = [
    # Opening
    {
        "user": "नमस्ते मेलो, कैसी हो?",
        "delay": 4
    },
    {
        "user": "मैं ठीक हूँ, बस थोड़ा थका हुआ हूँ आज",
        "delay": 5
    },
    # Emotional support
    {
        "user": "आज ऑफिस में बहुत काम था, सब कुछ बहुत तेज़ी से हो रहा था",
        "delay": 6
    },
    {
        "user": "हाँ, कभी कभी लगता है कि मैं सब संभाल नहीं पा रहा",
        "delay": 6
    },
    {
        "user": "मुझे अकेला लग रहा है, कोई समझता नहीं",
        "delay": 6
    },
    # Coping strategies
    {
        "user": "क्या करूं मैं? कुछ समझ नहीं आता",
        "delay": 6
    },
    {
        "user": "हाँ, शायद थोड़ा आराम करना चाहिए",
        "delay": 5
    },
    # Lighter conversation
    {
        "user": "मेलो, तुम्हें क्या पसंद है करना?",
        "delay": 5
    },
    {
        "user": "अच्छा! मुझे संगीत सुनना पसंद है",
        "delay": 5
    },
    {
        "user": "हिंदी गाने, पुराने वाले",
        "delay": 5
    },
    # Daily life
    {
        "user": "मेलो, कल मेरी एक important मीटिंग है, थोड़ा nervous हूँ",
        "delay": 6
    },
    {
        "user": "हाँ, तैयारी तो कर ली है, बस confidence की कमी है",
        "delay": 6
    },
    # Gratitude
    {
        "user": "तुमसे बात करके अच्छा लगा मेलो",
        "delay": 5
    },
    {
        "user": "तुम सच में बहुत अच्छी दोस्त हो",
        "delay": 5
    },
    # Closing
    {
        "user": "अच्छा मेलो, अब मैं सोने जाता हूँ। शुभ रात्रि!",
        "delay": 5
    },
]

MELLO_SYSTEM_PROMPT = """You are Mello, a warm and caring Hindi-speaking voice assistant and emotional companion.

CRITICAL: NEVER use emojis. Your output goes to text-to-speech system.

Your personality:
- You are like a trusted friend who truly listens
- You speak naturally in Hindi with genuine warmth
- You are patient, understanding, and non-judgmental
- You validate feelings before offering suggestions
- You use encouraging phrases like "बहुत अच्छा", "मैं समझ सकती हूँ", "आप अकेले नहीं हैं"

Communication style:
- Keep responses conversational and warm (2-3 sentences)
- Ask thoughtful follow-up questions
- Share relatable perspectives when appropriate
- Be supportive but not preachy
- NEVER use emojis - express warmth through words only

Mental health awareness:
- Validate emotions without judgment
- Encourage self-care and rest
- Suggest talking to loved ones when appropriate
- For serious concerns, gently recommend professional help

You are having a natural conversation. Be genuine and caring."""


async def generate_agent_token(room_name: str) -> str:
    """Generate a LiveKit token for the agent."""
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


async def get_llm_response(llm_endpoint, api_key, deployment, api_version, messages):
    """Get response from Azure OpenAI."""
    import aiohttp

    url = f"{llm_endpoint.rstrip('/')}/openai/deployments/{deployment}/chat/completions?api-version={api_version}"
    headers = {"api-key": api_key, "Content-Type": "application/json"}
    payload = {"messages": messages, "max_tokens": 150}

    async with aiohttp.ClientSession() as session:
        async with session.post(url, json=payload, headers=headers) as resp:
            if resp.status == 200:
                data = await resp.json()
                return data["choices"][0]["message"]["content"]
            else:
                error = await resp.text()
                logger.error(f"LLM error: {error}")
                return "माफ़ कीजिए, कुछ गड़बड़ हो गई।"


async def main(room_name: str):
    """Run demo mode - plays scripted conversation through LiveKit."""
    logger.info("=" * 50)
    logger.info("MELLO HINDI VOICE AGENT - DEMO MODE")
    logger.info("=" * 50)
    logger.info("Connect from web app to hear Mello speak!")
    logger.info(f"Room: {room_name}")
    logger.info("=" * 50)

    # Generate agent token
    agent_token = await generate_agent_token(room_name)

    # LiveKit transport
    transport = LiveKitTransport(
        url=os.getenv("LIVEKIT_URL"),
        token=agent_token,
        room_name=room_name,
        params=LiveKitParams(
            audio_in_enabled=False,  # No mic input needed
            audio_out_enabled=True,
        )
    )

    # Sarvam TTS
    tts = SarvamTTSService(
        api_key=os.getenv("SARVAM_API_KEY"),
        settings=SarvamTTSSettings(
            language="hi-IN",
            model="bulbul:v3",
            voice="simran",
        )
    )

    # Emoji stripper
    emoji_stripper = EmojiStripper()

    # TTS completion notifier
    tts_notifier = TTSCompletionNotifier()

    # Simple pipeline: Text → EmojiStripper → TTS → Notifier → Audio Out
    pipeline = Pipeline([
        emoji_stripper,
        tts,
        tts_notifier,
        transport.output(),
    ])

    task = PipelineTask(
        pipeline,
        params=PipelineParams(allow_interruptions=False)
    )

    # LLM config
    llm_endpoint = os.getenv("AZURE_OPENAI_ENDPOINT")
    llm_key = os.getenv("AZURE_OPENAI_API_KEY")
    llm_deployment = os.getenv("AZURE_DEPLOYMENT_NAME", "gpt-5-chat")
    llm_version = os.getenv("AZURE_OPENAI_API_VERSION", "2024-12-01-preview")

    conversation_messages = [{"role": "system", "content": MELLO_SYSTEM_PROMPT}]
    demo_started = False

    @transport.event_handler("on_first_participant_joined")
    async def on_participant_joined(transport, participant):
        nonlocal demo_started
        if demo_started:
            return
        demo_started = True

        logger.info(f"User connected: {participant}")
        logger.info("Starting demo conversation...")

        # Wait a moment for connection to stabilize
        await asyncio.sleep(1)

        for i, turn in enumerate(DEMO_SCRIPT):
            user_input = turn["user"]
            logger.info(f"\n[{i+1}/{len(DEMO_SCRIPT)}] User: {user_input}")

            # Add user message
            conversation_messages.append({"role": "user", "content": user_input})

            # Get LLM response
            response = await get_llm_response(
                llm_endpoint, llm_key, llm_deployment, llm_version,
                conversation_messages
            )

            # Strip emojis
            clean_response = EMOJI_PATTERN.sub("", response).strip()
            logger.info(f"Mello: {clean_response}")

            # Add to conversation
            conversation_messages.append({"role": "assistant", "content": clean_response})

            # Reset notifier and send to TTS
            tts_notifier.reset()
            await task.queue_frames([TextFrame(text=clean_response)])

            # Wait for Mello to finish speaking
            await tts_notifier.wait_for_completion(timeout=30)

            # Small pause between turns for natural flow
            await asyncio.sleep(1.5)

        logger.info("\n" + "=" * 50)
        logger.info("Demo complete! Disconnecting in 3 seconds...")
        logger.info("=" * 50)
        await asyncio.sleep(3)
        await task.queue_frames([EndFrame()])

    @transport.event_handler("on_participant_left")
    async def on_participant_left(transport, participant, reason):
        logger.info(f"User disconnected: {participant}")
        await task.queue_frames([EndFrame()])

    runner = PipelineRunner()

    logger.info("\nWaiting for you to connect from web app...")
    logger.info("Go to: http://localhost:3001 -> Voice Chat -> Select Hindi -> Connect")

    await runner.run(task)


if __name__ == "__main__":
    room_name = sys.argv[1] if len(sys.argv) > 1 else "mello-hindi-voice"
    asyncio.run(main(room_name))
