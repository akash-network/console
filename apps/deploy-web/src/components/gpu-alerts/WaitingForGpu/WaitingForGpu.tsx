import type { FC } from "react";
import { Button } from "@akashnetwork/ui/components";

type Props = {
  placeInLine: number;
  waitingGpuCount: number;
  gpuCount: number;
  isPending: boolean;
  onSwitch: () => void;
  isCompact?: boolean;
};

export const WaitingForGpu: FC<Props> = ({ placeInLine, waitingGpuCount, gpuCount, isPending, onSwitch, isCompact = false }) => {
  if (waitingGpuCount === gpuCount) {
    return (
      <span className={isCompact ? "shrink-0 whitespace-nowrap px-2 text-xs text-muted-foreground" : "text-sm font-medium"}>
        Waiting · #{placeInLine}
        {isCompact ? "" : " in line"}
      </span>
    );
  }

  return (
    <span className={isCompact ? "flex shrink-0 items-center gap-1 whitespace-nowrap px-2 text-xs text-muted-foreground" : "flex items-center gap-2 text-sm"}>
      Waiting for {waitingGpuCount}× ·
      <Button type="button" variant="link" size="sm" disabled={isPending} onClick={onSwitch} className="h-auto p-0 text-xs">
        Switch to {gpuCount}×
      </Button>
    </span>
  );
};
