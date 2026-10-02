import type { DeploymentFlowPhase } from "../../useDeploymentFlow/useDeploymentFlow";

export type BidWindowState = { kind: "hidden" } | { kind: "collecting"; waitingOn: string[] } | { kind: "collected" } | { kind: "expired" };

export interface BidWindowInput {
  phase: DeploymentFlowPhase;
  placements: Array<{ id: string; name: string }>;
  placementsWithBids: Set<string>;
  /** Latched by the caller, because open bids drop off as they expire and would otherwise read as still collecting. */
  hasCollectedEveryPlacement: boolean;
  isExpired: boolean;
  noBidsReceived: boolean;
}

export function bidWindowState(input: BidWindowInput): BidWindowState {
  if ((input.phase !== "creating" && input.phase !== "quoting") || input.noBidsReceived) return { kind: "hidden" };
  if (input.isExpired) return { kind: "expired" };
  if (input.hasCollectedEveryPlacement || hasBidsForEveryPlacement(input)) return { kind: "collected" };

  const hasAnyBid = input.placements.some(placement => input.placementsWithBids.has(placement.id));
  const waitingOn = hasAnyBid ? input.placements.filter(placement => !input.placementsWithBids.has(placement.id)).map(placement => placement.name) : [];
  return { kind: "collecting", waitingOn };
}

export function hasBidsForEveryPlacement({ placements, placementsWithBids }: Pick<BidWindowInput, "placements" | "placementsWithBids">): boolean {
  return placements.length > 0 && placements.every(placement => placementsWithBids.has(placement.id));
}
