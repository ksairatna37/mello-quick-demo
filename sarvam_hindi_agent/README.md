# Mello Hindi Voice Agent

Hindi voice agent powered by Sarvam AI + LiveKit for the Mello mental health companion.

## Local Development

### Prerequisites
- Python 3.11+
- pip

### Setup

1. Create virtual environment:
```bash
cd sarvam_hindi_agent
python -m venv venv
source venv/bin/activate  # Linux/Mac
# or
venv\Scripts\activate  # Windows
```

2. Install dependencies:
```bash
pip install -r requirements.txt
```

3. Copy environment variables:
```bash
cp .env.example .env
# Edit .env with your actual keys
```

4. Run the agent:
```bash
python agent.py dev
```

## Azure App Service Deployment

### Create Python App Service

1. Create new App Service:
   - Runtime: Python 3.11
   - Region: Same as your Node.js app
   - Plan: B1 or higher

2. Configure environment variables in Azure Portal:
   - LIVEKIT_URL
   - LIVEKIT_API_KEY
   - LIVEKIT_API_SECRET
   - SARVAM_API_KEY
   - AZURE_OPENAI_API_KEY
   - AZURE_OPENAI_ENDPOINT
   - AZURE_OPENAI_API_VERSION

3. Set startup command:
```
python agent.py dev
```

4. Deploy using Azure CLI or GitHub Actions

## Voice Configuration

- **STT**: Sarvam saaras:v3 (auto-detect Hindi/English)
- **TTS**: Sarvam bulbul:v3 with Maitreyi voice (warm, empathetic)
- **LLM**: Azure OpenAI GPT-4o

## Architecture

```
User Browser (HindiVoiceChat.tsx)
        |
        v
LiveKit Cloud Room
        |
        v
Python Agent (this service)
   - Sarvam STT: Speech -> Text
   - Azure OpenAI: Generate response
   - Sarvam TTS: Text -> Speech
        |
        v
LiveKit Cloud Room
        |
        v
User Browser (receives audio)
```

