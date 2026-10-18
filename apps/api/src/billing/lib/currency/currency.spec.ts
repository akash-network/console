import { describe, expect, it } from "vitest";

import { centsToUsd, roundUsdToCents, usdToCents } from "./currency";

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

  describe("roundUsdToCents", () => {
    it.each([
      [19.999976, 20],
      [19.995, 20],
      [19.994999, 19.99],
      [12.344, 12.34],
      [1234567.891, 1234567.89],
      [0.0049, 0]
    ])("rounds %s to %s", (usd, rounded) => {
      expect(roundUsdToCents(usd)).toBe(rounded);
    });

    it("rounds 1.005 up to the $1.01 the screen shows", () => {
      const shown = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(1.005);

      expect(shown).toBe("$1.01");
      expect(roundUsdToCents(1.005)).toBe(1.01);
    });
  });
});
