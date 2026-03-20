# Hume AI Connection Details

This document describes the current Hume voice integration in this repo.

## Overview

The app uses `@humeai/voice-react@^0.2.14` for Hume EVI voice sessions.

Current flow:

1. `src/main.tsx` mounts `HumeVoiceProvider`.
2. `HumeVoiceProvider` wraps the app in Hume's `VoiceProvider`.
3. `VoiceProvider.onMessage` is used to inspect incoming Hume JSON messages.
4. Client-side intervention rules detect crisis, anxiety, work exhaustion, loneliness, and trauma patterns.
5. `VoiceSessionCoordinator` updates Hume session variables in real time with `sendSessionSettings(...)`.
6. `VoiceChat.tsx` starts the session by fetching `/api/hume-auth` and calling `connect(...)`.

## Files

The Hume voice integration now lives in:

- `src/main.tsx`
- `src/components/HumeVoiceProvider.tsx`
- `src/components/HumeInterventionContext.tsx`
- `src/components/VoiceSessionCoordinator.tsx`
- `src/lib/hume/interventions.ts`
- `src/components/VoiceChat.tsx`
- `server.js`

## Auth Endpoint

`GET /api/hume-auth` is still the backend auth endpoint.

It returns:

```json
{
  "apiKey": "server-side-hume-key",
  "configId": "optional-hume-config-id"
}
```

Implemented in `server.js`.

## Provider Setup

`src/main.tsx` now mounts the app like this:

```tsx
<HumeVoiceProvider enableAudioWorklet={!(isIOS || isSafari)}>
  <App />
</HumeVoiceProvider>
```

`HumeVoiceProvider` is responsible for:

- passing `onMessage` to Hume's `VoiceProvider`
- detecting intervention triggers from Hume user messages
- storing the active intervention in React context
- rendering `VoiceSessionCoordinator` so session variables can be pushed back to Hume

## Connection Logic

`src/components/VoiceChat.tsx` still owns the user-triggered connect flow.

It calls:

```tsx
await connect({
  auth: { type: "apiKey", value: auth.apiKey },
  configId: auth.configId,
  sessionSettings: {
    type: "session_settings",
    variables: {
      intervention_guidance: "",
    },
  },
});
```

This initializes the Hume session with an empty `intervention_guidance` variable so the coordinator can safely update it later.

## Dynamic Intervention Flow

`src/lib/hume/interventions.ts` contains the rule engine.

It currently provides:

- `InterventionType`
- `InterventionDecision`
- `InterventionRule`
- `detectIntervention(...)`
- cooldown-based duplicate suppression

The detector currently evaluates:

- crisis language
- anxiety or distress
- work exhaustion
- loneliness
- trauma

`VoiceSessionCoordinator` watches the active intervention and:

- sends new `session_settings` messages with `intervention_guidance`
- clears guidance after the intervention TTL expires
- clears guidance and local state when the Hume session disconnects

## UI State

`VoiceChat.tsx` keeps the existing voice UI behavior and now also shows a lightweight active-guidance indicator while connected.

Existing features remain unchanged:

- connect / disconnect
- mute / unmute
- transcript display
- timer
- audio state handling

## Important Remote Config Requirement

The intervention system only affects Hume voice behavior if the remote Hume EVI prompt includes a variable placeholder such as:

```text
{{intervention_guidance}}
```

That placeholder must be added in the Hume config referenced by `configId`.

This repo does **not** edit the remote Hume prompt automatically.

## Security Note

This repo currently returns a raw Hume API key from `/api/hume-auth` to the browser session.

That is better than baking the key into the client bundle, but for production you should prefer short-lived server-issued credentials if Hume supports them for your deployment pattern.
