import { describe, expect, it } from "vitest";

import { BidResponseSchema } from "./bid.schema";

import { createBid } from "@test/seeders/bid.seeder";

describe("BidResponseSchema", () => {
  it("keeps the reclamation_window when the provider offers one", () => {
    const bid = createBid();
    bid.bid.reclamation_window = "86400s";

    const result = BidResponseSchema.parse(bid);

    expect(result.bid.reclamation_window).toBe("86400s");
  });

  it("parses a bid without a reclamation_window", () => {
    const bid = createBid();

    const result = BidResponseSchema.parse(bid);

    expect(result.bid.reclamation_window).toBeUndefined();
  });
});
