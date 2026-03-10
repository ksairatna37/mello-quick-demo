# Mello Webapp Demo

Investor demo frontend clone of the Mello chat interface.

## Setup

```bash
npm install
cp .env.example .env
# add server Azure vars: AZURE_OPENAI_KEY, AZURE_OPENAI_ENDPOINT, AZURE_DEPLOYMENT_NAME, AZURE_API_VERSION
# add browser voice vars: VITE_HUME_API_KEY and optional VITE_HUME_CONFIG_ID
npm run dev
```

Run backend for chat API:

```bash
npm start
```

Production flow:

```bash
npm run build
npm start
```

## Notes

- No auth
- Backend added for text chat (`/api/chat`) so Azure key stays on server
- No backend for voice mode (Hume key is still browser-side if enabled)
- Voice chat connects directly to Hume EVI via browser WebSocket
