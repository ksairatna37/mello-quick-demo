🔧 Suggested Modifications

Strengthen Crisis Detection with Emotion Fallback
Current Issue: Crisis regex is comprehensive, but some crisis language might be missed if phrased differently.

Suggested Enhancement:

typescript
{
  type: "crisis",
  guidance: "...",
  ttlMs: 180_000,
  priority: 100,
  cooldownMs: 15_000,
  matches: ({ transcript, emotions }) => {
    // Primary: Explicit crisis language
    if (CRISIS_REGEX.test(transcript)) {
      return true;
    }
    
    // Secondary: Implicit crisis through goodbye + extreme distress
    if (/\b(goodbye|can't go on|cannot go on|no point anymore)\b/i.test(transcript) &&
        hasEmotion(emotions, ["distress", "sadness", "pain", "fear"], 0.35)) {
      return true;
    }
    
    // ✅ NEW: Tertiary fallback for extreme combined distress
    // Catches crisis even without keywords if emotions are severe
    const extremeDistress = hasEmotion(emotions, ["distress", "pain", "horror"], 0.75);
    const extremeSadness = hasEmotion(emotions, ["sadness", "despair"], 0.75);
    const mentionsFeeling = /\b(feel|feeling|i'm|im)\b/i.test(transcript);
    
    if (extremeDistress && extremeSadness && mentionsFeeling) {
      console.log('[interventions] crisis detected via extreme emotion fallback');
      return true;
    }
    
    return false;
  },
}
Benefit: Catches crisis situations even when user doesn't use explicit crisis keywords.

3. Add Compound Emotion Detection for Better Accuracy
Current Issue: hasEmotion() checks if ANY emotion exceeds threshold. Some interventions need MULTIPLE emotions present.

Suggested Addition:

typescript
// Add after hasEmotion function
function hasEmotionCombination(
  emotions: EmotionScores,
  combinations: Array<{ emotions: string[]; threshold: number }>,
  requireAll = false,
): boolean {
  const matches = combinations.map(({ emotions: emotionNames, threshold }) =>
    hasEmotion(emotions, emotionNames, threshold)
  );
  
  return requireAll ? matches.every(Boolean) : matches.some(Boolean);
}
Usage Example:

typescript
{
  type: "work_exhaustion",
  guidance: "...",
  ttlMs: DEFAULT_TTL_MS,
  priority: 60,
  cooldownMs: DEFAULT_COOLDOWN_MS,
  matches: ({ transcript, emotions }) =>
    WORK_EXHAUSTION_REGEX.test(transcript) &&
    // ✅ IMPROVED: Require BOTH tiredness AND stress/anxiety
    hasEmotionCombination(
      emotions,
      [
        { emotions: ["tiredness", "fatigue"], threshold: 0.3 },
        { emotions: ["stress", "anxiety", "distress"], threshold: 0.25 }
      ],
      true // requireAll
    ),
}
Benefit: More precise detection—workaholic pattern needs both exhaustion AND stress, not just one.

4. Add Transcript Length Check to Prevent False Positives
Current Issue: Very short messages like "I'm alone" might trigger loneliness even if context doesn't warrant it.

Suggested Fix:

typescript
const MIN_TRANSCRIPT_LENGTH = 15; // characters

export function detectIntervention(
  message: HumeMessageLike,
  state: InterventionDetectorState,
  now = Date.now(),
): InterventionDecision | null {
  if (message.type !== "user_message") {
    return null;
  }

  const transcript = message.message?.content?.trim() ?? "";
  
  // ✅ NEW: Skip very short messages unless they're crisis-related
  if (transcript.length < MIN_TRANSCRIPT_LENGTH) {
    const isPotentialCrisis = CRISIS_REGEX.test(transcript);
    if (!isPotentialCrisis) {
      console.log(`[interventions] skipped short transcript length=${transcript.length}`);
      return null;
    }
  }

  // ... rest of function
}
Benefit: Reduces false positives on brief responses.

5. Improve Emotion Score Extraction Logging
Current Issue: Silent failure if emotion scores aren't found.

Suggested Enhancement:

typescript
function extractEmotionScores(models: unknown): EmotionScores {
  const rawScores = findEmotionRecord(models);
  
  if (!rawScores) {
    // ✅ NEW: Log when emotions aren't found
    console.warn('[interventions] no emotion scores found in message.models');
    return {};
  }

  const normalized: EmotionScores = {};
  let validCount = 0;

  for (const [key, value] of Object.entries(rawScores)) {
    if (typeof value !== "number" || Number.isNaN(value)) {
      continue;
    }

    normalized[normalizeKey(key)] = value;
    validCount++;
  }
  
  // ✅ NEW: Log extraction success
  console.log(`[interventions] extracted ${validCount} emotion scores`);

  return normalized;
}
Benefit: Easier to debug when Hume's emotion data isn't being received.

6. Add Intervention History Tracking
Current Issue: Only tracks last intervention. Can't detect patterns like "user triggered anxiety 3 times in 5 minutes."

Suggested Enhancement:

typescript
export type InterventionDetectorState = {
  lastDecisionType: InterventionType | null;
  lastDecisionAt: number | null;
  // ✅ NEW: Track intervention history
  history: Array<{
    type: InterventionType;
    timestamp: number;
  }>;
};

export function getInitialInterventionDetectorState(): InterventionDetectorState {
  return {
    lastDecisionType: null,
    lastDecisionAt: null,
    history: [], // ✅ NEW
  };
}

export function detectIntervention(
  message: HumeMessageLike,
  state: InterventionDetectorState,
  now = Date.now(),
): InterventionDecision | null {
  // ... existing logic ...
  
  // After finding a matching rule:
  if (matchedRule) {
    // ✅ NEW: Update history
    state.history.push({
      type: matchedRule.type,
      timestamp: now,
    });
    
    // Keep only last 10 minutes of history
    state.history = state.history.filter(
      entry => now - entry.timestamp < 600_000
    );
    
    // Check for escalation pattern (e.g., 3+ anxiety triggers in 5 min)
    const recentAnxiety = state.history.filter(
      entry => 
        entry.type === 'breathing' && 
        now - entry.timestamp < 300_000
    );
    
    if (recentAnxiety.length >= 3) {
      console.log('[interventions] escalation detected: repeated anxiety');
      // Could upgrade to crisis or suggest professional help
    }
    
    return matchedRule;
  }
  
  return null;
}
Benefit: Enables escalation detection and pattern analysis.

7. Add Configurable Thresholds
Current Issue: Thresholds are hardcoded. Makes A/B testing difficult.

Suggested Enhancement:

typescript
// ✅ NEW: Configurable thresholds
export type InterventionConfig = {
  emotionThresholds: {
    crisis: number;
    breathing: number;
    workExhaustion: number;
    loneliness: number;
    trauma: number;
    emotionalProcessing: number;
  };
  minTranscriptLength: number;
  enableEscalationDetection: boolean;
};

const DEFAULT_CONFIG: InterventionConfig = {
  emotionThresholds: {
    crisis: 0.35,
    breathing: 0.5,
    workExhaustion: 0.2,
    loneliness: 0.35,
    trauma: 0.3,
    emotionalProcessing: 0.3,
  },
  minTranscriptLength: 15,
  enableEscalationDetection: true,
};

export function detectIntervention(
  message: HumeMessageLike,
  state: InterventionDetectorState,
  config: InterventionConfig = DEFAULT_CONFIG,
  now = Date.now(),
): InterventionDecision | null {
  // Use config.emotionThresholds instead of hardcoded values
  // ...
}
Benefit: Easy to adjust sensitivity without code changes.

8. Improve Regex Patterns for Edge Cases
Current Patterns Are Good, But Could Be More Robust:

typescript
// ✅ IMPROVED: Add word boundaries and variations
const PANIC_REGEX =
  /\b(panic(?:king|ked)?|panic attack|anxious|anxiety attack|overwhelm(?:ed|ing)?|can'?t breathe|cannot breathe|hard(?:er)? to breathe|freaking out|chest (?:is )?tight|heart (?:is )?racing|spiral(?:ing|ed)?)\b/i;

const WORK_EXHAUSTION_REGEX =
  /\b(work(?:ing)? all (?:the )?time|can'?t stop work(?:ing)?|cannot stop work(?:ing)?|always work(?:ing)?|burn(?:ed|t)? out|burnout|exhausted (?:from|by) work|work (?:is )?everything|work (?:like )?\d+ hours?|keep pushing myself|can'?t (?:seem to )?stop|even on weekends|never stop work(?:ing)?|always on (?:the )?clock|work all weekend|i (?:just )?keep work(?:ing)?|i only work)\b/i;

// ✅ NEW: Add variations for "I'm" vs "Im" vs "I am"
const LONELINESS_REGEX =
  /\b(lonely|(?:all )?alone|isolated|nobody understands(?: me)?|no (?:real )?friends|feel(?:ing)? disconnected|feel(?:ing)? left out|no one gets me|i have nobody|no one to talk to|i'?m (?:so )?alone|nobody cares)\b/i;
Benefit: Catches more natural language variations.

9. Add Emotion Score Confidence Check
Current Issue: Low-confidence emotion scores might trigger interventions incorrectly.

Suggested Addition:

typescript
function extractEmotionScores(models: unknown): EmotionScores {
  const rawScores = findEmotionRecord(models);
  if (!rawScores) {
    return {};
  }

  const normalized: EmotionScores = {};

  for (const [key, value] of Object.entries(rawScores)) {
    if (typeof value !== "number" || Number.isNaN(value)) {
      continue;
    }
    
    // ✅ NEW: Only include emotions with meaningful scores
    // Hume scores typically range 0-1, filter out very low confidence
    if (value < 0.05) {
      continue;
    }

    normalized[normalizeKey(key)] = value;
  }

  return normalized;
}
Benefit: Ignores noise from very low emotion scores.

10. Add Return Value for State Updates
Current Issue: State is mutated in-place (for history tracking). Better to return updated state.

Suggested Pattern:

typescript
export type InterventionResult = {
  decision: InterventionDecision | null;
  updatedState: InterventionDetectorState;
};

export function detectIntervention(
  message: HumeMessageLike,
  state: InterventionDetectorState,
  now = Date.now(),
): InterventionResult {
  const updatedState = { ...state };
  
  // ... detection logic ...
  
  if (matchedRule) {
    updatedState.lastDecisionType = matchedRule.type;
    updatedState.lastDecisionAt = now;
    
    return {
      decision: matchedRule,
      updatedState,
    };
  }
  
  return {
    decision: null,
    updatedState,
  };
}
Benefit: Immutable state updates, easier to test, clearer data flow.