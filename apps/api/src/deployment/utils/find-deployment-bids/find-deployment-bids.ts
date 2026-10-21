import type { Bid } from "@akashnetwork/chain-sdk/private-types/akash.v1beta5";

import type { ChainSDK } from "@src/chain/providers/chain-sdk.provider";

const BIDS_PAGE_SIZE = 1000n;

/** Every bid on the deployment in any state, so bids closed by a lease or by the deployment closing still count. */
export async function findDeploymentBids(chainSdk: ChainSDK, owner: string, dseq: string): Promise<Bid[]> {
  const bids: Bid[] = [];
  let key: Uint8Array | undefined;

  do {
    const response = await chainSdk.akash.market.v1beta5.getBids({ filters: { owner, dseq }, pagination: { key, limit: BIDS_PAGE_SIZE } });
    bids.push(...response.bids.flatMap(({ bid }) => (bid ? [bid] : [])));
    key = response.pagination?.nextKey.length ? response.pagination.nextKey : undefined;
  } while (key);

  return bids;
}
