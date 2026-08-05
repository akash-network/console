import type { ApiManagedWalletOutput, ManagedWalletHttpService } from "@akashnetwork/http-sdk";
import type { UserProfile } from "@auth0/nextjs-auth0/client";
import { UserProvider } from "@auth0/nextjs-auth0/client";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { getStorageManagedWallet, updateStorageManagedWallet } from "@src/utils/walletUtils";
import { useManagedWallet } from "./useManagedWallet";

import { setupQuery } from "@tests/unit/query-client";

describe(useManagedWallet.name, () => {
  it("is not loading once the wallet query settles", () => {
    const { result } = setup();

    expect(result.current.managed.isLoading).toBe(false);
  });

  it("keeps the stored wallet untouched when the API returns a wallet without an address", async () => {
    const userId = "user-guard-merge";
    updateStorageManagedWallet({ userId, address: "akash1existing", creditAmount: 100, isTrialing: true, selected: true });

    const { result } = setup({ userId, apiWallet: buildApiWallet({ userId, address: null, creditAmount: 0 }) });

    await vi.waitFor(() => {
      expect(result.current.managed.wallet).toBeDefined();
    });
    expect(getStorageManagedWallet(userId)).toMatchObject({ address: "akash1existing", creditAmount: 100, isTrialing: true });
  });

  it("does not persist a wallet without an address to storage", async () => {
    const userId = "user-guard-empty";

    const { result } = setup({ userId, apiWallet: buildApiWallet({ userId, address: null }) });

    await vi.waitFor(() => {
      expect(result.current.managed.wallet).toBeDefined();
    });
    expect(getStorageManagedWallet(userId)).toBeUndefined();
  });

  it("persists the queried wallet to storage once it has an address", async () => {
    const userId = "user-sync";

    setup({ userId, apiWallet: buildApiWallet({ userId, address: "akash1queried", creditAmount: 25 }) });

    await vi.waitFor(() => {
      expect(getStorageManagedWallet(userId)).toMatchObject({ address: "akash1queried", creditAmount: 25, isTrialing: true });
    });
  });

  /** Mirrors the real API contract: `address` is nullable while a wallet is mid-provisioning, even though the SDK type claims `string`. */
  function buildApiWallet(overrides: { userId: string; address: string | null; creditAmount?: number }) {
    return {
      ...mock<ApiManagedWalletOutput>(),
      isTrialing: true,
      creditAmount: overrides.creditAmount ?? 0,
      userId: overrides.userId,
      address: overrides.address
    } as ApiManagedWalletOutput;
  }

  function setup(input?: { userId?: string; apiWallet?: ApiManagedWalletOutput }) {
    const managedWalletService = mock<ManagedWalletHttpService>({
      getWallet: vi.fn().mockResolvedValue(input?.apiWallet ?? null)
    });

    const user = { email: "test@akash.network", id: input?.userId, userId: input?.userId } as UserProfile;

    return setupQuery(
      () => {
        const managed = useManagedWallet();
        return { managed };
      },
      {
        services: { managedWalletService: () => managedWalletService },
        wrapper: ({ children }) => <UserProvider user={user}>{children}</UserProvider>
      }
    );
  }
});
