# Hume AI Connection Details

This document explains only how this project connects to Hume AI.

## Overview

This project connects to Hume AI using the `@humeai/voice-react` package.

The connection flow is:

1. Hume credentials are loaded from environment variables.
2. The page is wrapped with `VoiceProvider`.
3. The voice UI calls `useVoice()`.
4. When the user starts a session, the app calls `connect(...)`.
5. Hume voice events and transcript messages are read from the hook state.

## Package Used

Hume integration is provided by:

```json
"@humeai/voice-react": "^0.2.14"
```

From:

- `package.json`

## Environment Variables

The project reads these variables:

```env
VITE_HUME_API_KEY=your_hume_api_key
VITE_HUME_CONFIG_ID=your_hume_config_id
```

In this project, they are accessed like this:

```ts
const HUME_API_KEY = import.meta.env.VITE_HUME_API_KEY || "";
const HUME_CONFIG_ID = import.meta.env.VITE_HUME_CONFIG_ID || "";
```

## Provider Setup

The Hume voice session is enabled by wrapping the page with `VoiceProvider`.

```tsx
import { VoiceProvider } from "@humeai/voice-react";
import VoiceInterface from "@/components/VoiceInterface";

const Index = () => {
  return (
    <VoiceProvider>
      <VoiceInterface />
    </VoiceProvider>
  );
};

export default Index;
```

This makes the Hume voice context available to components inside it.

## Voice Hook Setup

Inside `VoiceInterface.tsx`, the app uses Hume's `useVoice()` hook:

```tsx
const {
  connect,
  disconnect,
  readyState,
  messages,
  isMuted,
  mute,
  unmute,
  micFft,
  isPlaying,
} = useVoice();
```

These values are used for:

- `connect`: starts the Hume voice session
- `disconnect`: ends the Hume voice session
- `readyState`: checks if the session is open
- `messages`: receives transcript and conversation messages
- `isMuted`, `mute`, `unmute`: controls microphone mute state
- `micFft`: microphone audio FFT data from the active session
- `isPlaying`: indicates when Hume is playing assistant audio

## Actual Connection Code

The app connects to Hume AI with this code:

```tsx
const handleStart = useCallback(async () => {
  try {
    await connect({
      auth: { type: "apiKey", value: HUME_API_KEY },
      configId: HUME_CONFIG_ID,
    });
  } catch (error) {
    console.error("Failed to connect to Hume:", error);
  }
}, [connect]);
```

### What this does

- `auth.type: "apiKey"` tells Hume to authenticate using an API key
- `value: HUME_API_KEY` sends the Hume API key
- `configId: HUME_CONFIG_ID` tells Hume which EVI configuration to use

## Reconnect Flow

The reset action disconnects and reconnects to Hume:

```tsx
const handleReset = useCallback(async () => {
  await disconnect();
  setTranscriptMessages([]);
  setTimeout(async () => {
    try {
      await connect({
        auth: { type: "apiKey", value: HUME_API_KEY },
        configId: HUME_CONFIG_ID,
      });
    } catch (e) {
      console.error("Failed to reconnect:", e);
    }
  }, 500);
}, [disconnect, connect]);
```

## Connection State Check

The app treats the session as connected when Hume's ready state is open:

```tsx
const isConnected = readyState === VoiceReadyState.OPEN;
```

## Transcript Data From Hume

Incoming Hume messages are mapped into local transcript entries:

```tsx
useEffect(() => {
  const processed: TranscriptMessage[] = [];

  for (const msg of messages) {
    if (msg.type === "user_message" && "message" in msg && msg.message?.content) {
      processed.push({
        id: `user-${processed.length}`,
        role: "user",
        content: msg.message.content,
      });
    } else if (msg.type === "assistant_message" && "message" in msg && msg.message?.content) {
      processed.push({
        id: `assistant-${processed.length}`,
        role: "assistant",
        content: msg.message.content,
      });
    }
  }

  setTranscriptMessages(processed);
}, [messages]);
```

This means transcript content is coming from the Hume voice session through `messages`.

## Audio State From Hume

Two values from `useVoice()` show live voice-session state:

### Assistant speaking state

```tsx
if (isPlaying) {
  setOrbState("speaking");
} else {
  setOrbState("listening");
}
```

`isPlaying` indicates that Hume is actively playing assistant audio.

### Microphone FFT data

```tsx
if (micFft && micFft.length > 0 && state === "listening") {
  const avg = Array.from(micFft).reduce((a, b) => a + b, 0) / micFft.length;
  fftScale = 1 + Math.min(avg * 2, 0.15);
}
```

`micFft` provides microphone audio energy data from the active Hume voice session.

## Minimal Example

If you only want the core Hume connection logic, this is the essential pattern:

```tsx
import { VoiceProvider, useVoice, VoiceReadyState } from "@humeai/voice-react";

const HUME_API_KEY = import.meta.env.VITE_HUME_API_KEY || "";
const HUME_CONFIG_ID = import.meta.env.VITE_HUME_CONFIG_ID || "";

function VoiceClient() {
  const { connect, disconnect, readyState, messages } = useVoice();
  const isConnected = readyState === VoiceReadyState.OPEN;

  const start = async () => {
    await connect({
      auth: { type: "apiKey", value: HUME_API_KEY },
      configId: HUME_CONFIG_ID,
    });
  };

  return (
    <div>
      <button onClick={start}>Start</button>
      <button onClick={() => disconnect()}>End</button>
      <div>{isConnected ? "Connected" : "Disconnected"}</div>
      <pre>{JSON.stringify(messages, null, 2)}</pre>
    </div>
  );
}

export default function Page() {
  return (
    <VoiceProvider>
      <VoiceClient />
    </VoiceProvider>
  );
}
```

## Files In This Project

The Hume connection is currently implemented in:

- `src/pages/Index.tsx`
- `src/components/VoiceInterface.tsx`
- `.env`
- `package.json`

## Important Security Note

This project currently uses:

```ts
import.meta.env.VITE_HUME_API_KEY
```

Because this is a Vite client-side environment variable, it is exposed to the browser bundle.

For local testing this works, but for a real production setup, the safer approach is:

1. keep the Hume API key on the server
2. generate short-lived auth on the backend
3. connect the frontend using server-issued credentials instead of a public `VITE_*` API key
