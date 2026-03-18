import { describe, expect, it } from "vitest";

import type { DEPENDENCIES } from "./useDenom";
import { useSdlDenoms, useUsdcDenom } from "./useDenom";

import { renderHook } from "@testing-library/react";

describe(useUsdcDenom.name, () => {
  it("returns usdc denom for the selected network", () => {
    const { result } = renderHook(() => useUsdcDenom(buildDependencies()));

    expect(result.current).toBeTruthy();
    expect(typeof result.current).toBe("string");
  });
});

describe(useSdlDenoms.name, () => {
  it("returns AKT and USDC when ACT is not supported", () => {
    const { result } = renderHook(() => useSdlDenoms(buildDependencies({ supportsACT: false })));

    expect(result.current).toHaveLength(2);
    expect(result.current.map(d => d.id)).toEqual(["uakt", "uusdc"]);
  });

  it("returns ACT and AKT when ACT is supported", () => {
    const { result } = renderHook(() => useSdlDenoms(buildDependencies({ supportsACT: true })));

    expect(result.current).toHaveLength(2);
    expect(result.current.map(d => d.id)).toEqual(["uact", "uakt"]);
  });

  it("sets correct properties for ACT denom", () => {
    const { result } = renderHook(() => useSdlDenoms(buildDependencies({ supportsACT: true })));

    expect(result.current[0]).toEqual({ id: "uact", label: "uACT", tokenLabel: "ACT", value: "uact" });
  });

  it("sets correct properties for AKT denom when ACT is supported", () => {
    const { result } = renderHook(() => useSdlDenoms(buildDependencies({ supportsACT: true })));

    expect(result.current[1]).toEqual({ id: "uakt", label: "uAKT", tokenLabel: "AKT", value: "uakt" });
  });
});

function buildDependencies(input: { networkId?: string; supportsACT?: boolean } = {}) {
  return {
    useServices: () =>
      ({
        networkStore: {
          useSelectedNetworkId: () => input.networkId ?? "mainnet"
        }
      }) as ReturnType<typeof DEPENDENCIES.useServices>,
    useSupportsACT: () => input.supportsACT ?? false
  } as typeof DEPENDENCIES;
}
