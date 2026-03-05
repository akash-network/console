import { describe, expect, it } from "vitest";

import { useCurrencyFormatter } from "./useCurrencyFormatter";

import { renderHook } from "@testing-library/react";

describe(useCurrencyFormatter.name, () => {
  it("formats positive numbers as USD currency", () => {
    const { result } = renderHook(() => useCurrencyFormatter());

    expect(result.current(0)).toBe("$0.00");
    expect(result.current(1)).toBe("$1.00");
    expect(result.current(1234.56)).toBe("$1,234.56");
    expect(result.current(1000000)).toBe("$1,000,000.00");
    expect(result.current(0.99)).toBe("$0.99");
  });

  it("formats negative numbers as USD currency", () => {
    const { result } = renderHook(() => useCurrencyFormatter());

    expect(result.current(-1)).toBe("-$1.00");
    expect(result.current(-1234.56)).toBe("-$1,234.56");
  });

  it("rounds to 2 decimal places", () => {
    const { result } = renderHook(() => useCurrencyFormatter());

    expect(result.current(1.234)).toBe("$1.23");
    expect(result.current(1.235)).toBe("$1.24");
    expect(result.current(1.999)).toBe("$2.00");
  });

  it("formats very large numbers", () => {
    const { result } = renderHook(() => useCurrencyFormatter());

    expect(result.current(999999999.99)).toBe("$999,999,999.99");
  });

  it("formats very small numbers", () => {
    const { result } = renderHook(() => useCurrencyFormatter());

    expect(result.current(0.01)).toBe("$0.01");
    expect(result.current(0.001)).toBe("$0.00");
  });

  it("returns the same formatter function on re-renders", () => {
    const { result, rerender } = renderHook(() => useCurrencyFormatter());

    const firstFormatter = result.current;
    rerender();
    const secondFormatter = result.current;

    expect(firstFormatter).toBe(secondFormatter);
  });
});
