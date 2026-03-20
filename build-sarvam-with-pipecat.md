***

title: Build Your First Voice Agent using Pipecat
description: >-
A beginner-friendly guide to building a real-time voice agent using Pipecat
and Sarvam AI. Support for 11 languages (10 Indian + English) with natural
voices and multilingual conversations.
canonical-url: >-
[https://docs.sarvam.ai/api-reference-docs/cookbook/Starter\_Notebook/Voice\_Agent\_Pipecat](https://docs.sarvam.ai/api-reference-docs/cookbook/Starter_Notebook/Voice_Agent_Pipecat)
'og:title': Build Your First Voice Agent using Pipecat
'og:description': >-
Step-by-step guide to build a real-time voice agent using Pipecat and Sarvam
AI. Support for 11 languages (10 Indian + English), natural voices, and
multilingual conversations.
'og:type': article
'og:site\_name': Sarvam AI Developer Documentation
'og:image':
type: url
value: >-
[https://res.cloudinary.com/dvcb20x9a/image/upload/v1743510800/image\_3\_rpnrug.png](https://res.cloudinary.com/dvcb20x9a/image/upload/v1743510800/image_3_rpnrug.png)
'og:image:width': 1200
'og:image:height': 630
'twitter:card': summary\_large\_image
'twitter:title': Build Your First Voice Agent using Pipecat
'twitter:description': >-
Step-by-step guide to build a real-time voice agent using Pipecat and Sarvam
AI. Support for 11 languages (10 Indian + English), natural voices, and
multilingual conversations.
'twitter:image':
type: url
value: >-
[https://res.cloudinary.com/dvcb20x9a/image/upload/v1743510800/image\_3\_rpnrug.png](https://res.cloudinary.com/dvcb20x9a/image/upload/v1743510800/image_3_rpnrug.png)
'twitter:site': '@SarvamAI'
---------------------------

## Overview

This guide demonstrates how to build a **real-time voice agent** that can listen, understand, and respond naturally using **Pipecat** for real-time communication and **Sarvam AI** for speech processing. Perfect for building voice assistants, customer support bots, and conversational AI applications for Indian languages.

## What You'll Build

A voice agent that can:

* Listen to users speaking (in multiple Indian languages!)
* Understand and process their requests
* Respond back in natural-sounding voices

## Quick Overview

1. Get API keys (Sarvam, OpenAI)
2. Install packages: `pip install pipecat-ai[daily,openai,sarvam] python-dotenv`
3. Create `.env` file with your API keys
4. Write \~80 lines of Python code
5. Run with appropriate transport

***

## Quick Start

### 1. Prerequisites

* Python 3.9 or higher
* API keys from:
  * [Sarvam AI](https://dashboard.sarvam.ai) (get API key from dashboard)
  * [OpenAI](https://platform.openai.com/api-keys) (create new secret key)

### 2. Install Dependencies

<Tabs>
  <Tab title="macOS/Linux">
    ```bash
    pip install "pipecat-ai[daily,openai]" python-dotenv loguru
    ```
  </Tab>

  <Tab title="Windows">
    ```bash
    pip install pipecat-ai[daily,openai] python-dotenv loguru
    ```
  </Tab>
</Tabs>

### 3. Create Environment File

Create a file named `.env` in your project folder and add your API keys:

```env
SARVAM_API_KEY=sk_xxxxxxxxxxxxxxxxxxxxxxxx
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxxxxx
```

Replace the values with your actual API keys.

### 4. Write Your Agent

Create `agent.py`:

```python
import os
from dotenv import load_dotenv
from loguru import logger
from pipecat.frames.frames import LLMRunFrame
from pipecat.pipeline.pipeline import Pipeline
from pipecat.pipeline.runner import PipelineRunner
from pipecat.pipeline.task import PipelineTask
from pipecat.processors.aggregators.llm_context import LLMContext
from pipecat.processors.aggregators.llm_response_universal import (
    LLMContextAggregatorPair,
)
from pipecat.runner.types import RunnerArguments
from pipecat.runner.utils import create_transport
from pipecat.services.sarvam.stt import SarvamSTTService
from pipecat.services.sarvam.tts import SarvamTTSService
from pipecat.services.openai.llm import OpenAILLMService
from pipecat.transports.base_transport import TransportParams
from pipecat.transports.daily.transport import DailyParams

load_dotenv(override=True)

async def bot(runner_args: RunnerArguments):
    """Main bot entry point."""
    
    # Create transport (supports both Daily and WebRTC)
    transport = await create_transport(
        runner_args,
        {
            "daily": lambda: DailyParams(audio_in_enabled=True, audio_out_enabled=True),
            "webrtc": lambda: TransportParams(
                audio_in_enabled=True, audio_out_enabled=True
            ),
        },
    )

    # Initialize AI services
    stt = SarvamSTTService(api_key=os.getenv("SARVAM_API_KEY"))
    tts = SarvamTTSService(api_key=os.getenv("SARVAM_API_KEY"))
    llm = OpenAILLMService(api_key=os.getenv("OPENAI_API_KEY"), model="gpt-4o-mini")

    # Set up conversation context
    messages = [
        {
            "role": "system",
            "content": "You are a friendly AI assistant. Keep your responses brief and conversational.",
        },
    ]
    context = LLMContext(messages)
    context_aggregator = LLMContextAggregatorPair(context)

    # Build pipeline
    pipeline = Pipeline(
        [
            transport.input(),
            stt,
            context_aggregator.user(),
            llm,
            tts,
            transport.output(),
            context_aggregator.assistant(),
        ]
    )

    task = PipelineTask(pipeline)

    @transport.event_handler("on_client_connected")
    async def on_client_connected(transport, client):
        logger.info("Client connected")
        messages.append(
            {"role": "system", "content": "Say hello and briefly introduce yourself."}
        )
        await task.queue_frames([LLMRunFrame()])

    @transport.event_handler("on_client_disconnected")
    async def on_client_disconnected(transport, client):
        logger.info("Client disconnected")
        await task.cancel()

    runner = PipelineRunner(handle_sigint=runner_args.handle_sigint)
    await runner.run(task)

if __name__ == "__main__":
    from pipecat.runner.run import main
    main()
```

### 5. Run Your Agent

For Daily transport:

```bash
python agent.py
```

The agent will create a Daily room and provide you with a URL to join.

### 6. Test Your Agent

Open the provided Daily room URL in your browser and start speaking. Your voice agent will listen and respond!

***

## Customization Examples

### Example 1: Hindi Voice Agent

```python
# Initialize AI services with Hindi support
stt = SarvamSTTService(
    api_key=os.getenv("SARVAM_API_KEY"),
    language="hi-IN",  # Hindi
    model="saaras:v3",
    mode="transcribe"
)

tts = SarvamTTSService(
    api_key=os.getenv("SARVAM_API_KEY"),
    target_language_code="hi-IN",
    model="bulbul:v3",
    speaker="simran"  # Or: priya, ishita, kavya, aditya, anand, rohan
)

llm = OpenAILLMService(api_key=os.getenv("OPENAI_API_KEY"), model="gpt-4o-mini")
```

### Example 2: Tamil Voice Agent

```python
stt = SarvamSTTService(
    api_key=os.getenv("SARVAM_API_KEY"),
    language="ta-IN",
    model="saaras:v3",
    mode="transcribe"
)

tts = SarvamTTSService(
    api_key=os.getenv("SARVAM_API_KEY"),
    target_language_code="ta-IN",
    model="bulbul:v3",
    speaker="shubh"
)

llm = OpenAILLMService(api_key=os.getenv("OPENAI_API_KEY"), model="gpt-4o-mini")
```

### Example 3: Multilingual Agent (Auto-detect)

```python
# Auto-detect the user's language
stt = SarvamSTTService(
    api_key=os.getenv("SARVAM_API_KEY"),
    language="unknown",  # Auto-detects language
    model="saaras:v3",
    mode="transcribe"
)

tts = SarvamTTSService(
    api_key=os.getenv("SARVAM_API_KEY"),
    target_language_code="en-IN",
    model="bulbul:v3",
    speaker="anand"
)

llm = OpenAILLMService(api_key=os.getenv("OPENAI_API_KEY"), model="gpt-4o-mini")
```

### Example 4: Speech-to-English Agent (Saaras)

**Difference**: Saarika transcribes speech to text in the same language, while Saaras translates speech directly to English text. Use Saaras when user speaks Indian languages but you want to process/respond in English.

```python
# User speaks Hindi → Saaras converts to English → LLM processes → Responds in English

stt = SarvamSTTService(
    api_key=os.getenv("SARVAM_API_KEY"),
    model="saaras:v3",
    mode="translate"  # Speech-to-English translation
)

tts = SarvamTTSService(
    api_key=os.getenv("SARVAM_API_KEY"),
    target_language_code="en-IN",
    model="bulbul:v3",
    speaker="aditya"
)

llm = OpenAILLMService(api_key=os.getenv("OPENAI_API_KEY"), model="gpt-4o-mini")
```

**Note:** Saaras automatically detects the source language (Hindi, Tamil, etc.) and translates spoken content directly to English text, making Indian language speech comprehensible to English-based LLMs.

***

## Available Options

### Language Codes

| Language        | Code      |
| --------------- | --------- |
| English (India) | `en-IN`   |
| Hindi           | `hi-IN`   |
| Bengali         | `bn-IN`   |
| Tamil           | `ta-IN`   |
| Telugu          | `te-IN`   |
| Gujarati        | `gu-IN`   |
| Kannada         | `kn-IN`   |
| Malayalam       | `ml-IN`   |
| Marathi         | `mr-IN`   |
| Punjabi         | `pa-IN`   |
| Odia            | `od-IN`   |
| Auto-detect     | `unknown` |

### Speaker Voices (Bulbul v3)

**Male (23):** Shubh (default), Aditya, Rahul, Rohan, Amit, Dev, Ratan, Varun, Manan, Sumit, Kabir, Aayan, Ashutosh, Advait, Anand, Tarun, Sunny, Mani, Gokul, Vijay, Mohit, Rehan, Soham

**Female (16):** Ritu, Priya, Neha, Pooja, Simran, Kavya, Ishita, Shreya, Roopa, Amelia, Sophia, Tanya, Shruti, Suhani, Kavitha, Rupali

### TTS Additional Parameters

You can customize the TTS service with additional parameters:

```python
tts = SarvamTTSService(
    api_key=os.getenv("SARVAM_API_KEY"),
    target_language_code="en-IN",
    model="bulbul:v3",
    speaker="shubh",
    pace=1.0,            # Range: 0.5 to 2.0
    speech_sample_rate=24000  # 8000, 16000, 22050, 24000 Hz (default). v3 REST API also supports 32000, 44100, 48000 Hz
)
```

***

## Understanding the Pipeline

Pipecat uses a **pipeline architecture** where data flows through a series of processors:

```
User Audio → STT → Context Aggregator → LLM → TTS → Audio Output
```

1. **Transport Input**: Receives audio from the user
2. **STT (Speech-to-Text)**: Converts audio to text using Sarvam's Saarika
3. **Context Aggregator (User)**: Adds user message to conversation context
4. **LLM**: Generates response using OpenAI
5. **TTS (Text-to-Speech)**: Converts response to audio using Sarvam's Bulbul
6. **Transport Output**: Sends audio back to the user
7. **Context Aggregator (Assistant)**: Saves assistant's response to context

***

## Pro Tips

* Use `language="unknown"` to automatically detect the language. Great for multilingual scenarios!
* Sarvam's models understand code-mixing - your agent can naturally handle Hinglish, Tanglish, and other mixed languages.
* Adjust `pace` to customize the voice delivery speed.
* Use `gpt-4o-mini` for faster responses, or `gpt-4o` for more complex conversations.

***

## Troubleshooting

**API key errors**: Check that all keys are in your `.env` file and the file is in the same directory as your script.

**Module not found**: Run the installation command again based on your operating system (see Step 2 above).

**Poor transcription**: Try `language="unknown"` for auto-detection, or specify the correct language code (`en-IN`, `hi-IN`, etc.).

**Connection issues**: Ensure you have a stable internet connection and the transport is properly configured.

***

## Additional Resources

* [Sarvam AI Documentation](https://docs.sarvam.ai)
* [Pipecat Documentation](https://docs.pipecat.ai)
* [Pipecat GitHub Repository](https://github.com/pipecat-ai/pipecat)
* [Daily.co Documentation](https://docs.daily.co)

***

## Need Help?

* Sarvam Support: [developer@sarvam.ai](mailto:developer@sarvam.ai)
* Community: [Join the Discord Community](https://discord.com/invite/5rAsykttcs)

***

**Happy Building!**
