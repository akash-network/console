"use client";
import type { FC } from "react";
import { useEffect, useState } from "react";
import { Button } from "@akashnetwork/ui/components";
import { CircleAlertIcon } from "lucide-react";

import { NO_BIDS_TIMEOUT_MS } from "@src/components/deployments/ConfigureDeployment/useDeploymentFlow/useDeploymentFlow";
import { BID_POLL_INTERVAL, useListBids } from "@src/queries/useListBids";

export const DEPENDENCIES = { useListBids };

type Props = {
  dseq: string;
  continueConversation?: (message: string) => void;
  dependencies?: typeof DEPENDENCIES;
};

export function whyNoBidsQuestionOf(dseq: string): string {
  return `Why isn't deployment ${dseq} getting any bids?`;
}

/** Watches bids only through the normal bid window, so a card left open in the transcript stops polling once it has spoken up. */
export const NoBidsYetNotice: FC<Props> = ({ dseq, continueConversation, dependencies: d = DEPENDENCIES }) => {
  const [isBidWindowOver, setIsBidWindowOver] = useState(false);
  const bids = d.useListBids(dseq, { refetchInterval: isBidWindowOver ? undefined : BID_POLL_INTERVAL });
  const hasLoadedNoBids = bids.data?.data.length === 0;

  useEffect(
    function endBidWindow() {
      const timer = setTimeout(() => setIsBidWindowOver(true), NO_BIDS_TIMEOUT_MS);
      return () => clearTimeout(timer);
    },
    [dseq]
  );

  if (!isBidWindowOver || !hasLoadedNoBids) return null;

  return (
    <div className="flex items-start gap-3 rounded-md border bg-muted/40 p-3">
      <CircleAlertIcon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <div className="flex min-w-0 flex-col gap-2">
        <div role="status" className="flex flex-col gap-1">
          <p className="text-sm font-semibold">No bids yet</p>
          <p className="text-sm text-muted-foreground">No provider has bid on deployment {dseq} in the usual bid window. A late bid still starts it.</p>
        </div>
        {continueConversation && (
          <Button type="button" variant="outline" size="sm" className="self-start" onClick={() => continueConversation(whyNoBidsQuestionOf(dseq))}>
            Why no bids?
          </Button>
        )}
      </div>
    </div>
  );
};
