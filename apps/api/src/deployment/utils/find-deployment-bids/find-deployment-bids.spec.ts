import type { Bid, QueryBidResponse, QueryBidsResponse } from "@akashnetwork/chain-sdk/private-types/akash.v1beta5";
import { describe, expect, it } from "vitest";
import { mock, mockDeep } from "vitest-mock-extended";

import type { ChainSDK } from "@src/chain/providers/chain-sdk.provider";
import { findDeploymentBids } from "./find-deployment-bids";

describe(findDeploymentBids.name, () => {
  it("reads every bid of the deployment, in any state", async () => {
    const first = aBid();
    const { chainSdk } = setup({ pages: [{ bids: [{ bid: first, escrowAccount: undefined }] }] });

    expect(await findDeploymentBids(chainSdk, "akash1owner", "123")).toEqual([first]);
    expect(chainSdk.akash.market.v1beta5.getBids).toHaveBeenCalledWith({
      filters: { owner: "akash1owner", dseq: "123" },
      pagination: { key: undefined, limit: 1000n }
    });
  });

  it("follows the pages until the chain gives no next key", async () => {
    const [first, second] = [aBid(), aBid()];
    const nextKey = new Uint8Array([1, 2, 3]);
    const { chainSdk } = setup({
      pages: [{ bids: [{ bid: first, escrowAccount: undefined }], nextKey }, { bids: [{ bid: second, escrowAccount: undefined }] }]
    });

    expect(await findDeploymentBids(chainSdk, "akash1owner", "123")).toEqual([first, second]);
    expect(chainSdk.akash.market.v1beta5.getBids).toHaveBeenNthCalledWith(2, expect.objectContaining({ pagination: { key: nextKey, limit: 1000n } }));
  });

  it("stops when the chain answers without pagination", async () => {
    const { chainSdk } = setup({ pages: [] });
    chainSdk.akash.market.v1beta5.getBids.mockResolvedValue({ bids: [], pagination: undefined });

    expect(await findDeploymentBids(chainSdk, "akash1owner", "123")).toEqual([]);
    expect(chainSdk.akash.market.v1beta5.getBids).toHaveBeenCalledTimes(1);
  });

  it("skips an entry without a bid", async () => {
    const { chainSdk } = setup({ pages: [{ bids: [{ bid: undefined, escrowAccount: undefined }] }] });

    expect(await findDeploymentBids(chainSdk, "akash1owner", "123")).toEqual([]);
  });

  function aBid(): Bid {
    return mock<Bid>({ id: { owner: "akash1owner", dseq: 123n, gseq: 1, oseq: 1, provider: "akash1provider", bseq: 0 } });
  }

  function setup(input: { pages: Array<{ bids: QueryBidResponse[]; nextKey?: Uint8Array }> }) {
    const chainSdk = mockDeep<ChainSDK>();
    for (const page of input.pages) {
      const response: QueryBidsResponse = { bids: page.bids, pagination: { nextKey: page.nextKey ?? new Uint8Array(), total: 0n } };
      chainSdk.akash.market.v1beta5.getBids.mockResolvedValueOnce(response);
    }

    return { chainSdk };
  }
});
