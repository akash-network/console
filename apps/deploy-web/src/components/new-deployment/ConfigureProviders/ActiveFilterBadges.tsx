"use client";
import type { FC } from "react";
import { cn } from "@akashnetwork/ui/utils";
import { Xmark } from "iconoir-react";

import type { ActiveFilter } from "@src/hooks/useActiveFilters";

type Props = {
  filters: ActiveFilter[];
  onDismiss: (key: string) => void;
  onClearAll: () => void;
};

export const ActiveFilterBadges: FC<Props> = ({ filters, onDismiss, onClearAll }) => {
  if (filters.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2">
      {filters.map(filter => (
        <button
          key={filter.key}
          type="button"
          onClick={() => onDismiss(filter.key)}
          className={cn(
            "flex items-center gap-1 rounded-lg border border-primary bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary transition-colors",
            "hover:bg-primary/20"
          )}
        >
          {filter.label}
          <Xmark className="h-3 w-3" />
        </button>
      ))}
      {filters.length >= 2 && (
        <button type="button" onClick={onClearAll} className="text-xs text-muted-foreground hover:text-foreground">
          Clear all
        </button>
      )}
    </div>
  );
};
