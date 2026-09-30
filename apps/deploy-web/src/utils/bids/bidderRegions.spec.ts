import { describe, expect, it } from "vitest";

import { bidderAddressesToLocate, toBidderRegions } from "./bidderRegions";

describe("bidderRegions", () => {
  describe(bidderAddressesToLocate.name, () => {
    it("locates no bidder while no placement picks several regions", () => {
      const bids = [bidFrom("akash1aaa"), bidFrom("akash1bbb")];

      expect(bidderAddressesToLocate(bids, [{ regions: ["eu-west"] }, { regions: [] }, {}])).toEqual([]);
    });

    it("locates every bidder once when a placement picks several regions", () => {
      const bids = [bidFrom("akash1aaa"), bidFrom("akash1bbb"), bidFrom("akash1aaa")];

      expect(bidderAddressesToLocate(bids, [{ regions: ["eu-west"] }, { regions: ["eu-west", "na-us-west"] }])).toEqual(["akash1aaa", "akash1bbb"]);
    });
  });

  describe(toBidderRegions.name, () => {
    it("maps each provider to its region", () => {
      const regions = toBidderRegions([
        { owner: "akash1aaa", locationRegion: "eu-west" },
        { owner: "akash1bbb", locationRegion: null }
      ]);

      expect(regions.get("akash1aaa")).toBe("eu-west");
      expect(regions.get("akash1bbb")).toBeNull();
      expect(regions.has("akash1ccc")).toBe(false);
    });
  });

  function bidFrom(provider: string) {
    return { bid: { id: { provider } } };
  }
});
