import { useFlag } from "./useFlag";

export const DEPENDENCIES = { useFlag };

/**
 * Whether escrow is abstracted away from the user, i.e. whether the per-deployment escrow figures and controls
 * (balance, time left, "Add funds", the auto top-up toggle) should be hidden.
 *
 * Both flags have to be on. `auto_reload_fixed_threshold` is what makes the platform own the deposit: the API
 * then bootstraps every deployment with a fixed amount and ignores a caller-supplied one. `deployment_runtime_limit`
 * is what puts the funding-mode control (runtime limit vs. always on) in place of the old toggle. Hiding the old
 * controls while only one of them is on would leave a deployment with no funding control at all.
 */
export function useIsEscrowAbstracted(dependencies: typeof DEPENDENCIES = DEPENDENCIES) {
  const isDepositManagedByPlatform = dependencies.useFlag("auto_reload_fixed_threshold");
  const hasFundingModeControl = dependencies.useFlag("deployment_runtime_limit");

  return isDepositManagedByPlatform && hasFundingModeControl;
}
