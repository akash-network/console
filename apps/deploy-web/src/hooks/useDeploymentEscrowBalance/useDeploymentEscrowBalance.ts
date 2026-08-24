"use client";
import { useDeploymentMetrics } from "@src/hooks/useDeploymentMetrics";
import type { DeploymentDto, LeaseDto } from "@src/types/deployment";
import { getEscrowDenom } from "@src/utils/deploymentUtils";
import { isLeaseLive } from "@src/utils/leaseUtils";

export const DEPENDENCIES = { useDeploymentMetrics };

export interface UseDeploymentEscrowBalanceParams {
  deployment: DeploymentDto;
  leases: LeaseDto[] | null | undefined;
  dependencies?: typeof DEPENDENCIES;
}

/**
 * How much is left in one deployment's escrow, which is what funds that deployment and nothing else.
 * A running deployment spends continuously, so the live figure comes from the ticking metrics rather
 * than the last value the chain reported; a deployment that is closed or has no live lease is not
 * spending, and its stored escrow balance is already current.
 */
export function useDeploymentEscrowBalance({ deployment, leases, dependencies: d = DEPENDENCIES }: UseDeploymentEscrowBalanceParams) {
  const { realTimeLeft } = d.useDeploymentMetrics({ deployment, leases });

  const isSpending = deployment.state === "active" && !!leases?.some(isLeaseLive);

  return {
    balanceUdenom: isSpending && realTimeLeft ? realTimeLeft.escrow : deployment.escrowBalance,
    denom: getEscrowDenom(deployment)
  };
}
