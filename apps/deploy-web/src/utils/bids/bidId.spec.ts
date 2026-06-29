import { describe, expect, it } from "vitest";

import { formatBidId, parseBidId } from "./bidId";

describe("bidId", () => {
  it("formats a bid id from its on-chain composite key", () => {
    expect(formatBidId({ provider: "akash1prov", dseq: "123", gseq: 1, oseq: 2 })).toBe("akash1prov/123/1/2");
  });

  it("parses a formatted bid id back into its composite key with numeric gseq/oseq", () => {
    expect(parseBidId("akash1prov/123/1/2")).toEqual({ provider: "akash1prov", dseq: "123", gseq: 1, oseq: 2 });
  });

  it("round-trips", () => {
    const id = { provider: "akash1xyz", dseq: "999", gseq: 3, oseq: 4 };
    expect(parseBidId(formatBidId(id))).toEqual(id);
  });
});
