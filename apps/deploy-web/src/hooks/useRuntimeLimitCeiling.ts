import { useServices } from "@src/context/ServicesProvider";
import { useWallet } from "@src/context/WalletProvider";
import { MAX_RUNTIME_LIMIT_HOURS, MAX_RUNTIME_LIMIT_INCREMENT_HOURS } from "@src/utils/runtimeLimitUtils";

export const DEPENDENCIES = { useWallet, useServices };

export type RuntimeLimitCeiling = {
  maxInitialHours: number;
  maxTotalHours: number;
};

/** A trial deployment is closed once the trial's deployment duration runs out, so a longer limit would promise runtime it never gets. */
export function useRuntimeLimitCeiling(d: typeof DEPENDENCIES = DEPENDENCIES): RuntimeLimitCeiling {
  const { isTrialing } = d.useWallet();
  const { publicConfig } = d.useServices();

  if (!isTrialing) {
    return { maxInitialHours: MAX_RUNTIME_LIMIT_INCREMENT_HOURS, maxTotalHours: MAX_RUNTIME_LIMIT_HOURS };
  }

  const trialDeploymentHours = publicConfig.NEXT_PUBLIC_TRIAL_DEPLOYMENTS_DURATION_HOURS;

  return { maxInitialHours: Math.min(trialDeploymentHours, MAX_RUNTIME_LIMIT_INCREMENT_HOURS), maxTotalHours: trialDeploymentHours };
}
