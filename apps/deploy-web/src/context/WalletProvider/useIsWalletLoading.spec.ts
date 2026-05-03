import { describe, expect, it } from "vitest";

import { useIsWalletLoading, type UseIsWalletLoadingInput } from "./useIsWalletLoading";

describe(useIsWalletLoading.name, () => {
  it("returns true when an authenticated user's managed-wallet query is still loading, regardless of selectedWalletType", () => {
    const result = useIsWalletLoading(
      setup({
        hasAuthenticatedUserId: true,
        selectedWalletType: "custodial",
        isManagedWalletLoading: true
      })
    );

    expect(result).toBe(true);
  });

  it("returns true when selectedWalletType is managed and managed-wallet query is loading", () => {
    const result = useIsWalletLoading(
      setup({
        hasAuthenticatedUserId: false,
        selectedWalletType: "managed",
        isManagedWalletLoading: true
      })
    );

    expect(result).toBe(true);
  });

  it("returns true when selectedWalletType is custodial and a connection is in progress", () => {
    const result = useIsWalletLoading(
      setup({
        selectedWalletType: "custodial",
        isCustodialConnecting: true
      })
    );

    expect(result).toBe(true);
  });

  it("returns false when no auth, no managed-wallet loading, and no custodial connecting", () => {
    const result = useIsWalletLoading(setup({}));

    expect(result).toBe(false);
  });

  it("returns false for an unauthenticated user with no wallet activity", () => {
    const result = useIsWalletLoading(
      setup({
        hasAuthenticatedUserId: false,
        selectedWalletType: "custodial",
        isManagedWalletLoading: true,
        isCustodialConnecting: false
      })
    );

    expect(result).toBe(false);
  });

  function setup(overrides: Partial<UseIsWalletLoadingInput>): UseIsWalletLoadingInput {
    return {
      hasAuthenticatedUserId: false,
      selectedWalletType: "custodial",
      isManagedWalletLoading: false,
      isCustodialConnecting: false,
      ...overrides
    };
  }
});
