import add from "date-fns/add";

import { useLatestBlockHeight } from "@src/hooks/useLatestBlockHeight/useLatestBlockHeight";
import { averageBlockTime, getLiveEscrowBalance } from "@src/utils/priceUtils";

export const DEPENDENCIES = { useLatestBlockHeight };

export function useRealTimeLeft(pricePerBlock: number, balance: number, settledAt: number, createdAt: number, d: typeof DEPENDENCIES = DEPENDENCIES) {
  const latestBlockHeight = d.useLatestBlockHeight();
  if (latestBlockHeight === undefined) return;

  const blocksPassed = Math.abs(settledAt - latestBlockHeight);
  const blocksSinceCreation = Math.abs(createdAt - latestBlockHeight);

  const blocksLeft = balance / pricePerBlock - blocksPassed;
  const timestamp = new Date().getTime();

  return {
    timeLeft: add(new Date(timestamp), { seconds: blocksLeft * averageBlockTime }),
    escrow: getLiveEscrowBalance({ settledBalance: balance, pricePerBlock, settledAt, latestBlockHeight }),
    amountSpent: Math.min(blocksSinceCreation * pricePerBlock, balance)
  };
}
