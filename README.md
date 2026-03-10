# Mello Webapp Demo

Investor demo frontend clone of the Mello chat interface.

## Setup

```bash
npm install
cp .env.example .env
# add server Azure vars: AZURE_OPENAI_KEY, AZURE_OPENAI_ENDPOINT, AZURE_DEPLOYMENT_NAME, AZURE_API_VERSION
# optional: MELLO_SYSTEM_PROMPT (server-side system instruction)
# add server voice vars: HUME_API_KEY and optional HUME_CONFIG_ID
# optional frontend overrides: VITE_API_BASE_URL, VITE_WS_BASE_URL
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
- Backend WebSocket proxy added for voice chat (`/ws/voice`) so Hume key stays on server
