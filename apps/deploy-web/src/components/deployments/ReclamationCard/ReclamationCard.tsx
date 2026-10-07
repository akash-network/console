"use client";
import { useState } from "react";
import { Alert, AlertDescription, AlertTitle, Button, buttonVariants, Spinner } from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";
import { TriangleAlert } from "lucide-react";
import Link from "next/link";

import { useCloseDeployment } from "@src/hooks/useCloseDeployment/useCloseDeployment";
import { useClosingDeployments } from "@src/hooks/useClosingDeployments/useClosingDeployments";
import { isUsableDeploymentDefinition, sdlToRedeploy, useDeploymentDefinition } from "@src/hooks/useDeploymentDefinition/useDeploymentDefinition";
import { useManagedDeploymentConfirm } from "@src/hooks/useManagedDeploymentConfirm";
import { useNewDeploymentUrl } from "@src/hooks/useNewDeploymentUrl/useNewDeploymentUrl";
import { useRedeploy } from "@src/hooks/useRedeploy/useRedeploy";
import type { LeaseDto } from "@src/types/deployment";
import { getLeaseCloseReasonLabel } from "@src/utils/reclamationUtils";

export const DEPENDENCIES = {
  useCloseDeployment,
  useClosingDeployments,
  useManagedDeploymentConfirm,
  useDeploymentDefinition,
  useNewDeploymentUrl,
  useRedeploy
};

type Props = {
  lease: LeaseDto;
  dseq: string;
  onClosed?: () => void;
  dependencies?: typeof DEPENDENCIES;
};

/**
 * Per-lease card for the terminal "closed by provider" (reclaimed) case. Reclamation is terminal —
 * there is no restart — so recovery is Close (recover any escrow still locked in the active-but-dead
 * deployment) + Redeploy. The live, still-running case is handled by ReclamationBanner.
 */
export const ReclamationCard: React.FunctionComponent<Props> = ({ lease, dseq, onClosed, dependencies = DEPENDENCIES }) => {
  const { useCloseDeployment, useClosingDeployments, useManagedDeploymentConfirm, useDeploymentDefinition, useNewDeploymentUrl, useRedeploy } = dependencies;
  const closeDeployment = useCloseDeployment();
  const isClosingInBackground = useClosingDeployments().has(dseq);
  const { closeDeploymentConfirm } = useManagedDeploymentConfirm();
  const newDeploymentUrl = useNewDeploymentUrl();
  const redeploy = useRedeploy();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const reasonLabel = getLeaseCloseReasonLabel(lease.reclamation?.reason ?? lease.reason);
  const definition = useDeploymentDefinition(dseq, { acceptReferences: true });
  const canRedeploy = definition.source === "resolving" || isUsableDeploymentDefinition(definition);

  const confirmAndClose = async () => {
    const isConfirmed = await closeDeploymentConfirm([dseq]);
    if (!isConfirmed) return;

    setIsSubmitting(true);
    try {
      if ((await closeDeployment(dseq)) === "closed") onClosed?.();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Alert variant="warning" className="p-4">
      <TriangleAlert className="h-4 w-4" />
      <AlertTitle>{reasonLabel}</AlertTitle>
      <AlertDescription>
        <p>
          This deployment was stopped by the provider, so it&apos;s no longer running. Redeploy to get back online, or close it to recover any unused funds.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button variant="default" size="sm" onClick={confirmAndClose} disabled={isSubmitting || isClosingInBackground}>
            {isSubmitting ? <Spinner size="small" /> : isClosingInBackground ? "Closing…" : "Close & refund"}
          </Button>
          {canRedeploy ? (
            <Button
              variant="outline"
              size="sm"
              className="text-foreground"
              disabled={definition.source === "resolving"}
              onClick={() => redeploy({ sdl: sdlToRedeploy(definition), name: definition.name, sourceDseq: dseq })}
            >
              Redeploy
            </Button>
          ) : (
            <Link href={newDeploymentUrl()} className={cn(buttonVariants({ variant: "outline", size: "sm" }), "text-foreground")}>
              Start a new deployment
            </Link>
          )}
        </div>
      </AlertDescription>
    </Alert>
  );
};
