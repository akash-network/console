"use client";

import type { DeploymentDto, LeaseDto } from "@src/types/deployment";
import { useRealTimeLeft } from "@src/utils/priceUtils";

interface DeploymentTimeMetrics {
  realTimeLeft: ReturnType<typeof useRealTimeLeft>;
  deploymentCost: number;
}

type Props = {
  deployment: DeploymentDto;
  leases: LeaseDto[] | undefined | null;
};

export const useDeploymentMetrics = ({ deployment, leases }: Props): DeploymentTimeMetrics => {
  const hasLeases = !!leases && leases.length > 0;
  const deploymentCost = hasLeases ? leases.reduce((prev, current) => prev + parseFloat(current.price.amount), 0) : 0;
  const realTimeLeft = useRealTimeLeft(deploymentCost, deployment.escrowBalance, parseFloat(deployment.escrowAccount.settled_at), deployment.createdAt);

  return {
    realTimeLeft,
    deploymentCost
  };
};
