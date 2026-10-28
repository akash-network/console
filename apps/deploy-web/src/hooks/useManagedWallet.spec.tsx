import type { ApiManagedWalletOutput, ManagedWalletHttpService } from "@akashnetwork/http-sdk";
import type { UserProfile } from "@auth0/nextjs-auth0/client";
import { UserProvider } from "@auth0/nextjs-auth0/client";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { useManagedWallet } from "./useManagedWallet";

import { act } from "@testing-library/react";
import { setupQuery } from "@tests/unit/query-client";

describe(useManagedWallet.name, () => {
  it("is not initializing once the wallet query settles", () => {
    const { result } = setup();

    expect(result.current.managed.isInitializing).toBe(false);
  });

  it("hands back the queried wallet", async () => {
    const userId = "user-sync";

    const { result } = setup({ userId, apiWallet: buildApiWallet({ userId, address: "akash1queried", creditAmount: 25 }) });

    await vi.waitFor(() => {
      expect(result.current.managed.wallet).toMatchObject({ address: "akash1queried", creditAmount: 25, isTrialing: true });
    });
  });

  it("reports a failed wallet lookup", async () => {
    const { result } = setup({ userId: "user-failed", lookupError: new Error("wallet service down") });

    await vi.waitFor(() => {
      expect(result.current.managed.isLookupFailed).toBe(true);
    });
  });

  it("is initializing while the first wallet lookup is in flight", async () => {
    const { result } = setup({ userId: "user-pending", isLookupPending: true });

    await vi.waitFor(() => {
      expect(result.current.managed.isInitializing).toBe(true);
    });
  });

  it("stays settled while a failed wallet lookup is retried", async () => {
    const { result, managedWalletService } = setup({ userId: "user-retried", lookupError: new Error("wallet service down") });
    await vi.waitFor(() => {
      expect(result.current.managed.isLookupFailed).toBe(true);
    });
    managedWalletService.getWallet.mockReturnValue(new Promise(() => {}));

    act(() => {
      void result.current.managed.refetch();
    });

    await vi.waitFor(() => {
      expect(result.current.managed.isFetching).toBe(true);
    });
    expect(result.current.managed.isInitializing).toBe(false);
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

  function setup(input?: { userId?: string; apiWallet?: ApiManagedWalletOutput; lookupError?: Error; isLookupPending?: boolean }) {
    const managedWalletService = mock<ManagedWalletHttpService>({
      getWallet: vi.fn((): Promise<ApiManagedWalletOutput | null> => {
        if (input?.isLookupPending) return new Promise(() => {});
        return input?.lookupError ? Promise.reject(input.lookupError) : Promise.resolve(input?.apiWallet ?? null);
      })
    });

    const user = { email: "test@akash.network", id: input?.userId, userId: input?.userId } as UserProfile;

    const view = setupQuery(
      () => {
        const managed = useManagedWallet();
        return { managed };
      },
      {
        services: { managedWalletService: () => managedWalletService },
        wrapper: ({ children }) => <UserProvider user={user}>{children}</UserProvider>
      }
    );

    return { ...view, managedWalletService };
  }
});
