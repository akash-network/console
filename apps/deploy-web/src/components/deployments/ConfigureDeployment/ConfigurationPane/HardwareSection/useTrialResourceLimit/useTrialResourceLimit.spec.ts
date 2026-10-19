import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { DEPENDENCIES } from "./useTrialResourceLimit";
import { useTrialResourceLimit } from "./useTrialResourceLimit";

import { renderHook } from "@testing-library/react";

describe(useTrialResourceLimit.name, () => {
  it("returns the configured caps for a trial user", () => {
    const { result } = setup({ isRestricted: true, maxCpu: 4, maxMemoryGi: 16 });

    expect(result.current).toEqual({ maxCpu: 4, maxMemoryGi: 16 });
  });

  it("returns no cap for a user who is not on a trial", () => {
    const { result } = setup({ isRestricted: false, maxCpu: 4, maxMemoryGi: 16 });

    expect(result.current).toBeUndefined();
  });

  it("returns no cap when both caps are switched off", () => {
    const { result } = setup({ isRestricted: true, maxCpu: 0, maxMemoryGi: 0 });

    expect(result.current).toBeUndefined();
  });

  it("keeps the CPU cap when only the memory cap is switched off", () => {
    const { result } = setup({ isRestricted: true, maxCpu: 4, maxMemoryGi: 0 });

    expect(result.current).toEqual({ maxCpu: 4, maxMemoryGi: 0 });
  });

  it("keeps the memory cap when only the CPU cap is switched off", () => {
    const { result } = setup({ isRestricted: true, maxCpu: 0, maxMemoryGi: 16 });

    expect(result.current).toEqual({ maxCpu: 0, maxMemoryGi: 16 });
  });

  function setup(input: { isRestricted: boolean; maxCpu: number; maxMemoryGi: number }) {
    const dependencies: typeof DEPENDENCIES = {
      useTrialGate: () => ({ isRestricted: input.isRestricted, isWalletReady: true }),
      useServices: () =>
        Object.assign(mock<ReturnType<typeof DEPENDENCIES.useServices>>(), {
          publicConfig: mock<ReturnType<typeof DEPENDENCIES.useServices>["publicConfig"]>({
            NEXT_PUBLIC_MANAGED_WALLET_TRIAL_MAX_CPU: input.maxCpu,
            NEXT_PUBLIC_MANAGED_WALLET_TRIAL_MAX_MEMORY_GI: input.maxMemoryGi
          })
        })
    };
    return renderHook(() => useTrialResourceLimit(dependencies));
  }
});
