"use client";
import type { FC } from "react";
import { useEffect, useState } from "react";
import { Button, Input } from "@akashnetwork/ui/components";
import { EditPencil, Redo, Undo } from "iconoir-react";

type Props = {
  deploymentName: string;
  onDeploymentNameChange: (name: string) => void;
  templateDescription: string;
  matchCount: number;
  totalProviders: number;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
};

export const ConfigureProvidersHeader: FC<Props> = ({
  deploymentName,
  onDeploymentNameChange,
  templateDescription,
  matchCount,
  totalProviders,
  canUndo,
  canRedo,
  onUndo,
  onRedo
}) => {
  const matchPercent = totalProviders > 0 ? (matchCount / totalProviders) * 100 : 0;
  const [animatedWidth, setAnimatedWidth] = useState(matchPercent);

  useEffect(() => {
    const timer = setTimeout(() => setAnimatedWidth(matchPercent), 50);
    return () => clearTimeout(timer);
  }, [matchPercent]);

  return (
    <div className="flex items-center gap-4 border-b border-border bg-popover px-4 py-3">
      <div className="flex items-center gap-3">
        <label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Deployment name</label>
        <Input
          value={deploymentName}
          onChange={e => onDeploymentNameChange(e.target.value)}
          className="w-40"
          inputClassName="h-7 py-1 text-xs"
          placeholder="hello-world"
        />

        {templateDescription && (
          <>
            <div className="h-4 w-px bg-border" />
            <div className="flex h-7 items-center gap-2 rounded-lg border border-border bg-card px-2.5">
              <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Template</span>
              <span className="text-muted-foreground/30">·</span>
              <span className="font-mono text-xs text-muted-foreground">{templateDescription}</span>
              <button type="button" className="ml-1 text-muted-foreground transition-colors hover:text-foreground">
                <EditPencil className="h-3 w-3" />
              </button>
            </div>
          </>
        )}
      </div>

      <div className="flex-1" />

      <div className="flex h-7 items-center gap-3 rounded-lg border border-border bg-card px-2.5">
        <div className="flex items-baseline gap-1">
          <span className="font-mono text-sm font-semibold text-foreground">{matchCount}</span>
          <span className="text-[11px] text-muted-foreground">of {totalProviders} providers match</span>
        </div>
        <div className="h-1 w-20 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary transition-all duration-300 ease-out" style={{ width: `${animatedWidth}%` }} />
        </div>
      </div>

      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" onClick={onUndo} disabled={!canUndo} title="Undo" className="h-7 w-7">
          <Undo className="h-3.5 w-3.5" />
        </Button>
        <Button variant="ghost" size="icon" onClick={onRedo} disabled={!canRedo} title="Redo" className="h-7 w-7">
          <Redo className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
};
