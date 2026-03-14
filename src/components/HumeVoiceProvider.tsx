import { useCallback, useRef, useState, type ReactNode } from "react";
import { VoiceProvider, type JSONMessage } from "@humeai/voice-react";
import { HumeInterventionProvider } from "@/components/HumeInterventionContext";
import VoiceSessionCoordinator from "@/components/VoiceSessionCoordinator";
import {
  detectIntervention,
  getInitialInterventionDetectorState,
  type InterventionDecision,
} from "@/lib/hume/interventions";

type HumeVoiceProviderProps = {
  children: ReactNode;
  enableAudioWorklet: boolean;
};

const HumeVoiceProvider = ({ children, enableAudioWorklet }: HumeVoiceProviderProps) => {
  const [currentIntervention, setCurrentIntervention] = useState<InterventionDecision | null>(null);
  const [lastAppliedAt, setLastAppliedAt] = useState<number | null>(null);
  const detectorStateRef = useRef(getInitialInterventionDetectorState());
  const lastUserMessageTimeRef = useRef<number | null>(null);

  const clearIntervention = useCallback(() => {
    setCurrentIntervention(null);
    setLastAppliedAt(null);
  }, []);

  const resetInterventionState = useCallback(() => {
    detectorStateRef.current = getInitialInterventionDetectorState();
    setCurrentIntervention(null);
    setLastAppliedAt(null);
  }, []);

  const handleMessage = useCallback((message: JSONMessage) => {
    if (message.type === "user_message") {
      lastUserMessageTimeRef.current = performance.now();
      console.log(`[HumeVoiceProvider] user_message received transcript="${message.message?.content ?? ""}"`);
    }

    if (message.type === "assistant_message" && lastUserMessageTimeRef.current !== null) {
      const latencyMs = Math.round(performance.now() - lastUserMessageTimeRef.current);
      console.log(
        `[HumeVoiceProvider] assistant_message received latencyMs=${latencyMs} transcript="${message.message?.content ?? ""}"`,
      );
    }

    const now = Date.now();
    const nextIntervention = detectIntervention(message, detectorStateRef.current, now);
    if (!nextIntervention) {
      return;
    }

    const existingPriority = currentIntervention?.priority ?? -1;
    if (currentIntervention && currentIntervention.type !== nextIntervention.type && existingPriority > nextIntervention.priority) {
      return;
    }

    detectorStateRef.current = {
      lastDecisionType: nextIntervention.type,
      lastDecisionAt: now,
    };
    console.log(`[HumeVoiceProvider] applying intervention type=${nextIntervention.type}`);
    setCurrentIntervention(nextIntervention);
    setLastAppliedAt(now);
  }, [currentIntervention]);

  return (
    <VoiceProvider enableAudioWorklet={enableAudioWorklet} onMessage={handleMessage}>
      <HumeInterventionProvider
        value={{
          currentIntervention,
          lastAppliedAt,
          clearIntervention,
          resetInterventionState,
        }}
      >
        <VoiceSessionCoordinator onSessionReset={resetInterventionState} />
        {children}
      </HumeInterventionProvider>
    </VoiceProvider>
  );
};

export default HumeVoiceProvider;
