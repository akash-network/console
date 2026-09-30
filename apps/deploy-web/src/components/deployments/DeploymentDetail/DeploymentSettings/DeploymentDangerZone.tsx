"use client";
import type { FC } from "react";
import { useState } from "react";
import { Button, Spinner } from "@akashnetwork/ui/components";

import { useServices } from "@src/context/ServicesProvider";
import { useWallet } from "@src/context/WalletProvider";
import { useCloseDeploymentConfirm } from "@src/hooks/useCloseDeploymentConfirm";
import { useResolvedDeploymentName } from "@src/hooks/useResolvedDeploymentName/useResolvedDeploymentName";
import type { DeploymentDto } from "@src/types/deployment";
import { TransactionMessageData } from "@src/utils/TransactionMessageData";

export const DEPENDENCIES = { useServices, useWallet, useCloseDeploymentConfirm, useResolvedDeploymentName };

export interface DeploymentDangerZoneProps {
  deployment: DeploymentDto;
  onClosed: () => void;
  dependencies?: typeof DEPENDENCIES;
}

export const DeploymentDangerZone: FC<DeploymentDangerZoneProps> = ({ deployment, onClosed, dependencies: d = DEPENDENCIES }) => {
  const { analyticsService } = d.useServices();
  const { address, signAndBroadcastTx } = d.useWallet();
  const { confirmCloseDeployment, recordCloseReason } = d.useCloseDeploymentConfirm();
  const name = d.useResolvedDeploymentName(deployment.dseq);
  const [isClosing, setIsClosing] = useState(false);

  const confirmAndClose = async () => {
    const closeReason = await confirmCloseDeployment({ dseqs: [deployment.dseq], name });
    if (!closeReason) return;

    setIsClosing(true);
    try {
      const message = TransactionMessageData.getCloseDeploymentMsg(address, deployment.dseq);
      const response = await signAndBroadcastTx([message]);
      if (response) {
        recordCloseReason([deployment.dseq], closeReason);
        analyticsService.track("close_deployment", {
          category: "deployments",
          label: "Close deployment in deployment detail",
          reason: closeReason.closeReason
        });
        onClosed();
      }
    } finally {
      setIsClosing(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-destructive/50 bg-card p-6">
      <div className="space-y-1">
        <h3 className="font-semibold">Close this deployment</h3>
        <p className="text-sm text-muted-foreground">Stop all services and permanently tear down this deployment. This action can&apos;t be undone.</p>
      </div>
      <Button variant="destructive" size="md" onClick={confirmAndClose} disabled={isClosing} aria-label="Close deployment">
        {isClosing ? <Spinner size="small" /> : "Close deployment"}
      </Button>
    </div>
  );
};
