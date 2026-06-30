import type { FC } from "react";
import { Badge } from "@akashnetwork/ui/components";

export type PlacementSelectionState = "idle" | "awaiting" | "selecting" | "done";

/** Per-placement selection marker shown while picking providers: muted WAITING until its bids arrive, dark SELECTING for the active one with bids, green DONE once a provider is chosen. Sits at the right edge of the placement header; the green status check is rendered separately to its left. */
export const PlacementSelectionBadge: FC<{ state: PlacementSelectionState }> = ({ state }) => {
  if (state === "done") {
    return (
      <Badge className="shrink-0 rounded-md bg-green-600 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-white hover:bg-green-600">DONE</Badge>
    );
  }
  if (state === "selecting") {
    return (
      <Badge className="shrink-0 rounded-md bg-foreground px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-background hover:bg-foreground">
        SELECTING
      </Badge>
    );
  }
  if (state === "awaiting") {
    return (
      <Badge className="shrink-0 rounded-md bg-muted px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:bg-muted">
        WAITING
      </Badge>
    );
  }
  return null;
};
