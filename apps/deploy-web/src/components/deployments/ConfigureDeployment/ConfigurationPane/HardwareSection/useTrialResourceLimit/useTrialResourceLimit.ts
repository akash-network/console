import { useServices } from "@src/context/ServicesProvider";
import type { TrialResourceLimit } from "../trialResourceLimit/trialResourceLimit";
import { useTrialGate } from "../useTrialGate/useTrialGate";

export const DEPENDENCIES = { useTrialGate, useServices };

/** Undefined when no cap applies: the user isn't on a trial, or both caps are switched off. */
export function useTrialResourceLimit(dependencies: typeof DEPENDENCIES = DEPENDENCIES): TrialResourceLimit | undefined {
  const { isRestricted } = dependencies.useTrialGate();
  const { publicConfig } = dependencies.useServices();
  const limit = { maxCpu: publicConfig.NEXT_PUBLIC_MANAGED_WALLET_TRIAL_MAX_CPU, maxMemoryGi: publicConfig.NEXT_PUBLIC_MANAGED_WALLET_TRIAL_MAX_MEMORY_GI };
  const hasCap = limit.maxCpu > 0 || limit.maxMemoryGi > 0;
  return isRestricted && hasCap ? limit : undefined;
}
