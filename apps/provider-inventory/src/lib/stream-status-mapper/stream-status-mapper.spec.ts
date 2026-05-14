import { describe, expect, it } from "vitest";

import { parseQuantity } from "./stream-status-mapper";

describe(parseQuantity.name, () => {
  describe("empty / unparseable input", () => {
    it("returns 0n when the quantity is undefined", () => {
      expect(parseQuantity(undefined)).toBe(0n);
    });

    it("returns 0n when the string is empty", () => {
      expect(parseQuantity({ string: "" })).toBe(0n);
    });

    it("returns 0n when the string is whitespace", () => {
      expect(parseQuantity({ string: "   " })).toBe(0n);
    });

    it("returns 0n on garbage input", () => {
      expect(parseQuantity({ string: "abc" })).toBe(0n);
    });
  });

  describe("integer mantissa with binary SI suffix", () => {
    it("parses 1Ki as 2^10", () => {
      expect(parseQuantity({ string: "1Ki" })).toBe(1024n);
    });

    it("parses 32Gi as 32 * 2^30", () => {
      expect(parseQuantity({ string: "32Gi" })).toBe(34359738368n);
    });

    it("preserves precision for 1Ei (2^60 exceeds Number.MAX_SAFE_INTEGER)", () => {
      expect(parseQuantity({ string: "1Ei" })).toBe(1n << 60n);
    });

    it("preserves precision for 1000Ei", () => {
      expect(parseQuantity({ string: "1000Ei" })).toBe(1000n * (1n << 60n));
    });

    it("preserves precision for 1Pi (2^50 already exceeds safe integer scale)", () => {
      expect(parseQuantity({ string: "1Pi" })).toBe(1n << 50n);
    });
  });

  describe("fractional mantissa with binary SI suffix", () => {
    it("parses 1.5Gi exactly", () => {
      expect(parseQuantity({ string: "1.5Gi" })).toBe(1610612736n);
    });

    it("truncates fractional results toward zero", () => {
      expect(parseQuantity({ string: "1.5Ki" })).toBe(1536n);
    });

    it("preserves precision for 1.5Ei", () => {
      expect(parseQuantity({ string: "1.5Ei" })).toBe((15n * (1n << 60n)) / 10n);
    });
  });

  describe("integer mantissa with decimal SI suffix", () => {
    it("parses '8' (no suffix) as 8n", () => {
      expect(parseQuantity({ string: "8" })).toBe(8n);
    });

    it("parses 1k as 1000", () => {
      expect(parseQuantity({ string: "1k" })).toBe(1000n);
    });

    it("parses 1M as 1e6", () => {
      expect(parseQuantity({ string: "1M" })).toBe(1_000_000n);
    });

    it("parses 1E as 1e18 (exceeds Number.MAX_SAFE_INTEGER)", () => {
      expect(parseQuantity({ string: "1E" })).toBe(10n ** 18n);
    });

    it("preserves precision for 1000E (1e21)", () => {
      expect(parseQuantity({ string: "1000E" })).toBe(10n ** 21n);
    });

    it("parses 8000m as 8 (8000 * 1e-3, truncated)", () => {
      expect(parseQuantity({ string: "8000m" })).toBe(8n);
    });

    it("truncates 500m to 0", () => {
      expect(parseQuantity({ string: "500m" })).toBe(0n);
    });
  });

  describe("decimal-exponent form", () => {
    it("parses 1e9 as 1000000000", () => {
      expect(parseQuantity({ string: "1e9" })).toBe(1_000_000_000n);
    });

    it("parses 1.5e3 as 1500", () => {
      expect(parseQuantity({ string: "1.5e3" })).toBe(1500n);
    });

    it("preserves precision for 1e21", () => {
      expect(parseQuantity({ string: "1e21" })).toBe(10n ** 21n);
    });

    it("truncates a negative exponent toward zero", () => {
      expect(parseQuantity({ string: "5e-3" })).toBe(0n);
    });
  });

  describe("signed values", () => {
    it("parses negative integers", () => {
      expect(parseQuantity({ string: "-100" })).toBe(-100n);
    });

    it("parses negative binary SI", () => {
      expect(parseQuantity({ string: "-1Ki" })).toBe(-1024n);
    });

    it("parses negative fractional binary SI exactly", () => {
      expect(parseQuantity({ string: "-1.5Gi" })).toBe(-1610612736n);
    });
  });

  describe("plain integer mantissa (no suffix)", () => {
    it("parses unsafe integers exactly", () => {
      const unsafe = 9007199254740993n;
      expect(parseQuantity({ string: unsafe.toString() })).toBe(unsafe);
    });
  });
});
