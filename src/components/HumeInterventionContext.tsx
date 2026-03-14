import { createContext, useContext } from "react";
import type { InterventionDecision } from "@/lib/hume/interventions";

export type HumeInterventionContextValue = {
  currentIntervention: InterventionDecision | null;
  lastAppliedAt: number | null;
  clearIntervention: () => void;
  resetInterventionState: () => void;
};

const HumeInterventionContext = createContext<HumeInterventionContextValue | null>(null);

export const HumeInterventionProvider = HumeInterventionContext.Provider;

export function useHumeIntervention() {
  const value = useContext(HumeInterventionContext);
  if (!value) {
    throw new Error("useHumeIntervention must be used within HumeVoiceProvider.");
  }

  return value;
}
