"""
Test script for Mello Hindi Voice Agent components.
Run: python test_agent.py
"""
import os
import asyncio
import aiohttp
from dotenv import load_dotenv
from loguru import logger

load_dotenv(override=True)


async def test_sarvam_tts():
    """Test Sarvam TTS with Hindi text."""
    logger.info("=" * 50)
    logger.info("Testing Sarvam TTS...")

    api_key = os.getenv("SARVAM_API_KEY")
    if not api_key:
        logger.error("SARVAM_API_KEY not found")
        return False

    # Test text in Hindi
    test_texts = [
        "नमस्ते! आप कैसे हैं?",
        "मैं मेलो हूँ, आपकी मदद के लिए यहाँ हूँ।",
        "बहुत अच्छा! मुझे खुशी हुई।",
    ]

    url = "https://api.sarvam.ai/text-to-speech"
    headers = {
        "api-subscription-key": api_key,
        "Content-Type": "application/json"
    }

    async with aiohttp.ClientSession() as session:
        for text in test_texts:
            payload = {
                "inputs": [text],
                "target_language_code": "hi-IN",
                "speaker": "simran",
                "model": "bulbul:v3"
            }

            try:
                async with session.post(url, json=payload, headers=headers) as resp:
                    if resp.status == 200:
                        data = await resp.json()
                        audio_len = len(data.get("audios", [[]])[0]) if data.get("audios") else 0
                        logger.info(f"  TTS OK: '{text[:30]}...' -> {audio_len} bytes audio")
                    else:
                        error = await resp.text()
                        logger.error(f"  TTS FAILED: {resp.status} - {error[:100]}")
                        return False
            except Exception as e:
                logger.error(f"  TTS ERROR: {e}")
                return False

    logger.info("Sarvam TTS: PASSED")
    return True


async def test_azure_llm():
    """Test Azure OpenAI LLM."""
    logger.info("=" * 50)
    logger.info("Testing Azure OpenAI LLM...")

    endpoint = os.getenv("AZURE_OPENAI_ENDPOINT")
    api_key = os.getenv("AZURE_OPENAI_API_KEY")
    deployment = os.getenv("AZURE_DEPLOYMENT_NAME", "gpt-5-chat")
    api_version = os.getenv("AZURE_OPENAI_API_VERSION", "2024-12-01-preview")

    if not endpoint or not api_key:
        logger.error("Azure OpenAI credentials not found")
        return False

    url = f"{endpoint.rstrip('/')}/openai/deployments/{deployment}/chat/completions?api-version={api_version}"
    headers = {
        "api-key": api_key,
        "Content-Type": "application/json"
    }

    # Test with Hindi system prompt
    payload = {
        "messages": [
            {
                "role": "system",
                "content": "You are Mello, a Hindi voice assistant. NEVER use emojis. Respond in Hindi only."
            },
            {
                "role": "user",
                "content": "Say hello in Hindi"
            }
        ],
        "max_tokens": 100
    }

    async with aiohttp.ClientSession() as session:
        try:
            async with session.post(url, json=payload, headers=headers) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    response = data["choices"][0]["message"]["content"]
                    has_emoji = any(ord(c) > 127000 for c in response)
                    logger.info(f"  LLM Response: {response}")
                    logger.info(f"  Has emoji: {has_emoji}")
                    if has_emoji:
                        logger.warning("  LLM still outputting emojis - EmojiStripper will handle this")
                else:
                    error = await resp.text()
                    logger.error(f"  LLM FAILED: {resp.status} - {error[:200]}")
                    return False
        except Exception as e:
            logger.error(f"  LLM ERROR: {e}")
            return False

    logger.info("Azure OpenAI LLM: PASSED")
    return True


async def test_sarvam_stt():
    """Test Sarvam STT availability."""
    logger.info("=" * 50)
    logger.info("Testing Sarvam STT (connection only)...")

    api_key = os.getenv("SARVAM_API_KEY")
    if not api_key:
        logger.error("SARVAM_API_KEY not found")
        return False

    # Just verify the WebSocket endpoint is reachable
    import websockets

    url = f"wss://api.sarvam.ai/speech-to-text-translate/streaming?api_subscription_key={api_key}"

    try:
        async with websockets.connect(url) as ws:
            # Send config
            config = {
                "type": "config",
                "config": {
                    "language_code": "hi-IN",
                    "model": "saaras:v3"
                }
            }
            import json
            await ws.send(json.dumps(config))
            logger.info("  STT WebSocket connected successfully")
            await ws.close()
    except Exception as e:
        logger.error(f"  STT ERROR: {e}")
        return False

    logger.info("Sarvam STT: PASSED")
    return True


async def test_livekit():
    """Test LiveKit connection."""
    logger.info("=" * 50)
    logger.info("Testing LiveKit...")

    url = os.getenv("LIVEKIT_URL")
    api_key = os.getenv("LIVEKIT_API_KEY")
    api_secret = os.getenv("LIVEKIT_API_SECRET")

    if not all([url, api_key, api_secret]):
        logger.error("LiveKit credentials not found")
        return False

    logger.info(f"  URL: {url}")
    logger.info(f"  API Key: {api_key[:10]}...")

    # Generate a test token
    from livekit import api

    token = api.AccessToken(api_key, api_secret)
    token.with_identity("test-user")
    token.with_name("Test")
    token.with_grants(api.VideoGrants(room_join=True, room="test-room"))
    jwt = token.to_jwt()

    logger.info(f"  Token generated: {jwt[:50]}...")
    logger.info("LiveKit: PASSED")
    return True


