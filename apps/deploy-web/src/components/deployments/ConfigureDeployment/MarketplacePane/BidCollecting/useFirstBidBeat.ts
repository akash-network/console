import { useEffect, useState } from "react";

import type { PlacementOffer } from "@src/queries/usePlacementOffers";

export const FIRST_BID_BEAT_MS = 900;

interface Input {
  isWaiting: boolean;
  placementId: string;
  offers: PlacementOffer[];
}

export function useFirstBidBeat({ isWaiting, placementId, offers }: Input): PlacementOffer | null {
  const [waitingPlacementId, setWaitingPlacementId] = useState(isWaiting ? placementId : null);
  const [beat, setBeat] = useState<{ placementId: string; bidder: PlacementOffer } | null>(null);

  if (isWaiting && waitingPlacementId !== placementId) setWaitingPlacementId(placementId);
  if (!isWaiting && waitingPlacementId !== null) {
    setWaitingPlacementId(null);
    const bidder = waitingPlacementId === placementId ? offers.find(offer => offer.offerState === "submitted") : undefined;
    if (bidder) setBeat({ placementId, bidder });
  }

  useEffect(
    function endBeat() {
      if (!beat) return;
      const timer = setTimeout(() => setBeat(null), FIRST_BID_BEAT_MS);
      return function cancelBeatEnd() {
        clearTimeout(timer);
      };
    },
    [beat]
  );

  return beat?.placementId === placementId ? beat.bidder : null;
}
