"use client";

import type { DeploymentDto, LeaseDto } from "@src/types/deployment";
import { isLeaseLive } from "@src/utils/leaseUtils";
import { useRealTimeLeft } from "./useRealTimeLeft";

export const DEPENDENCIES = { useRealTimeLeft };

interface DeploymentTimeMetrics {
  realTimeLeft: ReturnType<typeof useRealTimeLeft>;
  deploymentCost: number;
}

type Props = {
  deployment: DeploymentDto;
  leases: LeaseDto[] | undefined | null;
  dependencies?: typeof DEPENDENCIES;
};

/**
 * A deployment's per-block burn rate and the escrow runway it buys. Only live leases count: a closed
 * one has stopped drawing on the escrow, and `useRealTimeLeft` reads the sum as the rate the balance
 * is draining at right now. Counting a lease a provider closed would overstate the rate on a dseq
 * that was re-leased, shortening the projected runway and understating what is left.
 */
export const useDeploymentMetrics = ({ deployment, leases, dependencies: d = DEPENDENCIES }: Props): DeploymentTimeMetrics => {
  const deploymentCost = (leases ?? []).filter(isLeaseLive).reduce((total, lease) => total + parseFloat(lease.price.amount), 0);
  const realTimeLeft = d.useRealTimeLeft(deploymentCost, deployment.escrowBalance, parseFloat(deployment.escrowAccount.state.settled_at), deployment.createdAt);

  return {
    realTimeLeft,
    deploymentCost
  };
};
