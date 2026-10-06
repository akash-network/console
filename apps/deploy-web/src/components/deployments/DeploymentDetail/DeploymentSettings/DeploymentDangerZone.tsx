"use client";
import type { FC } from "react";
import { useState } from "react";
import { extractApiErrorMessage } from "@akashnetwork/openapi-sdk";
import { Button, Snackbar, Spinner } from "@akashnetwork/ui/components";
import { useQueryClient } from "@tanstack/react-query";
import { useSnackbar } from "notistack";

import { useServices } from "@src/context/ServicesProvider";
import { useWallet } from "@src/context/WalletProvider";
import { useCloseDeploymentConfirm } from "@src/hooks/useCloseDeploymentConfirm";
import { useClosingDeployments } from "@src/hooks/useClosingDeployments/useClosingDeployments";
import { useFlag } from "@src/hooks/useFlag";
import { useResolvedDeploymentName } from "@src/hooks/useResolvedDeploymentName/useResolvedDeploymentName";
import type { DeploymentDto } from "@src/types/deployment";
import { TransactionMessageData } from "@src/utils/TransactionMessageData";

export const DEPENDENCIES = {
  useServices,
  useWallet,
  useCloseDeploymentConfirm,
  useResolvedDeploymentName,
  useFlag,
  useClosingDeployments,
  useSnackbar,
  useQueryClient
};

export interface DeploymentDangerZoneProps {
  deployment: DeploymentDto;
  onClosed: () => void;
  dependencies?: typeof DEPENDENCIES;
}

export const DeploymentDangerZone: FC<DeploymentDangerZoneProps> = ({ deployment, onClosed, dependencies: d = DEPENDENCIES }) => {
  const { analyticsService, api } = d.useServices();
  const { address, signAndBroadcastTx } = d.useWallet();
  const { confirmCloseDeployment, recordCloseReason } = d.useCloseDeploymentConfirm();
  const name = d.useResolvedDeploymentName(deployment.dseq);
  const isClosingInBackgroundEnabled = d.useFlag("notifications_activity_center");
  const isClosingInBackground = d.useClosingDeployments().has(deployment.dseq);
  const closeDeployment = api.v1.closeDeployment.useMutation();
  const queryClient = d.useQueryClient();
  const { enqueueSnackbar } = d.useSnackbar();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const closeWithWallet = async () => {
    const message = TransactionMessageData.getCloseDeploymentMsg(address, deployment.dseq);
    const response = await signAndBroadcastTx([message]);
    if (response) onClosed();
    return !!response;
  };

  const closeInBackground = async () => {
    try {
      const { data } = await closeDeployment.mutateAsync({ dseq: deployment.dseq, async: "true" });
      await queryClient.invalidateQueries({ queryKey: api.v1.listActivities.getKey() });
      if (!("activityId" in data)) onClosed();
      return true;
    } catch (error) {
      enqueueSnackbar(
        <Snackbar title="Couldn't close this deployment" subTitle={extractApiErrorMessage(error) ?? "Try again in a moment."} iconVariant="error" />,
        { variant: "error" }
      );
      return false;
    }
  };

  const confirmAndClose = async () => {
    const closeReason = await confirmCloseDeployment({ dseqs: [deployment.dseq], name });
    if (!closeReason) return;

    setIsSubmitting(true);
    try {
      const isClosed = isClosingInBackgroundEnabled ? await closeInBackground() : await closeWithWallet();
      if (isClosed) {
        recordCloseReason([deployment.dseq], closeReason);
        analyticsService.track("close_deployment", {
          category: "deployments",
          label: "Close deployment in deployment detail",
          reason: closeReason.closeReason
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-destructive/50 bg-card p-6">
      <div className="space-y-1">
        <h3 className="font-semibold">Close this deployment</h3>
        <p className="text-sm text-muted-foreground">
          {isClosingInBackground
            ? "This deployment is closing. You'll get a notification when it's done."
            : "Stop all services and permanently tear down this deployment. This action can't be undone."}
        </p>
      </div>
      <Button variant="destructive" size="md" onClick={confirmAndClose} disabled={isSubmitting || isClosingInBackground} aria-label="Close deployment">
        {isSubmitting ? <Spinner size="small" /> : isClosingInBackground ? "Closing…" : "Close deployment"}
      </Button>
    </div>
  );
};
