"use client";
import { useEffect, useMemo, useState } from "react";
import { Alert, AlertDescription, AlertTitle, buttonVariants } from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";
import formatDuration from "date-fns/formatDuration";
import intervalToDuration from "date-fns/intervalToDuration";
import { WarningTriangle } from "iconoir-react";
import Link from "next/link";

import type { LeaseDto } from "@src/types/deployment";
import { getLeaseCloseReasonLabel, getReclamationDeadline, isReclaiming } from "@src/utils/reclamationUtils";
import { UrlService } from "@src/utils/urlUtils";

type Props = {
  leases: LeaseDto[] | undefined | null;
  dseq: string;
};

/**
 * Top-of-detail urgency banner shown while at least one lease is being reclaimed by its provider.
 * Reclamation is terminal — it can't be cancelled — so the call to action is to redeploy elsewhere
 * before the grace-period deadline. The terminal (already-closed) case is handled by ReclamationCard.
 */
export const ReclamationBanner: React.FunctionComponent<Props> = ({ leases, dseq }) => {
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
        <Link href={UrlService.newDeployment({ redeploy: dseq })} className={cn(buttonVariants({ variant: "default", size: "sm" }), "mt-3")}>
          Redeploy
        </Link>
      </AlertDescription>
    </Alert>
  );
};

/** Live, second-by-second remaining time to a deadline. Returns null when no deadline or already passed. */
function useCountdown(deadline: Date | null): string | null {
  const [now, setNow] = useState(() => new Date());
  const deadlineTime = deadline?.getTime();

  useEffect(() => {
    if (deadlineTime === undefined) return;
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, [deadlineTime]);

  if (deadlineTime === undefined || now.getTime() >= deadlineTime) return null;

  const duration = intervalToDuration({ start: now, end: new Date(deadlineTime) });
  return formatDuration(duration, { format: ["days", "hours", "minutes", "seconds"], delimiter: ", " });
}
