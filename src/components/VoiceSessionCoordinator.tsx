import { useEffect, useRef } from "react";
import { useVoice, VoiceReadyState } from "@humeai/voice-react";
import { useHumeIntervention } from "@/components/HumeInterventionContext";

type VoiceSessionCoordinatorProps = {
  onSessionReset: () => void;
};

const EMPTY_SESSION_SETTINGS = {
  type: "session_settings" as const,
  variables: {
    intervention_guidance: "",
  },
};

const VoiceSessionCoordinator = ({ onSessionReset }: VoiceSessionCoordinatorProps) => {
  const { currentIntervention, clearIntervention } = useHumeIntervention();
  const { readyState, sendSessionSettings } = useVoice();
  const activeTimeoutRef = useRef<number | null>(null);
  const lastSentTypeRef = useRef<string | null>(null);

  useEffect(() => {
    if (readyState !== VoiceReadyState.OPEN) {
      if (activeTimeoutRef.current !== null) {
        window.clearTimeout(activeTimeoutRef.current);
        activeTimeoutRef.current = null;
      }

      lastSentTypeRef.current = null;
      clearIntervention();
      onSessionReset();
      return;
    }

    if (!currentIntervention) {
      if (lastSentTypeRef.current !== null) {
        console.log("[VoiceSessionCoordinator] clearing session settings");
        sendSessionSettings(EMPTY_SESSION_SETTINGS);
        lastSentTypeRef.current = null;
      }

      return;
    }

    if (lastSentTypeRef.current !== currentIntervention.type) {
      if (currentIntervention.guidance.length > 200) {
        console.warn(
          `[VoiceSessionCoordinator] warning guidance too long type=${currentIntervention.type} length=${currentIntervention.guidance.length}`,
        );
      }

      console.log(`[VoiceSessionCoordinator] sending session settings type=${currentIntervention.type}`);
      sendSessionSettings({
        type: "session_settings",
        variables: {
          intervention_guidance: currentIntervention.guidance,
        },
      });
      console.log(`[VoiceSessionCoordinator] session settings sent type=${currentIntervention.type}`);
      lastSentTypeRef.current = currentIntervention.type;
    }

    if (activeTimeoutRef.current !== null) {
      window.clearTimeout(activeTimeoutRef.current);
    }

    activeTimeoutRef.current = window.setTimeout(() => {
      console.log(`[VoiceSessionCoordinator] intervention ttl expired type=${currentIntervention.type}`);
      sendSessionSettings(EMPTY_SESSION_SETTINGS);
      lastSentTypeRef.current = null;
      clearIntervention();
    }, currentIntervention.ttlMs);

    return () => {
      if (activeTimeoutRef.current !== null) {
        window.clearTimeout(activeTimeoutRef.current);
        activeTimeoutRef.current = null;
      }
    };
  }, [clearIntervention, currentIntervention, onSessionReset, readyState, sendSessionSettings]);

  return null;
};

export default VoiceSessionCoordinator;
