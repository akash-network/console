"use client";
import type { FC } from "react";
import { useState } from "react";
import { Button, Spinner } from "@akashnetwork/ui/components";

import { useServices } from "@src/context/ServicesProvider";
import { useWallet } from "@src/context/WalletProvider";
import { useManagedDeploymentConfirm } from "@src/hooks/useManagedDeploymentConfirm";
import type { DeploymentDto } from "@src/types/deployment";
import { TransactionMessageData } from "@src/utils/TransactionMessageData";

export const DEPENDENCIES = { useServices, useWallet, useManagedDeploymentConfirm };

export interface DeploymentDangerZoneProps {
  deployment: DeploymentDto;
  onClosed: () => void;
  dependencies?: typeof DEPENDENCIES;
}

export const DeploymentDangerZone: FC<DeploymentDangerZoneProps> = ({ deployment, onClosed, dependencies: d = DEPENDENCIES }) => {
  const { analyticsService } = d.useServices();
  const { address, signAndBroadcastTx } = d.useWallet();
  const { closeDeploymentConfirm } = d.useManagedDeploymentConfirm();
  const [isClosing, setIsClosing] = useState(false);

  const confirmAndClose = async () => {
    const isConfirmed = await closeDeploymentConfirm([deployment.dseq]);
    if (!isConfirmed) return;

    setIsClosing(true);
    try {
      const message = TransactionMessageData.getCloseDeploymentMsg(address, deployment.dseq);
      const response = await signAndBroadcastTx([message]);
      if (response) {
        analyticsService.track("close_deployment", { category: "deployments", label: "Close deployment in deployment detail" });
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
      <Button variant="destructive" onClick={confirmAndClose} disabled={isClosing} aria-label="Close deployment">
        {isClosing ? <Spinner size="small" /> : "Close deployment"}
      </Button>
    </div>
  );
};
