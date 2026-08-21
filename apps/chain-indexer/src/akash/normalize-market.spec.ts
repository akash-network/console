import { describe, expect, it } from "vitest";

import { normalizeMarketMessage } from "@src/akash/normalize-market";

describe("normalizeMarketMessage", () => {
  it("normalizes a legacy create bid from its order id and provider field with bseq 0", () => {
    const change = normalizeMarketMessage("/akash.market.v1beta2.MsgCreateBid", {
      order: { owner: "akash1owner", dseq: { low: 42, high: 0, unsigned: true }, gseq: 1, oseq: 1 },
      provider: "akash1prov",
      price: { denom: "uakt", amount: "50" }
    });

    expect(change).toEqual({
      kind: "bidCreated",
      key: { owner: "akash1owner", dseq: "42", gseq: 1, oseq: 1, bseq: 0, provider: "akash1prov" },
      price: "50",
      priceDenom: "uakt"
    });
  });

  it("normalizes a v1beta5 create bid from its full BidID with bseq and a DecCoin price", () => {
    const change = normalizeMarketMessage("/akash.market.v1beta5.MsgCreateBid", {
      id: { owner: "akash1owner", dseq: "42", gseq: 1, oseq: 1, bseq: 2, provider: "akash1prov" },
      price: { denom: "uakt", amount: "3.25" }
    });

    expect(change).toEqual({
      kind: "bidCreated",
      key: { owner: "akash1owner", dseq: "42", gseq: 1, oseq: 1, bseq: 2, provider: "akash1prov" },
      price: "3.25",
      priceDenom: "uakt"
    });
  });

  it("normalizes close bid, lease lifecycle and withdraw across id field names", () => {
    const key = { owner: "akash1owner", dseq: "42", gseq: 1, oseq: 1, bseq: 0, provider: "akash1prov" };
    const legacyId = { owner: "akash1owner", dseq: "42", gseq: 1, oseq: 1, provider: "akash1prov" };

    expect(normalizeMarketMessage("/akash.market.v1beta3.MsgCloseBid", { bidId: legacyId })).toEqual({ kind: "bidClosed", key });
    expect(normalizeMarketMessage("/akash.market.v1beta5.MsgCloseBid", { id: { ...legacyId, bseq: 1 } })).toEqual({
      kind: "bidClosed",
      key: { ...key, bseq: 1 }
    });
    expect(normalizeMarketMessage("/akash.market.v1beta4.MsgCreateLease", { bidId: legacyId })).toEqual({ kind: "leaseCreated", key });
    expect(normalizeMarketMessage("/akash.market.v1beta1.MsgCloseLease", { leaseId: legacyId })).toEqual({ kind: "leaseClosed", key });
    expect(normalizeMarketMessage("/akash.market.v1beta5.MsgCloseLease", { id: legacyId })).toEqual({ kind: "leaseClosed", key });
    expect(normalizeMarketMessage("/akash.market.v1beta2.MsgWithdrawLease", { bidId: legacyId })).toEqual({ kind: "leaseWithdrawn", key });
    expect(normalizeMarketMessage("/akash.market.v1beta5.MsgWithdrawLease", { id: legacyId })).toEqual({ kind: "leaseWithdrawn", key });
  });

  it("returns null for unknown types and incomplete ids", () => {
    expect(normalizeMarketMessage("/akash.market.v1beta5.MsgLeaseStartReclaim", { id: {} })).toBeNull();
    expect(normalizeMarketMessage("/akash.market.v1beta1.MsgCreateBid", { order: { owner: "a" }, provider: "p" })).toBeNull();
  });
});
