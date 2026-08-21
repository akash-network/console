import { describe, expect, it } from "vitest";

import { DEC_ONE, decCeilInt, decFromInt, decFromString, decMul, decMulInt, decQuo, decToString, decTruncateInt, minBigInt } from "@src/akash/dec";

describe("dec", () => {
  describe("decFromString", () => {
    it("parses integer coin amounts", () => {
      expect(decFromString("1000")).toBe(1000n * DEC_ONE);
    });

    it("parses fractional DecCoin amounts", () => {
      expect(decFromString("1.5")).toBe(1_500_000_000_000_000_000n);
    });

    it("parses postgres numeric(38,18) output with full fractional padding", () => {
      expect(decFromString("2.500000000000000000")).toBe(2_500_000_000_000_000_000n);
    });

    it("parses negative values", () => {
      expect(decFromString("-0.5")).toBe(-500_000_000_000_000_000n);
    });

    it("rejects malformed strings", () => {
      expect(() => decFromString("1e5")).toThrow("Invalid decimal string");
      expect(() => decFromString("")).toThrow("Invalid decimal string");
    });

    it("rejects more than 18 fractional digits", () => {
      expect(() => decFromString("1.0000000000000000001")).toThrow("18 fractional digits");
    });
  });

  describe("decToString", () => {
    it("round-trips integers and fractions", () => {
      expect(decToString(decFromString("1000"))).toBe("1000");
      expect(decToString(decFromString("1.5"))).toBe("1.5");
      expect(decToString(decFromString("-0.5"))).toBe("-0.5");
    });

    it("keeps full 18-digit precision", () => {
      expect(decToString(1n)).toBe("0.000000000000000001");
    });
  });

  describe("decQuo", () => {
    it("rounds half away from zero at the 18th decimal like LegacyDec", () => {
      expect(decQuo(decFromInt(1), decFromInt(3))).toBe(333_333_333_333_333_333n);
      expect(decQuo(decFromInt(2), decFromInt(3))).toBe(666_666_666_666_666_667n);
    });

    it("rounds negative quotients half away from zero", () => {
      expect(decQuo(decFromInt(-2), decFromInt(3))).toBe(-666_666_666_666_666_667n);
    });

    it("divides exactly when no remainder exists", () => {
      expect(decQuo(decFromInt(10), decFromInt(4))).toBe(decFromString("2.5"));
    });

    it("throws on division by zero", () => {
      expect(() => decQuo(DEC_ONE, 0n)).toThrow("Division by zero");
    });
  });

  describe("decMul", () => {
    it("multiplies with rounding at the 18th decimal", () => {
      const oneThird = decQuo(decFromInt(1), decFromInt(3));
      expect(decMul(oneThird, decFromInt(3))).toBe(999_999_999_999_999_999n);
    });

    it("multiplies exact values without loss", () => {
      expect(decMul(decFromString("1.5"), decFromString("2"))).toBe(decFromString("3"));
    });
  });

  describe("decMulInt", () => {
    it("is exact for integer multipliers", () => {
      expect(decMulInt(decFromString("0.000000000000000001"), 1_000_000_000_000_000_000n)).toBe(DEC_ONE);
    });
  });

  describe("decTruncateInt", () => {
    it("truncates toward zero", () => {
      expect(decTruncateInt(decFromString("2.9"))).toBe(2n);
      expect(decTruncateInt(decFromString("2"))).toBe(2n);
      expect(decTruncateInt(decFromString("-2.9"))).toBe(-2n);
    });
  });

  describe("decCeilInt", () => {
    it("rounds up any fractional part", () => {
      expect(decCeilInt(decFromString("2.000000000000000001"))).toBe(3n);
      expect(decCeilInt(decFromString("2"))).toBe(2n);
    });

    it("ceils negatives toward positive infinity", () => {
      expect(decCeilInt(decFromString("-2.5"))).toBe(-2n);
      expect(decCeilInt(decFromString("-2"))).toBe(-2n);
    });
  });

  describe("minBigInt", () => {
    it("returns the smaller value", () => {
      expect(minBigInt(3n, 5n)).toBe(3n);
      expect(minBigInt(5n, 3n)).toBe(3n);
    });
  });
});
