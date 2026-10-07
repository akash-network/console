"use client";
import type { FC } from "react";
import { useState } from "react";
import { Button, Spinner } from "@akashnetwork/ui/components";
import { Ban } from "lucide-react";

import { useServices } from "@src/context/ServicesProvider";
import { useCloseDeployment } from "@src/hooks/useCloseDeployment/useCloseDeployment";
import { useCloseDeploymentConfirm } from "@src/hooks/useCloseDeploymentConfirm";
import { useClosingDeployments } from "@src/hooks/useClosingDeployments/useClosingDeployments";
import { useResolvedDeploymentName } from "@src/hooks/useResolvedDeploymentName/useResolvedDeploymentName";
import type { DeploymentDto } from "@src/types/deployment";

export const DEPENDENCIES = {
  useServices,
  useCloseDeploymentConfirm,
  useResolvedDeploymentName,
  useClosingDeployments,
  useCloseDeployment
};

export interface DeploymentDangerZoneProps {
  deployment: DeploymentDto;
  onClosed: () => void;
  dependencies?: typeof DEPENDENCIES;
}

export const DeploymentDangerZone: FC<DeploymentDangerZoneProps> = ({ deployment, onClosed, dependencies: d = DEPENDENCIES }) => {
  const { analyticsService } = d.useServices();
  const { confirmCloseDeployment, recordCloseReason } = d.useCloseDeploymentConfirm();
  const name = d.useResolvedDeploymentName(deployment.dseq);
  const isClosingInBackground = d.useClosingDeployments().has(deployment.dseq);
  const closeDeployment = d.useCloseDeployment();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const confirmAndClose = async () => {
    const closeReason = await confirmCloseDeployment({ dseqs: [deployment.dseq], name });
    if (!closeReason) return;

    setIsSubmitting(true);
    try {
      const outcome = await closeDeployment(deployment.dseq);
      if (outcome === "not_closed") return;

      if (outcome === "closed") onClosed();
      recordCloseReason([deployment.dseq], closeReason);
      analyticsService.track("close_deployment", {
        category: "deployments",
        label: "Close deployment in deployment detail",
        reason: closeReason.closeReason
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-x-5 gap-y-3 rounded-xl border border-destructive/35 bg-card px-5 py-4 sm:px-[22px]">
      <div className="min-w-0 flex-1 basis-60 space-y-1">
        <h3 className="text-sm font-semibold">Close this deployment</h3>
        <p className="text-[13px] leading-normal text-muted-foreground">
          {isClosingInBackground
            ? "This deployment is closing. You'll get a notification when it's done."
            : "Stop all services and permanently tear down this deployment. This action can't be undone."}
        </p>
      </div>
      <Button
        variant="destructive"
        size="md"
        className="gap-1.5"
        onClick={confirmAndClose}
        disabled={isSubmitting || isClosingInBackground}
        aria-label="Close deployment"
      >
        {isSubmitting ? (
          <Spinner size="small" />
        ) : isClosingInBackground ? (
          "Closing…"
        ) : (
          <>
            <Ban className="h-4 w-4" aria-hidden />
            Close deployment
          </>
        )}
      </Button>
    </div>
  );
};
