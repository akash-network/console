import type { HttpClient } from "@akashnetwork/http-sdk";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { ContextType as WalletContext } from "@src/context/WalletProvider";
import type { useUser } from "@src/hooks/useUser";
import type { CustomUserProfile } from "@src/types/user";
import { DEPENDENCIES, useProviderJwt } from "./useProviderJwt";

import { act } from "@testing-library/react";
import { buildWallet } from "@tests/seeders";
import { setupQuery } from "@tests/unit/query-client";

describe(useProviderJwt.name, () => {
  it("generates a token for every lease of the one provider named", async () => {
    const { result, consoleApiHttpClient } = setup({ issuedToken: "provider-token" });

    const returned = await act(() => result.current.generateScopedProviderToken({ provider: "akash1provider", scope: ["status", "shell"] }));

    expect(returned).toBe("provider-token");
    expect(consoleApiHttpClient.post).toHaveBeenCalledWith("/v1/create-jwt-token", {
      data: {
        ttl: 1800,
        leases: {
          access: "granular",
          permissions: [{ provider: "akash1provider", access: "scoped", scope: ["status", "shell"] }]
        }
      }
    });
  });

  it("throws when generating a scoped provider token while wallet is disconnected", async () => {
    const { result, consoleApiHttpClient } = setup({ wallet: { hasWallet: false } });

    await expect(result.current.generateScopedProviderToken({ provider: "akash1provider", scope: ["attestation"] })).rejects.toThrow(/user has no wallet/i);
    expect(consoleApiHttpClient.post).not.toHaveBeenCalled();
  });

  it("throws when generating a scoped provider token without an authenticated user", async () => {
    const { result, consoleApiHttpClient } = setup({ user: null });

    await expect(result.current.generateScopedProviderToken({ provider: "akash1provider", scope: ["attestation"] })).rejects.toThrow(
      /user is not authenticated/i
    );
    expect(consoleApiHttpClient.post).not.toHaveBeenCalled();
  });

  it("generates a provider token once the wallet arrives after the first render", async () => {
    const hasWalletRef = { current: false };
    const { result, rerender } = setup({ hasWalletRef, issuedToken: "provider-token" });

    hasWalletRef.current = true;
    rerender();
    const returned = await act(() => result.current.generateScopedProviderToken({ provider: "akash1provider", scope: ["status"] }));

    expect(returned).toBe("provider-token");
  });

  it("generates a token for the named deployments of one provider", async () => {
    const { result, consoleApiHttpClient } = setup({ issuedToken: "deployment-token" });

    const returned = await act(() => result.current.generateDeploymentToken({ provider: "akash1provider", dseqs: ["123", "456"], scope: ["logs", "events"] }));

    expect(returned).toBe("deployment-token");
    expect(consoleApiHttpClient.post).toHaveBeenCalledWith("/v1/create-jwt-token", {
      data: {
        ttl: 1800,
        leases: {
          access: "granular",
          permissions: [
            {
              provider: "akash1provider",
              access: "granular",
              deployments: [
                { dseq: 123, scope: ["logs", "events"], services: ["*"] },
                { dseq: 456, scope: ["logs", "events"], services: ["*"] }
              ]
            }
          ]
        }
      }
    });
  });

  it("throws when generating a deployment token while wallet is disconnected", async () => {
    const { result, consoleApiHttpClient } = setup({ wallet: { hasWallet: false } });

    await expect(result.current.generateDeploymentToken({ provider: "akash1provider", dseqs: ["123"], scope: ["status"] })).rejects.toThrow(
      /user has no wallet/i
    );
    expect(consoleApiHttpClient.post).not.toHaveBeenCalled();
  });

  it("throws when generating a deployment token without an authenticated user", async () => {
    const { result, consoleApiHttpClient } = setup({ user: null });

    await expect(result.current.generateDeploymentToken({ provider: "akash1provider", dseqs: ["123"], scope: ["status"] })).rejects.toThrow(
      /user is not authenticated/i
    );
    expect(consoleApiHttpClient.post).not.toHaveBeenCalled();
  });

  function setup(input?: { wallet?: Partial<WalletContext>; hasWalletRef?: { current: boolean }; user?: null; issuedToken?: string }) {
    const consoleApiHttpClient = mock<HttpClient>({
      post: vi.fn().mockResolvedValue({ data: { data: { token: input?.issuedToken ?? "token" } } })
    } as unknown as HttpClient);
    const dependencies: typeof DEPENDENCIES = {
      ...DEPENDENCIES,
      useWallet: () => buildWallet({ hasWallet: input?.hasWalletRef?.current ?? true, address: "akash1wallet", ...input?.wallet }),
      useUser: () =>
        mock<ReturnType<typeof useUser>>({
          user: input?.user === null ? undefined : ({ id: "user-1" } as CustomUserProfile)
        })
    };

    const rendered = setupQuery(() => useProviderJwt({ dependencies }), {
      services: { consoleApiHttpClient: () => consoleApiHttpClient }
    });

    return { ...rendered, consoleApiHttpClient };
  }
});
