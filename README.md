# Mello Webapp Demo

Investor demo frontend clone of the Mello chat interface.

## Setup

```bash
npm install
cp .env.example .env
# add VITE_HUME_API_KEY and optional VITE_HUME_CONFIG_ID
# add Azure vars: VITE_AZURE_OPENAI_KEY, VITE_AZURE_OPENAI_ENDPOINT, VITE_AZURE_DEPLOYMENT_NAME, VITE_AZURE_API_VERSION
npm run dev
```

## Notes

- No auth
- No backend for voice mode
- Text chat calls Azure OpenAI endpoint directly from frontend
- Voice chat connects directly to Hume EVI via browser WebSocket
