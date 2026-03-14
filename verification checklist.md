📋 Verification Checklist
Before going live, verify:

1. Config Variable is Recognized
Test that Hume accepts the variable:

typescript
// In your VoiceChat.tsx or test file
const testConnection = async () => {
  const { apiKey, configId } = await fetch('/api/hume-auth').then(r => r.json());
  
  connect({
    auth: { type: 'apiKey', value: apiKey },
    configId: configId,
    sessionSettings: {
      type: 'session_settings',
      variables: {
        intervention_guidance: 'Test: If user mentions test, say "variable injection working!"'
      }
    }
  });
};
Then say "test" and see if Mello responds with the injected phrase.

2. Intervention Detection Fires
Add console logging to verify your rule engine triggers:

typescript
// In src/lib/hume/interventions.ts
export function detectIntervention(message: any): InterventionConfig | null {
  console.log('🔍 Checking message:', {
    transcript: message.message?.content,
    emotions: message.models?.prosody?.scores
  });
  
  const result = /* your detection logic */;
  
  if (result) {
    console.log('✅ Intervention triggered:', result.type);
  }
  
  return result;
}
3. Session Settings Update Successfully
Verify the WebSocket message is sent:

typescript
// In src/components/VoiceSessionCoordinator.tsx
const handleIntervention = (event: CustomEvent) => {
  console.log('📤 Sending session settings:', event.detail.guidance);
  
  sendSessionSettings({
    type: 'session_settings',
    variables: {
      intervention_guidance: event.detail.guidance
    }
  });
  
  console.log('✅ Session settings sent');
};
4. Latency Measurement
Add timing to confirm the performance improvement:

typescript
// Track time from user speech end to assistant speech start
let userEndTime: number;
let assistantStartTime: number;

onMessage={(message) => {
  if (message.type === 'user_message') {
    userEndTime = performance.now();
  }
  if (message.type === 'assistant_message') {
    assistantStartTime = performance.now();
    const latency = assistantStartTime - userEndTime;
    console.log(`⏱️ Response latency: ${latency}ms`);
  }
}}
Expected results:

Without intervention: 400-600ms
With intervention: 420-650ms
Both significantly faster than your original 4000-char prompt baseline
🚨 Common Pitfalls to Avoid
1. Variable Not Clearing Between Interventions
Make sure your timeout logic resets properly:

typescript
// In VoiceSessionCoordinator.tsx
setTimeout(() => {
  setCurrentIntervention('');
  sendSessionSettings({
    type: 'session_settings',
    variables: {
      intervention_guidance: '' // ✅ Clear to empty string, not null
    }
  });
}, 120000);
2. Intervention Guidance Too Long
Keep each intervention script under 200 characters to maintain low latency:

typescript
// ❌ BAD - Too verbose
guidance: 'When the user expresses feelings of anxiety or distress, you should first validate their emotions by acknowledging what they are experiencing, then offer to guide them through a calming breathing exercise...' // 300+ chars

// ✅ GOOD - Concise and actionable
guidance: 'When user shows high anxiety, offer: "Would you like to try a quick breathing exercise?" If yes, guide box breathing slowly.' // ~120 chars
3. Re-triggering Same Intervention
Your cooldown logic should prevent spam:

typescript
// In your intervention handler
if (intervention.type !== currentIntervention) {
  // ✅ Only trigger if different from current
  setCurrentIntervention(intervention.type);
  sendSessionSettings(/* ... */);
}📋 Verification Checklist
Before going live, verify:

1. Config Variable is Recognized
Test that Hume accepts the variable:

typescript
// In your VoiceChat.tsx or test file
const testConnection = async () => {
  const { apiKey, configId } = await fetch('/api/hume-auth').then(r => r.json());
  
  connect({
    auth: { type: 'apiKey', value: apiKey },
    configId: configId,
    sessionSettings: {
      type: 'session_settings',
      variables: {
        intervention_guidance: 'Test: If user mentions test, say "variable injection working!"'
      }
    }
  });
};
Then say "test" and see if Mello responds with the injected phrase.

2. Intervention Detection Fires
Add console logging to verify your rule engine triggers:

typescript
// In src/lib/hume/interventions.ts
export function detectIntervention(message: any): InterventionConfig | null {
  console.log('🔍 Checking message:', {
    transcript: message.message?.content,
    emotions: message.models?.prosody?.scores
  });
  
  const result = /* your detection logic */;
  
  if (result) {
    console.log('✅ Intervention triggered:', result.type);
  }
  
  return result;
}
3. Session Settings Update Successfully
Verify the WebSocket message is sent:

typescript
// In src/components/VoiceSessionCoordinator.tsx
const handleIntervention = (event: CustomEvent) => {
  console.log('📤 Sending session settings:', event.detail.guidance);
  
  sendSessionSettings({
    type: 'session_settings',
    variables: {
      intervention_guidance: event.detail.guidance
    }
  });
  
  console.log('✅ Session settings sent');
};
4. Latency Measurement
Add timing to confirm the performance improvement:

typescript
// Track time from user speech end to assistant speech start
let userEndTime: number;
let assistantStartTime: number;

onMessage={(message) => {
  if (message.type === 'user_message') {
    userEndTime = performance.now();
  }
  if (message.type === 'assistant_message') {
    assistantStartTime = performance.now();
    const latency = assistantStartTime - userEndTime;
    console.log(`⏱️ Response latency: ${latency}ms`);
  }
}}
Expected results:

Without intervention: 400-600ms
With intervention: 420-650ms
Both significantly faster than your original 4000-char prompt baseline
🚨 Common Pitfalls to Avoid
1. Variable Not Clearing Between Interventions
Make sure your timeout logic resets properly:

typescript
// In VoiceSessionCoordinator.tsx
setTimeout(() => {
  setCurrentIntervention('');
  sendSessionSettings({
    type: 'session_settings',
    variables: {
      intervention_guidance: '' // ✅ Clear to empty string, not null
    }
  });
}, 120000);
2. Intervention Guidance Too Long
Keep each intervention script under 200 characters to maintain low latency:

typescript
// ❌ BAD - Too verbose
guidance: 'When the user expresses feelings of anxiety or distress, you should first validate their emotions by acknowledging what they are experiencing, then offer to guide them through a calming breathing exercise...' // 300+ chars

// ✅ GOOD - Concise and actionable
guidance: 'When user shows high anxiety, offer: "Would you like to try a quick breathing exercise?" If yes, guide box breathing slowly.' // ~120 chars
3. Re-triggering Same Intervention
Your cooldown logic should prevent spam:

typescript
// In your intervention handler
if (intervention.type !== currentIntervention) {
  // ✅ Only trigger if different from current
  setCurrentIntervention(intervention.type);
  sendSessionSettings(/* ... */);
}