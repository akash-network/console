import type { JwtTokenPayload } from "@akashnetwork/chain-sdk/web";
import type { HttpClient } from "@akashnetwork/http-sdk";
import type { NetworkStore } from "@akashnetwork/network-store";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { ChainContext as CustodialWallet, useSelectedChain } from "@src/context/CustomChainProvider";
import type { ContextType as WalletContext } from "@src/context/WalletProvider";
import type * as storedWalletsService from "@src/utils/walletUtils";
import { DEPENDENCIES, useProviderJwt } from "./useProviderJwt";

import { act } from "@testing-library/react";
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

  it("retrieves token from storage when wallet address changes", () => {
    const token = genFakeToken();
    const storedWalletsService = mock<StoredWalletsService>({
      getStorageWallets: vi.fn().mockReturnValue([{ address: "akash1234567890", token }])
    });

    const { result } = setup({
      services: {
        storedWalletsService: () => storedWalletsService
      },
      wallet: {
        address: "akash1234567890"
      }
    });

    expect(result.current.accessToken).toBe(token);
    expect(storedWalletsService.getStorageWallets).toHaveBeenCalledWith("mainnet");
  });

  it("generates token for managed wallet via API", async () => {
    const token = genFakeToken();
    const consoleApiHttpClient = mock<HttpClient>({
      post: vi.fn().mockResolvedValue({
        data: { data: { token } }
      })
    } as unknown as HttpClient);

    const storedWalletsService = mock<StoredWalletsService>({
      updateWallet: vi.fn(),
      getStorageWallets: vi.fn().mockReturnValue([{ address: "akash1234567890", token }])
    });

    const { result } = setup({
      services: {
        consoleApiHttpClient: () => consoleApiHttpClient,
        storedWalletsService: () => storedWalletsService
      },
      wallet: {
        isManaged: true,
        isWalletConnected: true,
        address: "akash1234567890"
      }
    });

    await result.current.generateToken();

    expect(consoleApiHttpClient.post).toHaveBeenCalledWith("/v1/create-jwt-token", {
      data: {
        ttl: 1800, // 30 * 60
        leases: {
          access: "scoped",
          scope: ["status", "shell", "events", "logs"]
        }
      }
    });
    expect(storedWalletsService.updateWallet).toHaveBeenCalledWith("akash1234567890", expect.any(Function));
    expect(result.current.accessToken).toBe(token);
  });

  it("generates token for non-managed wallet via direct signing", async () => {
    const address = "akash1".padEnd(6 + 38, "0");
    const custodialWallet = mock<CustodialWallet>({
      address,
      signArbitrary: vi.fn().mockResolvedValue({ signature: btoa("signature") })
    });

    const storedWallets: storedWalletsService.LocalWallet[] = [{ address } as storedWalletsService.LocalWallet];
    const storedWalletsService = mock<StoredWalletsService>({
      getStorageWallets: vi.fn(() => storedWallets),
      updateWallet: vi.fn((address, fn) => {
        const walletIndex = storedWallets.findIndex(w => w.address === address);
        if (walletIndex !== -1) {
          storedWallets[walletIndex] = fn(storedWallets[walletIndex]);
        }
        return storedWallets;
      })
    });

    const { result } = setup({
      services: {
        storedWalletsService: () => storedWalletsService
      },
      wallet: {
        isManaged: false,
        address
      },
      custodialWallet
    });

    await act(() => result.current.generateToken());

    expect(custodialWallet.signArbitrary).toHaveBeenCalledWith(address, expect.any(String));
    expect(storedWalletsService.updateWallet).toHaveBeenCalledWith(address, expect.any(Function));

    const [, , signature] = result.current.accessToken?.split(".") ?? [];
    expect(atob(signature)).toBe("signature");
  });

  it("does not generate token when wallet is not connected", async () => {
    const consoleApiHttpClient = mock<HttpClient>({
      post: vi.fn()
    } as unknown as HttpClient);

    const { result } = setup({
      services: {
        consoleApiHttpClient: () => consoleApiHttpClient
      },
      wallet: {
        isWalletConnected: false
      }
    });

    await result.current.generateToken();

    expect(consoleApiHttpClient.post).not.toHaveBeenCalled();
  });

  it("detects expired token correctly", () => {
    const pastTime = Math.floor(Date.now() / 1000) - 100;

    const { result } = setup({
      initialToken: genFakeToken({ exp: pastTime })
    });

    expect(result.current.isTokenExpired).toBe(true);
  });

  it("detects valid token correctly", () => {
    const futureTime = Math.floor(Date.now() / 1000) + 3600;

    const { result } = setup({
      initialToken: genFakeToken({ exp: futureTime })
    });

    expect(result.current.isTokenExpired).toBe(false);
  });

  function setup(input?: {
    services?: Partial<RenderAppHookOptions["services"]>;
    wallet?: Partial<WalletContext>;
    custodialWallet?: ReturnType<typeof useSelectedChain>;
    initialToken?: string;
  }) {
    return setupQuery(
      () =>
        useProviderJwt({
          dependencies: {
            ...DEPENDENCIES,
            useWallet: () => ({
              address: "akash1234567890",
              walletName: "test-wallet",
              isWalletLoaded: true,
              connectManagedWallet: vi.fn(),
              logout: vi.fn(),
              signAndBroadcastTx: vi.fn(),
              isManaged: false,
              isWalletConnected: true,
              isCustodial: false,
              isWalletLoading: false,
              isTrialing: false,
              isOnboarding: false,
              creditAmount: 0,
              switchWalletType: vi.fn(),
              hasManagedWallet: false,
              managedWalletError: undefined,
              ...input?.wallet
            }),
            useSelectedChain: () =>
              input?.custodialWallet ??
              mock<CustodialWallet>({
                signArbitrary: vi.fn()
              })
          }
        }),
      {
        services: {
          networkStore: () =>
            mock<NetworkStore>({
              useSelectedNetworkId: () => "mainnet"
            }),
          storedWalletsService: () =>
            mock<StoredWalletsService>({
              getStorageWallets: () =>
                input?.initialToken ? [{ address: "akash1234567890", token: input.initialToken } as storedWalletsService.LocalWallet] : []
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
