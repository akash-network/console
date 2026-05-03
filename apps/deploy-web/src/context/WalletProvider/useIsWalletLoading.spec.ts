import { describe, expect, it } from "vitest";

import { useIsWalletLoading, type UseIsWalletLoadingInput } from "./useIsWalletLoading";

describe(useIsWalletLoading.name, () => {
  it.each<{ name: string; input: UseIsWalletLoadingInput; expected: boolean }>([
    {
      name: "authenticated user, custodial selected, managed-wallet query still loading (the race-condition case)",
      input: { hasAuthenticatedUserId: true, selectedWalletType: "custodial", isManagedWalletLoading: true, isCustodialConnecting: false },
      expected: true
    },
    {
      name: "authenticated user, managed selected, managed-wallet query still loading",
      input: { hasAuthenticatedUserId: true, selectedWalletType: "managed", isManagedWalletLoading: true, isCustodialConnecting: false },
      expected: true
    },
    {
      name: "unauthenticated, managed selected, managed-wallet query still loading",
      input: { hasAuthenticatedUserId: false, selectedWalletType: "managed", isManagedWalletLoading: true, isCustodialConnecting: false },
      expected: true
    },
    {
      name: "custodial selected and a connection is in progress",
      input: { hasAuthenticatedUserId: false, selectedWalletType: "custodial", isManagedWalletLoading: false, isCustodialConnecting: true },
      expected: true
    },
    {
      name: "unauthenticated, custodial selected, no activity",
      input: { hasAuthenticatedUserId: false, selectedWalletType: "custodial", isManagedWalletLoading: false, isCustodialConnecting: false },
      expected: false
    },
    {
      name: "unauthenticated, custodial selected, managed query loading is irrelevant",
      input: { hasAuthenticatedUserId: false, selectedWalletType: "custodial", isManagedWalletLoading: true, isCustodialConnecting: false },
      expected: false
    },
    {
      name: "authenticated, managed selected, nothing loading",
      input: { hasAuthenticatedUserId: true, selectedWalletType: "managed", isManagedWalletLoading: false, isCustodialConnecting: false },
      expected: false
    }
  ])("$name → $expected", ({ input, expected }) => {
    expect(useIsWalletLoading(input)).toBe(expected);
  });
});
