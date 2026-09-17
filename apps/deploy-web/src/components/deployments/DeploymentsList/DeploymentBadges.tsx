"use client";
import type { FC } from "react";

import { useWallet } from "@src/context/WalletProvider";
import { useDeclaredGpuInterconnect } from "@src/hooks/useDeclaredGpuInterconnect";
import type { DeploymentDto } from "@src/types/deployment";
import { GpuInterconnectBadge } from "../../shared/GpuInterconnectBadge";
import { TrialDeploymentBadge } from "../../shared/TrialDeploymentBadge";

export const DEPENDENCIES = {
  useWallet,
  useDeclaredGpuInterconnect,
  GpuInterconnectBadge,
  TrialDeploymentBadge
};

export interface DeploymentBadgesProps {
  deployment: DeploymentDto;
  dependencies?: typeof DEPENDENCIES;
}

export const DeploymentBadges: FC<DeploymentBadgesProps> = ({ deployment, dependencies: d = DEPENDENCIES }) => {
  const interconnect = d.useDeclaredGpuInterconnect(deployment);
  const { isTrialing } = d.useWallet();
  const isClosed = deployment.state === "closed";

  if (isClosed || (!interconnect.enabled && !isTrialing)) return null;

  return (
    <div className="flex flex-wrap items-center gap-1">
      {interconnect.enabled && <d.GpuInterconnectBadge interconnect={interconnect} compact />}
      {isTrialing && <d.TrialDeploymentBadge createdHeight={deployment.createdAt} />}
    </div>
  );
};
