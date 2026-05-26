import { describe, expect, it, vi } from "vitest";

import type { DEPENDENCIES } from "./useIsSelfCustodyEnabled";
import { SELF_CUSTODY_FLAG, useIsSelfCustodyEnabled } from "./useIsSelfCustodyEnabled";

import { renderHook } from "@testing-library/react";

describe(useIsSelfCustodyEnabled.name, () => {
  it("returns true when the self_custody flag is enabled", () => {
    const { result, useFlagSpy } = setup({ flagValue: true });

    expect(result.current).toBe(true);
    expect(useFlagSpy).toHaveBeenCalledWith(SELF_CUSTODY_FLAG);
  });

  it("returns false when the self_custody flag is disabled", () => {
    const { result } = setup({ flagValue: false });

    expect(result.current).toBe(false);
  });

  function setup(input: { flagValue: boolean }) {
    const useFlagSpy = vi.fn<typeof DEPENDENCIES.useFlag>(() => input.flagValue);

    const { result } = renderHook(() => useIsSelfCustodyEnabled({ useFlag: useFlagSpy }));

    return { result, useFlagSpy };
  }
});
