import { describe, expect, it } from "vitest";

import type { RpcBid } from "@src/types/deployment";
import { mapToBidDto } from "./useBidQuery";

describe(mapToBidDto.name, () => {
  it("maps the reclamation_window field to reclamationWindow", () => {
    const result = mapToBidDto(buildRpcBid({ reclamation_window: "86400s" }));

    expect(result.reclamationWindow).toBe("86400s");
  });

  it("leaves reclamationWindow undefined when the bid offers no reclamation window", () => {
    const result = mapToBidDto(buildRpcBid());

    expect(result.reclamationWindow).toBeUndefined();
  });

  it("maps the core bid identity and price", () => {
    const result = mapToBidDto(buildRpcBid());

    expect(result).toMatchObject({
      owner: "akash1owner",
      provider: "akash1provider",
      dseq: "123",
      gseq: 1,
      oseq: 1,
      state: "open",
      price: { denom: "uakt", amount: "100" }
    });
  });

  function buildRpcBid(bidOverrides?: Partial<RpcBid["bid"]>): RpcBid {
    return {
      bid: {
        id: { owner: "akash1owner", dseq: "123", gseq: 1, oseq: 1, provider: "akash1provider", bseq: 1 },
        state: "open",
        price: { denom: "uakt", amount: "100" },
        resources_offer: [],
        created_at: "1700000000",
        ...bidOverrides
      },
      escrow_account: {
        id: { scope: "bid", xid: "xid" },
        state: { owner: "akash1owner", state: "open", transferred: [], settled_at: "0", funds: [], deposits: [] }
      }
    };
  }
});
