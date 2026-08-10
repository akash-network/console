import type { ApiManagedWalletOutput, ManagedWalletHttpService } from "@akashnetwork/http-sdk";
import type { UserProfile } from "@auth0/nextjs-auth0/client";
import { UserProvider } from "@auth0/nextjs-auth0/client";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { getStorageManagedWallet } from "@src/utils/walletUtils";
import { useManagedWallet } from "./useManagedWallet";

import { setupQuery } from "@tests/unit/query-client";

describe(useManagedWallet.name, () => {
  it("is not initializing once the wallet query settles", () => {
    const { result } = setup();

    expect(result.current.managed.isInitializing).toBe(false);
  });

  it("persists the queried wallet to storage", async () => {
    const userId = "user-sync";

    setup({ userId, apiWallet: buildApiWallet({ userId, address: "akash1queried", creditAmount: 25 }) });

    await vi.waitFor(() => {
      expect(getStorageManagedWallet(userId)).toMatchObject({ address: "akash1queried", creditAmount: 25, isTrialing: true });
    });
  });

  function buildApiWallet(overrides: { userId: string; address: string; creditAmount?: number }) {
    return {
      ...mock<ApiManagedWalletOutput>(),
      isTrialing: true,
      creditAmount: overrides.creditAmount ?? 0,
      userId: overrides.userId,
      address: overrides.address
    };
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