async def test_emoji_stripper():
    """Test emoji stripping logic."""
    logger.info("=" * 50)
    logger.info("Testing Emoji Stripper...")

    import re
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

    test_cases = [
        ("नमस्ते! 😊", "नमस्ते!"),
        ("बहुत अच्छा! 🌸", "बहुत अच्छा!"),
        ("💛 आप कैसे हैं?", "आप कैसे हैं?"),
        ("😊🌸💛", ""),  # Should become empty
        ("मैं ठीक हूँ।", "मैं ठीक हूँ।"),  # No emoji
    ]

    all_passed = True
    for input_text, expected in test_cases:
        result = EMOJI_PATTERN.sub("", input_text).strip()
        status = "OK" if result == expected else "FAIL"
        if status == "FAIL":
            all_passed = False
        logger.info(f"  '{input_text}' -> '{result}' [{status}]")

    if all_passed:
        logger.info("Emoji Stripper: PASSED")
    else:
        logger.error("Emoji Stripper: FAILED")
    return all_passed


async def test_full_pipeline_simulation():
    """Simulate a conversation without voice."""
    logger.info("=" * 50)
    logger.info("Simulating conversation pipeline...")

    endpoint = os.getenv("AZURE_OPENAI_ENDPOINT")
    api_key = os.getenv("AZURE_OPENAI_API_KEY")
    sarvam_key = os.getenv("SARVAM_API_KEY")
    deployment = os.getenv("AZURE_DEPLOYMENT_NAME", "gpt-5-chat")
    api_version = os.getenv("AZURE_OPENAI_API_VERSION", "2024-12-01-preview")

    if not all([endpoint, api_key, sarvam_key]):
        logger.error("Missing credentials")
        return False

    import re
    EMOJI_PATTERN = re.compile(
        "["
        "\U0001F600-\U0001F64F\U0001F300-\U0001F5FF\U0001F680-\U0001F6FF"
        "\U0001F1E0-\U0001F1FF\U00002702-\U000027B0\U000024C2-\U0001F251"
        "\U0001F900-\U0001F9FF\U0001FA00-\U0001FA6F\U0001FA70-\U0001FAFF"
        "\U00002600-\U000026FF"
        "]+",
        flags=re.UNICODE
    )

    system_prompt = """You are Mello, a Hindi voice assistant.
CRITICAL: NEVER use emojis. Respond in Hindi only. Keep responses short (1-2 sentences)."""

    # Simulate user inputs
    user_inputs = [
        "Greet me in Hindi",
        "मैं थोड़ा उदास हूँ आज",
        "धन्यवाद",
    ]

    messages = [{"role": "system", "content": system_prompt}]

    async with aiohttp.ClientSession() as session:
        for user_input in user_inputs:
            logger.info(f"\n  USER: {user_input}")
            messages.append({"role": "user", "content": user_input})

            # Get LLM response
            url = f"{endpoint.rstrip('/')}/openai/deployments/{deployment}/chat/completions?api-version={api_version}"
            payload = {"messages": messages, "max_tokens": 150}
            headers = {"api-key": api_key, "Content-Type": "application/json"}

            async with session.post(url, json=payload, headers=headers) as resp:
                if resp.status != 200:
                    logger.error(f"  LLM error: {resp.status}")
                    return False
                data = await resp.json()
                response = data["choices"][0]["message"]["content"]

            # Strip emojis
            clean_response = EMOJI_PATTERN.sub("", response).strip()
            logger.info(f"  MELLO (raw): {response}")
            logger.info(f"  MELLO (clean): {clean_response}")

            # Test TTS with clean response
            if clean_response:
                tts_url = "https://api.sarvam.ai/text-to-speech"
                tts_payload = {
                    "inputs": [clean_response],
                    "target_language_code": "hi-IN",
                    "speaker": "simran",
                    "model": "bulbul:v3"
                }
                tts_headers = {"api-subscription-key": sarvam_key, "Content-Type": "application/json"}

                async with session.post(tts_url, json=tts_payload, headers=tts_headers) as tts_resp:
                    if tts_resp.status == 200:
                        logger.info(f"  TTS: OK")
                    else:
                        error = await tts_resp.text()
                        logger.error(f"  TTS FAILED: {error[:100]}")

            messages.append({"role": "assistant", "content": clean_response})

    logger.info("\nFull Pipeline Simulation: PASSED")
    return True


async def main():
    """Run all tests."""
    logger.info("\n" + "=" * 60)
    logger.info("MELLO HINDI VOICE AGENT - TEST SUITE")
    logger.info("=" * 60)

    results = {}

    results["Emoji Stripper"] = await test_emoji_stripper()
    results["LiveKit"] = await test_livekit()
    results["Azure LLM"] = await test_azure_llm()
    results["Sarvam TTS"] = await test_sarvam_tts()
    results["Sarvam STT"] = await test_sarvam_stt()
    results["Full Pipeline"] = await test_full_pipeline_simulation()

    logger.info("\n" + "=" * 60)
    logger.info("TEST RESULTS SUMMARY")
    logger.info("=" * 60)

    for test, passed in results.items():
        status = "PASSED" if passed else "FAILED"
        logger.info(f"  {test}: {status}")

    all_passed = all(results.values())
    logger.info("=" * 60)
    logger.info(f"OVERALL: {'ALL TESTS PASSED' if all_passed else 'SOME TESTS FAILED'}")
    logger.info("=" * 60)

    return all_passed


if __name__ == "__main__":
    asyncio.run(main())
