import { describe, expect, it } from "vitest";

import { asInteger } from "@src/akash/json";

describe("asInteger", () => {
  it("accepts non-negative safe integers and unsigned digit strings", () => {
    expect(asInteger(0)).toBe(0);
    expect(asInteger(42)).toBe(42);
    expect(asInteger("42")).toBe(42);
  });

  it("rejects negative numbers and negative strings", () => {
    expect(asInteger(-1)).toBeNull();
    expect(asInteger("-1")).toBeNull();
  });

  it("rejects unsafe integers and non-integers", () => {
    expect(asInteger(2 ** 53)).toBeNull();
    expect(asInteger(1.5)).toBeNull();
    expect(asInteger("99999999999999999999")).toBeNull();
  });

  it("rejects non-numeric values", () => {
    expect(asInteger("abc")).toBeNull();
    expect(asInteger(null)).toBeNull();
    expect(asInteger(undefined)).toBeNull();
  });
});
