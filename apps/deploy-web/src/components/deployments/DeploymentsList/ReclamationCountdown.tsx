"use client";
import type { FC } from "react";
import { useMemo } from "react";
import formatDistanceToNowStrict from "date-fns/formatDistanceToNowStrict";

import type { LeaseDto } from "@src/types/deployment";
import { getNearestReclamationDeadline, isReclaiming } from "@src/utils/reclamationUtils";
import { useCountdown } from "../ReclamationBanner/useCountdown";

export interface ReclamationCountdownProps {
  leases: LeaseDto[] | null | undefined;
}

/** How long a reclaimed workload has left, alongside the "Reclaiming" status the badge already reports. */
export const ReclamationCountdown: FC<ReclamationCountdownProps> = ({ leases }) => {
  const deadline = useMemo(() => getNearestReclamationDeadline(leases), [leases]);
  const timeLeft = useCountdown(deadline);

  if (!leases?.some(isReclaiming)) return null;

  return (
    <span className="whitespace-nowrap text-xs text-warning">
      {deadline === null ? "reclamation pending" : timeLeft === null ? "closing now…" : `reclaims in ${formatDistanceToNowStrict(deadline)}`}
    </span>
  );
};
