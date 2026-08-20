"use client";
import type { FC } from "react";
import { Badge } from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";

import type { LeaseDto } from "@src/types/deployment";
import { isReclaiming } from "@src/utils/reclamationUtils";

type Props = {
  lease: Pick<LeaseDto, "state">;
  className?: string;
};

export const ReclaimingBadge: FC<Props> = ({ lease, className }) => {
  if (!isReclaiming(lease)) return null;

  return (
    <Badge variant="outline" className={cn("whitespace-nowrap border-amber-500 text-xs text-amber-600", className)}>
      Reclaiming
    </Badge>
  );
};
