import type { JwtTokenPayload } from "@akashnetwork/chain-sdk/web";
import type { HttpClient } from "@akashnetwork/http-sdk";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { ContextType as WalletContext } from "@src/context/WalletProvider";
import type { useUser } from "@src/hooks/useUser";
import type { CustomUserProfile } from "@src/types/user";
import type * as storedWalletsService from "@src/utils/walletUtils";
import { DEPENDENCIES, REFRESH_SKEW_SECONDS, useProviderJwt } from "./useProviderJwt";

import { buildWallet } from "@tests/seeders";
import { buildManagedLocalWallet } from "@tests/seeders/localWallet";
import type { RenderAppHookOptions } from "@tests/unit/query-client";
import { setupQuery } from "@tests/unit/query-client";

type StoredWalletsService = typeof storedWalletsService;

describe(useProviderJwt.name, () => {
  it("returns initial state with no token", () => {
    const { result } = setup();

    expect(result.current.accessToken).toBeNull();
    expect(result.current.isTokenExpired).toBe(false);
    expect(typeof result.current.generateToken).toBe("function");
  });

  it("reads token from managed-wallet storage on mount", () => {
    const token = genFakeToken();
    const userId = "user-1";
    const wallet = buildManagedLocalWallet({ userId, token });
    const storedWalletsService = mock<StoredWalletsService>({
      getStorageManagedWallet: vi.fn().mockReturnValue(wallet)
    });

    const { result } = setup({
      services: { storedWalletsService: () => storedWalletsService },
      user: { id: userId }
    });

    expect(result.current.accessToken).toBe(token);
    expect(storedWalletsService.getStorageManagedWallet).toHaveBeenCalledWith(userId);
  });

  it("generates a token via the API and persists it", async () => {
    const token = genFakeToken();
    const userId = "user-1";
    const consoleApiHttpClient = mock<HttpClient>({
      post: vi.fn().mockResolvedValue({ data: { data: { token } } })
    } as unknown as HttpClient);
    const storedWalletsService = mock<StoredWalletsService>({
      getStorageManagedWallet: vi.fn().mockReturnValue(undefined),
      updateStorageManagedWallet: vi.fn()
    });

    const { result } = setup({
      services: { consoleApiHttpClient: () => consoleApiHttpClient, storedWalletsService: () => storedWalletsService },
      user: { id: userId },
      wallet: { isWalletConnected: true }
    });

    await result.current.generateToken();

    expect(consoleApiHttpClient.post).toHaveBeenCalledWith("/v1/create-jwt-token", {
      data: {
        ttl: 1800, // 30 * 60
        leases: {
          access: "scoped",
          scope: ["status", "shell", "events", "logs", "send-manifest", "get-manifest"]
        }
      }
    });
    expect(storedWalletsService.updateStorageManagedWallet).toHaveBeenCalledWith({ userId, token });
    expect(result.current.accessToken).toBe(token);
  });

  it("throws when generating a token while wallet is disconnected", async () => {
    const consoleApiHttpClient = mock<HttpClient>({ post: vi.fn() } as unknown as HttpClient);

    const { result } = setup({
      services: { consoleApiHttpClient: () => consoleApiHttpClient },
      wallet: { isWalletConnected: false }
    });

    await expect(result.current.generateToken()).rejects.toThrow(/wallet is not connected/i);
    expect(consoleApiHttpClient.post).not.toHaveBeenCalled();
  });

  it("throws when generating a token without an authenticated user", async () => {
    const consoleApiHttpClient = mock<HttpClient>({ post: vi.fn() } as unknown as HttpClient);

    const { result } = setup({
      services: { consoleApiHttpClient: () => consoleApiHttpClient },
      wallet: { isWalletConnected: true },
      user: null
    });

    await expect(result.current.generateToken()).rejects.toThrow(/user is not authenticated/i);
    expect(consoleApiHttpClient.post).not.toHaveBeenCalled();
  });

  it("generates a per-provider granular token without persisting it", async () => {
    const token = genFakeToken();
    const userId = "user-1";
    const consoleApiHttpClient = mock<HttpClient>({
      post: vi.fn().mockResolvedValue({ data: { data: { token } } })
    } as unknown as HttpClient);
    const storedWalletsService = mock<StoredWalletsService>({
      getStorageManagedWallet: vi.fn().mockReturnValue(undefined),
      updateStorageManagedWallet: vi.fn()
    });

    const { result } = setup({
      services: { consoleApiHttpClient: () => consoleApiHttpClient, storedWalletsService: () => storedWalletsService },
      user: { id: userId },
      wallet: { isWalletConnected: true }
    });

    const returned = await result.current.generateScopedProviderToken({ provider: "akash1provider", scope: ["attestation"] });

    expect(returned).toBe(token);
    expect(consoleApiHttpClient.post).toHaveBeenCalledWith("/v1/create-jwt-token", {
      data: {
        ttl: 1800, // 30 * 60
        leases: {
          access: "granular",
          permissions: [{ provider: "akash1provider", access: "scoped", scope: ["attestation"] }]
        }
      }
    });
    // ephemeral: the shared global token (storage + atom) must not be touched
    expect(storedWalletsService.updateStorageManagedWallet).not.toHaveBeenCalled();
    expect(result.current.accessToken).toBeNull();
  });

  it("throws when generating a scoped provider token while wallet is disconnected", async () => {
    const consoleApiHttpClient = mock<HttpClient>({ post: vi.fn() } as unknown as HttpClient);

    const { result } = setup({
      services: { consoleApiHttpClient: () => consoleApiHttpClient },
      wallet: { isWalletConnected: false }
    });

    await expect(result.current.generateScopedProviderToken({ provider: "akash1provider", scope: ["attestation"] })).rejects.toThrow(
      /wallet is not connected/i
    );
    expect(consoleApiHttpClient.post).not.toHaveBeenCalled();
  });

  it("throws when generating a scoped provider token without an authenticated user", async () => {
    const consoleApiHttpClient = mock<HttpClient>({ post: vi.fn() } as unknown as HttpClient);

    const { result } = setup({
      services: { consoleApiHttpClient: () => consoleApiHttpClient },
      wallet: { isWalletConnected: true },
      user: null
    });

    await expect(result.current.generateScopedProviderToken({ provider: "akash1provider", scope: ["attestation"] })).rejects.toThrow(
      /user is not authenticated/i
    );
    expect(consoleApiHttpClient.post).not.toHaveBeenCalled();
  });

  it("detects expired token correctly", () => {
    const pastTime = Math.floor(Date.now() / 1000) - 100;
    const { result } = setup({ initialToken: genFakeToken({ exp: pastTime }) });

    expect(result.current.isTokenExpired).toBe(true);
  });

  it("detects valid token correctly", () => {
    const futureTime = Math.floor(Date.now() / 1000) + 3600;
    const { result } = setup({ initialToken: genFakeToken({ exp: futureTime }) });

    expect(result.current.isTokenExpired).toBe(false);
  });

  it("treats token within refresh skew window as expired", () => {
    const nearExpiry = Math.floor(Date.now() / 1000) + REFRESH_SKEW_SECONDS - 5;

    const { result } = setup({
      initialToken: genFakeToken({ exp: nearExpiry })
    });

    expect(result.current.isTokenExpired).toBe(true);
  });

  it("treats token outside refresh skew window as valid", () => {
    const beyondSkew = Math.floor(Date.now() / 1000) + REFRESH_SKEW_SECONDS + 60;

    const { result } = setup({
      initialToken: genFakeToken({ exp: beyondSkew })
    });

    expect(result.current.isTokenExpired).toBe(false);
  });

  it("marks isHydrated true after the storage read completes", () => {
    const { result } = setup({
      initialToken: genFakeToken()
    });

    expect(result.current.isHydrated).toBe(true);
  });

  function setup(input?: {
    services?: Partial<RenderAppHookOptions["services"]>;
    wallet?: Partial<WalletContext>;
    user?: Partial<CustomUserProfile> | null;
    initialToken?: string;
  }) {
    const user = input?.user === null ? undefined : { id: "user-1", ...(input?.user ?? {}) };
    const seededWallet = input?.initialToken ? buildManagedLocalWallet({ userId: user?.id ?? "user-1", token: input.initialToken }) : undefined;

    return setupQuery(
      () =>
        useProviderJwt({
          dependencies: {
            ...DEPENDENCIES,
            useWallet: () => buildWallet({ isWalletConnected: true, ...input?.wallet }),
            useUser: () =>
              mock<ReturnType<typeof useUser>>({
                user: user as CustomUserProfile | undefined
              })
          }
        }),
      {
        services: {
          storedWalletsService: () =>
            mock<StoredWalletsService>({
              getStorageManagedWallet: vi.fn().mockReturnValue(seededWallet)
            }),
          consoleApiHttpClient: () => mock(),
          ...input?.services
        }
      }
    );
  }

  function genFakeToken(payload: Partial<JwtTokenPayload> = {}) {
    return `header.${btoa(
      JSON.stringify({
        version: "v1",
        iss: "akash1234567890",
        exp: Date.now() + 3600,
        iat: Date.now(),
        leases: { access: "full" },
        ...payload
      })
    )}.signature`;
  }
});
