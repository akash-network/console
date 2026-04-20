"use client";
import type { FC } from "react";
import { Button } from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";

type Props = {
  pendingChanges: number;
  matchCount: number | null;
  isLoading: boolean;
  onRevert: () => void;
  onApply: () => void;
};

export const FilterActionBar: FC<Props> = ({ pendingChanges, matchCount, isLoading, onRevert, onApply }) => {
  const hasPending = pendingChanges > 0;
  const applyLabel = isLoading ? "Applying..." : `Apply filter${matchCount != null ? ` · ${matchCount}` : ""}`;

  return (
    <div className="flex shrink-0 items-center justify-between border-t border-border bg-popover px-4 py-3">
      <span className={cn("text-sm font-medium", hasPending ? "text-primary" : "text-muted-foreground")}>
        {pendingChanges} pending change{pendingChanges !== 1 ? "s" : ""}
      </span>
      <div className="flex items-center gap-3">
        <Button variant="text" size="sm" onClick={onRevert} disabled={!hasPending}>
          Revert all
        </Button>
        <Button variant={hasPending ? "default" : "outline"} size="sm" onClick={onApply} disabled={!hasPending && !isLoading}>
          {applyLabel}
        </Button>
      </div>
    </div>
  );
};
