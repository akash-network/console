"use client";
import { useMemo } from "react";
import { Alert, AlertDescription, AlertTitle, Button } from "@akashnetwork/ui/components";
import { WarningTriangle } from "iconoir-react";

import { useLocalNotes } from "@src/components/LocalNoteManager";
import { useRedeploy } from "@src/hooks/useRedeploy/useRedeploy";
import type { LeaseDto } from "@src/types/deployment";
import { getLeaseCloseReasonLabel, getReclamationDeadline, isReclaiming } from "@src/utils/reclamationUtils";
import { useCountdown } from "./useCountdown";

export const DEPENDENCIES = { useLocalNotes, useRedeploy };

type Props = {
  leases: LeaseDto[] | undefined | null;
  dseq: string;
  dependencies?: typeof DEPENDENCIES;
};

/**
 * Top-of-detail urgency banner shown while at least one lease is being reclaimed by its provider.
 * Reclamation is terminal — it can't be cancelled — so the call to action is to redeploy elsewhere
 * before the grace-period deadline. The terminal (already-closed) case is handled by ReclamationCard.
 */
export const ReclamationBanner: React.FunctionComponent<Props> = ({ leases, dseq, dependencies = DEPENDENCIES }) => {
  const { getDeploymentData } = dependencies.useLocalNotes();
  const redeploy = dependencies.useRedeploy();
  const deploymentData = getDeploymentData(dseq);
  const reclaimingLeases = useMemo(() => (leases ?? []).filter(isReclaiming), [leases]);

  const nearestDeadline = useMemo(() => {
    const deadlines = reclaimingLeases.map(getReclamationDeadline).filter((d): d is Date => d !== null);
    if (deadlines.length === 0) return null;
    return deadlines.reduce((earliest, current) => (current < earliest ? current : earliest));
  }, [reclaimingLeases]);

  const countdown = useCountdown(nearestDeadline);
  const reasonLabel = getLeaseCloseReasonLabel(reclaimingLeases[0]?.reclamation?.reason ?? reclaimingLeases[0]?.reason);

  if (reclaimingLeases.length === 0) return null;

  return (
    <Alert variant="warning" className="mt-4">
      <WarningTriangle className="h-4 w-4" />
      <AlertTitle>This deployment is being reclaimed</AlertTitle>
      <AlertDescription>
        <p>
          The provider has started reclaiming {reclaimingLeases.length > 1 ? `${reclaimingLeases.length} of your leases` : "this lease"}.{" "}
          <span aria-label="reclamation deadline">
            {nearestDeadline === null ? "Reclamation pending." : countdown === null ? "Closing now…" : `Your workload stays online but closes in ${countdown}.`}
          </span>
        </p>
        <p className="mt-1 text-xs text-muted-foreground">Reason: {reasonLabel}</p>
        <p className="mt-2">Reclamation can&apos;t be cancelled. Redeploy to another provider before the deadline to avoid downtime.</p>
        <Button variant="default" size="sm" className="mt-3" onClick={() => redeploy({ sdl: deploymentData?.manifest, name: deploymentData?.name })}>
          Redeploy
        </Button>
      </AlertDescription>
    </Alert>
  );
};
