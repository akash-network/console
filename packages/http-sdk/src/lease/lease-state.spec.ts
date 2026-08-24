import { describe, expect, it } from "vitest";

import { isLeaseLive, LIVE_LEASE_STATES } from "./lease-state";

describe("lease-state", () => {
  describe("isLeaseLive", () => {
    it.each(["active", "reclaiming"])("treats a %s lease as live", state => {
      expect(isLeaseLive({ state })).toBe(true);
    });

    it.each(["closed", "insufficient_funds"])("treats a %s lease as not live", state => {
      expect(isLeaseLive({ state })).toBe(false);
    });

    it("treats an unrecognized state as not live", () => {
      expect(isLeaseLive({ state: "some_future_state" })).toBe(false);
    });
  });

  describe("LIVE_LEASE_STATES", () => {
    it("lists exactly the states whose workload is still running", () => {
      expect(LIVE_LEASE_STATES).toEqual(["active", "reclaiming"]);
    });
  });
});
