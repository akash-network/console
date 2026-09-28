import type { FC } from "react";
import { cn } from "@akashnetwork/ui/utils";
import { CheckIcon } from "lucide-react";

import type { PlacementType } from "@src/types";
import { useReviewRows } from "../../ReviewAndDeployModal/useReviewRows";

export const DEPENDENCIES = { useReviewRows };

type Props = {
  dseq: string | null;
  placements: PlacementType[];
  selections: Record<string, string>;
  activePlacementId: string;
  onSelectPlacement: (placementId: string) => void;
  dependencies?: typeof DEPENDENCIES;
};

export const PlacementProviderChips: FC<Props> = ({ dseq, placements, selections, activePlacementId, onSelectPlacement, dependencies: d = DEPENDENCIES }) => {
  const { rows } = d.useReviewRows({ dseq, placements, selections });
  const providerNameByPlacement = new Map(rows.map(row => [row.placementId, row.providerName]));

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-zinc-300 px-4 py-3 dark:border-zinc-700">
      <span className="font-mono text-xs uppercase text-muted-foreground">Selecting provider for</span>
      <ul aria-label="Placements" className="flex flex-wrap gap-2">
        {placements.map(placement => {
          const providerName = providerNameByPlacement.get(placement.id);
          const isActive = placement.id === activePlacementId;
          return (
            <li key={placement.id}>
              <button
                type="button"
                aria-pressed={isActive}
                onClick={() => onSelectPlacement(placement.id)}
                className={cn(
                  "flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  isActive ? "border-foreground bg-accent font-medium" : "border-zinc-300 hover:border-zinc-400 dark:border-zinc-700"
                )}
              >
                {providerName && <CheckIcon className="h-3.5 w-3.5 text-green-600" aria-hidden="true" />}
                {placement.name}
                {providerName && <span className="text-muted-foreground">· {providerName}</span>}
              </button>
            </li>
          );
        })}
      </ul>
      <span className="ml-auto font-mono text-xs text-muted-foreground">
        {rows.length}/{placements.length} assigned
      </span>
    </div>
  );
};
