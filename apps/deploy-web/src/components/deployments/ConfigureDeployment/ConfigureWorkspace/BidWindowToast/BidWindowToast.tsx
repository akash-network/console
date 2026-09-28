import type { FC } from "react";
import { useState } from "react";
import { cn } from "@akashnetwork/ui/utils";
import { CircleAlertIcon, CircleCheckIcon, LoaderCircleIcon, XIcon } from "lucide-react";

import { usePlacementsWithBids } from "@src/queries/usePlacementsWithBids";
import type { PlacementType } from "@src/types";
import type { DeploymentFlowPhase } from "../../useDeploymentFlow/useDeploymentFlow";
import { formatCountdown } from "../../useQuoteExpiry/formatCountdown";
import type { QuoteExpiry } from "../../useQuoteExpiry/useQuoteExpiry";
import type { BidWindowState } from "./bidWindowState";
import { bidWindowState, hasBidsForEveryPlacement } from "./bidWindowState";

export const DEPENDENCIES = { usePlacementsWithBids };

const BID_WINDOW_HINT = "Bids stay open for about 5 minutes, so pick your providers before they expire.";

type Props = {
  phase: DeploymentFlowPhase;
  dseq: string | null;
  sdl: string;
  placements: PlacementType[];
  expiry: QuoteExpiry | null;
  dependencies?: typeof DEPENDENCIES;
};

/** The countdown stays out of the status region, which would otherwise announce every second. */
export const BidWindowToast: FC<Props> = ({ phase, dseq, sdl, placements, expiry, dependencies: d = DEPENDENCIES }) => {
  const placementsWithBids = d.usePlacementsWithBids({ enabled: phase === "quoting", dseq, sdl, placements });
  const [collectedDseq, setCollectedDseq] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState<{ dseq: string | null; kind: BidWindowState["kind"] } | null>(null);

  if (dseq && collectedDseq !== dseq && hasBidsForEveryPlacement({ placements, placementsWithBids })) {
    setCollectedDseq(dseq);
  }

  const state = bidWindowState({
    phase,
    placements,
    placementsWithBids,
    hasCollectedEveryPlacement: !!dseq && collectedDseq === dseq,
    isExpired: !!expiry?.isExpired
  });

  if (state.kind === "hidden" || (dismissed?.dseq === dseq && dismissed.kind === state.kind)) return null;

  const copy = copyOf(state);
  const secondsLeft = state.kind !== "expired" && expiry ? expiry.secondsLeft : null;

  return (
    <div className="fixed left-1/2 top-[calc(var(--app-header-height,57px)_+_1rem)] z-30 w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 rounded-lg border border-zinc-300 bg-popover p-4 shadow-lg dark:border-zinc-700">
      <div className="flex items-start gap-3">
        <StateIcon kind={state.kind} />
        <div role="status" className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{copy.title}</p>
          <p className="text-sm text-muted-foreground">{copy.subtitle}</p>
        </div>
        {secondsLeft !== null && (
          <span aria-hidden="true" className={cn("font-mono text-sm tabular-nums", secondsLeft < 60 ? "text-destructive" : "text-muted-foreground")}>
            {formatCountdown(secondsLeft)}
          </span>
        )}
        <button
          type="button"
          aria-label="Dismiss"
          onClick={() => setDismissed({ dseq, kind: state.kind })}
          className="shrink-0 rounded text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <XIcon className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};

function copyOf(state: Exclude<BidWindowState, { kind: "hidden" }>): { title: string; subtitle: string } {
  if (state.kind === "expired") return { title: "Bids expired", subtitle: "Close and edit to request new ones." };
  if (state.kind === "collected") return { title: "Bids collected", subtitle: BID_WINDOW_HINT };
  if (state.waitingOn.length > 0) return { title: "Collecting bids…", subtitle: `Waiting on ${state.waitingOn.join(", ")}.` };
  return { title: "Collecting bids…", subtitle: BID_WINDOW_HINT };
}

function StateIcon({ kind }: { kind: Exclude<BidWindowState["kind"], "hidden"> }) {
  if (kind === "expired") return <CircleAlertIcon className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden="true" />;
  if (kind === "collected") return <CircleCheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-green-600" aria-hidden="true" />;
  return <LoaderCircleIcon className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-muted-foreground" aria-hidden="true" />;
}
