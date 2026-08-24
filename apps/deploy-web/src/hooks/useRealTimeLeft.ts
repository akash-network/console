import add from "date-fns/add";

import { useBlock } from "@src/queries/useBlocksQuery";
import { averageBlockTime, getLiveEscrowBalance } from "@src/utils/priceUtils";

export function useRealTimeLeft(pricePerBlock: number, balance: number, settledAt: number, createdAt: number) {
  const { data: latestBlock } = useBlock("latest", {
    refetchInterval: 30000
  });
  if (!latestBlock) return;

  const latestBlockHeight = Number(latestBlock.block.header.height);
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
