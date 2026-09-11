"use client";
import type { FC } from "react";
import formatDistanceToNowStrict from "date-fns/formatDistanceToNowStrict";

import type { LeaseDto } from "@src/types/deployment";
import { getNearestReclamationDeadline, isReclaiming } from "@src/utils/reclamationUtils";

export interface ReclamationCountdownProps {
  leases: LeaseDto[] | null | undefined;
}

/** How long a reclaimed workload has left, alongside the "Reclaiming" status the badge already reports. */
export const ReclamationCountdown: FC<ReclamationCountdownProps> = ({ leases }) => {
  if (!leases?.some(isReclaiming)) return null;

  const deadline = getNearestReclamationDeadline(leases);

  return (
    <span className="whitespace-nowrap text-xs text-warning">{deadline ? `reclaims in ${formatDistanceToNowStrict(deadline)}` : "reclamation pending"}</span>
  );
};
