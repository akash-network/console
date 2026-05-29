import { describe, expect, it } from "vitest";

import { deriveWalletIsLoading, type DeriveWalletIsLoadingInput } from "./deriveWalletIsLoading";

describe(deriveWalletIsLoading.name, () => {
  it.each<{ name: string; input: DeriveWalletIsLoadingInput; expected: boolean }>([
    {
      name: "authenticated user with managed-wallet query still loading",
      input: { hasAuthenticatedUserId: true, isManagedWalletLoading: true },
      expected: true
    },
    {
      name: "authenticated user with managed-wallet query settled",
      input: { hasAuthenticatedUserId: true, isManagedWalletLoading: false },
      expected: false
    },
    {
      name: "unauthenticated, managed-wallet query loading is irrelevant",
      input: { hasAuthenticatedUserId: false, isManagedWalletLoading: true },
      expected: false
    },
    {
      name: "unauthenticated, nothing loading",
      input: { hasAuthenticatedUserId: false, isManagedWalletLoading: false },
      expected: false
    }
  ])("$name → $expected", ({ input, expected }) => {
    expect(deriveWalletIsLoading(input)).toBe(expected);
  });
});
