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

/** How long a reclaimed workload has left, detailing the "Reclaiming" status inside the badge's tooltip. */
export const ReclamationCountdown: FC<ReclamationCountdownProps> = ({ leases }) => {
  const deadline = useMemo(() => getNearestReclamationDeadline(leases), [leases]);
  const timeLeft = useCountdown(deadline);

  if (!leases?.some(isReclaiming)) return null;

  return <p>{deadline === null ? "Reclamation pending." : timeLeft === null ? "Closing now…" : `Closes in ${formatDistanceToNowStrict(deadline)}.`}</p>;
};
