import type { FC } from "react";
import { useEffect, useId, useRef } from "react";
import { Button } from "@akashnetwork/ui/components";
import { MessageSquareIcon, TriangleAlertIcon } from "lucide-react";

import { useServices } from "@src/context/ServicesProvider";
import { describeNotBiddingProviders } from "@src/utils/providerUtils";

export const DEPENDENCIES = {
  useServices
};

type Props = {
  notBiddingCount: number;
  providerCount: number;
  onRequestCompute: () => void;
  dependencies?: typeof DEPENDENCIES;
};

export const NotBiddingNotice: FC<Props> = ({ notBiddingCount, providerCount, onRequestCompute, dependencies: d = DEPENDENCIES }) => {
  const titleId = useId();
  const { analyticsService } = d.useServices();
  const bidsUnlikely = notBiddingCount >= providerCount;
  const trackedBidsUnlikelyRef = useRef<boolean | null>(null);

  useEffect(
    function trackWarningShown() {
      if (trackedBidsUnlikelyRef.current === bidsUnlikely) return;
      trackedBidsUnlikelyRef.current = bidsUnlikely;
      analyticsService.track("configure_not_bidding_warning_shown", {
        category: "deployments",
        bidsUnlikely,
        notBiddingProviderCount: notBiddingCount,
        screenedProviderCount: providerCount
      });
    },
    [bidsUnlikely, notBiddingCount, providerCount, analyticsService]
  );

  if (!bidsUnlikely) {
    return (
      <p role="status" className="flex items-start gap-2 rounded-md border border-warning/50 bg-warning/10 px-3 py-2 text-sm text-muted-foreground">
        <TriangleAlertIcon className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
        {describeNotBiddingProviders(notBiddingCount, providerCount)}.
      </p>
    );
  }

  return (
    <section aria-labelledby={titleId} className="flex items-start gap-2 rounded-md border border-warning/50 bg-warning/10 px-3 py-2">
      <TriangleAlertIcon className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
      <div className="space-y-2">
        <h3 id={titleId} className="text-sm font-semibold">
          Bids are unlikely
        </h3>
        <p className="text-sm text-muted-foreground">
          {describeNotBiddingProviders(notBiddingCount, providerCount)}. You can still request bids, or tell us what you need.
        </p>
        <Button type="button" variant="outline" size="sm" onClick={onRequestCompute} className="gap-2 bg-background">
          <MessageSquareIcon className="h-4 w-4" aria-hidden="true" />
          Request compute
        </Button>
      </div>
    </section>
  );
};
