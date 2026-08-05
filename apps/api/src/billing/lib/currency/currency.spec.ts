import { describe, expect, it } from "vitest";

import { centsToUsd, usdToCents } from "./currency";

describe("currency", () => {
  describe("usdToCents", () => {
    it("converts whole dollars to cents", () => {
      expect(usdToCents(20)).toBe(2000);
    });

    it("rounds cent-level fractions without float drift", () => {
      expect(usdToCents(20.01)).toBe(2001);
      expect(usdToCents(99.99)).toBe(9999);
    });
  });

  describe("centsToUsd", () => {
    it("converts cents back to dollars", () => {
      expect(centsToUsd(2001)).toBe(20.01);
    });

    it("round-trips with usdToCents", () => {
      expect(centsToUsd(usdToCents(150.5))).toBe(150.5);
    });
  });
});
