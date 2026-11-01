import { useEffect, useState } from "react";

import { useBlockchainStatus } from "@src/context/BlockchainStatusProvider";
import { averageBlockTime } from "@src/utils/priceUtils";

const HEIGHT_TICK_INTERVAL_MS = 30_000;

export const DEPENDENCIES = { useBlockchainStatus };

/** Extrapolates from the height the status poll last saw, so no tab polls the chain for its latest block. */
export function useLatestBlockHeight({ enabled = true }: { enabled?: boolean } = {}, d: typeof DEPENDENCIES = DEPENDENCIES): number | undefined {
  const { latestBlock } = d.useBlockchainStatus();
  const [now, setNow] = useState(Date.now);

  useEffect(
    function tickWhileEnabled() {
      if (!enabled) return;
      setNow(Date.now());
      const interval = setInterval(function advance() {
        setNow(Date.now());
      }, HEIGHT_TICK_INTERVAL_MS);
      return function stopTicking() {
        clearInterval(interval);
      };
    },
    [enabled]
  );

  if (!enabled || !latestBlock) return undefined;

  const blocksSinceObserved = Math.max(0, Math.floor((now - latestBlock.observedAt) / (averageBlockTime * 1000)));
  return latestBlock.height + blocksSinceObserved;
}
