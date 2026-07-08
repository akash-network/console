import type { UserProfile } from "@auth0/nextjs-auth0/client";
import { UserProvider } from "@auth0/nextjs-auth0/client";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { useCreateManagedWalletMutation } from "@src/queries/useManagedWalletQuery";
import type { ManagedWalletHttpService } from "@src/services/managed-wallet-http/managed-wallet-http.service";
import { useManagedWallet } from "./useManagedWallet";

import { act } from "@testing-library/react";
import { setupQuery } from "@tests/unit/query-client";

describe(useManagedWallet.name, () => {
  it("is not loading once the wallet query settles and no create is in flight", () => {
    const { result } = setup();

    expect(result.current.managed.isLoading).toBe(false);
  });

  it("reports loading while a managed-wallet create fired by another instance is in flight", async () => {
    // The trial is created from the onboarding picker / auto-deploy flow — a different useManagedWallet
    // instance than the persistent WalletProvider that reads loading state. The loading signal must still
    // reflect that in-flight create so the onboarding redirect guard does not treat the provisioning trial
    // as "no wallet" and bounce the user to /signup mid-provision.
    const { result } = setup();

    act(() => {
      result.current.createMutation.mutate("user-1");
    });

    await vi.waitFor(() => {
      expect(result.current.managed.isLoading).toBe(true);
    });
  });

  function setup() {
    const managedWalletService = mock<ManagedWalletHttpService>({
      // A never-settling create keeps the mutation pending for the duration of the assertion.
      createWallet: vi.fn().mockReturnValue(new Promise<never>(() => {}))
    });

    return setupQuery(
      () => {
        const createMutation = useCreateManagedWalletMutation();
        const managed = useManagedWallet();
        return { createMutation, managed };
      },
      {
        services: { managedWalletService: () => managedWalletService },
        wrapper: ({ children }) => <UserProvider user={{ email: "test@akash.network" } as UserProfile}>{children}</UserProvider>
      }
    );
  }
});
