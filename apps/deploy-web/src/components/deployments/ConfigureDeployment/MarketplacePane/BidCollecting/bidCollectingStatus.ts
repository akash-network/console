interface StepInput {
  /** Null until the deployment exists, since no provider was asked before that. */
  msSinceQuoting: number | null;
  providerCount: number;
  regionCount: number;
  placementName: string;
}

const SENT_STEP_MS = 1500;
const PRICING_STEP_MS = 3000;
const SLOW_BIDS_MS = 8500;
const EXPECTED_FIRST_BID_MS = 3000;
const MAX_PROGRESS_BEFORE_BID = 95;

export function describeBidCollectingStep({ msSinceQuoting, providerCount, regionCount, placementName }: StepInput): string {
  if (msSinceQuoting === null) return "Posting your request to the network";
  if (msSinceQuoting < SENT_STEP_MS) {
    if (regionCount > 1) return `Sent to ${providerCount} providers across ${regionCount} regions`;
    return `Sent to ${providerCount} ${providerCount === 1 ? "provider" : "providers"} that can run ${placementName}`;
  }
  if (msSinceQuoting < PRICING_STEP_MS) return "Providers are pricing your spec";
  if (msSinceQuoting < SLOW_BIDS_MS) return "Waiting for the first bid";
  return "Still waiting. Some providers take longer to respond.";
}

/** Never fills up before a bid lands, however long the wait. */
export function expectedBidProgress(msSinceStart: number): number {
  return MAX_PROGRESS_BEFORE_BID * (1 - Math.exp(-msSinceStart / EXPECTED_FIRST_BID_MS));
}
