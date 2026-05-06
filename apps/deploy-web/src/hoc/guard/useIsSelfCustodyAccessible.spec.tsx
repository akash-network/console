import { describe, expect, it, vi } from "vitest";

import { useIsSelfCustodyAccessible } from "./useIsSelfCustodyAccessible";

import { renderHook } from "@testing-library/react";

describe(useIsSelfCustodyAccessible.name, () => {
  it("allows visit when self-custody is enabled", () => {
    const { result } = setup({ enabled: true });

    expect(result.current).toEqual({ canVisit: true, isLoading: false });
  });

  it("denies visit when self-custody is disabled", () => {
    const { result } = setup({ enabled: false });

    expect(result.current).toEqual({ canVisit: false, isLoading: false });
  });

  function setup(input: { enabled: boolean }) {
    const useIsSelfCustodyEnabled = vi.fn(() => input.enabled);

    return renderHook(() => useIsSelfCustodyAccessible({ useIsSelfCustodyEnabled }));
  }
});
