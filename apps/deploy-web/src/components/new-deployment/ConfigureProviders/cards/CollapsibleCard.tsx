"use client";
import type { FC, ReactNode } from "react";
import { useState } from "react";
import { Card } from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";
import { NavArrowDown, NavArrowUp } from "iconoir-react";

type Props = {
  icon: ReactNode;
  title: string;
  summary: string;
  defaultExpanded?: boolean;
  expanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
  hasChanges?: boolean;
  onReset?: () => void;
  children: ReactNode;
};

export const CollapsibleCard: FC<Props> = ({
  icon,
  title,
  summary,
  defaultExpanded = false,
  expanded: controlledExpanded,
  onExpandedChange,
  hasChanges = false,
  onReset,
  children
}) => {
  const [internalExpanded, setInternalExpanded] = useState(defaultExpanded);
  const expanded = controlledExpanded ?? internalExpanded;

  const toggle = () => {
    const next = !expanded;
    if (controlledExpanded === undefined) setInternalExpanded(next);
    onExpandedChange?.(next);
  };

  return (
    <Card className="overflow-hidden">
      <button type="button" onClick={toggle} className={cn("flex w-full items-center gap-2 px-3 py-2.5 text-left transition-colors hover:bg-muted/40")}>
        <span className="flex h-5 w-5 shrink-0 items-center justify-center text-muted-foreground">{icon}</span>
        <span className="whitespace-nowrap text-sm font-medium text-foreground">{title}</span>
        {hasChanges && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />}
        <span className="ml-auto truncate font-mono text-xs text-muted-foreground">{summary}</span>
        {expanded ? (
          <NavArrowUp className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        ) : (
          <NavArrowDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        )}
      </button>
      {expanded && (
        <div className="px-3 pb-3 pt-1">
          {children}
          {hasChanges && onReset && (
            <button type="button" onClick={onReset} className="mt-2 text-[10px] font-medium text-destructive hover:underline">
              Reset
            </button>
          )}
        </div>
      )}
    </Card>
  );
};
