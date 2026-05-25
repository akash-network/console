import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { useWallet } from "@src/context/WalletProvider";
import type { UseProviderJwtResult } from "../useProviderJwt/useProviderJwt";
import { DEPENDENCIES, useProviderCredentials } from "./useProviderCredentials";

import { setupQuery } from "@tests/unit/query-client";

describe(useProviderCredentials.name, () => {
  it("returns usable JWT credentials when token is fresh", () => {
    const { result } = setup({
      wallet: { isWalletConnected: true },
      providerJwt: { accessToken: "fresh-token", isTokenExpired: false }
    });

    expect(result.current.details).toEqual({
      type: "jwt",
      value: "fresh-token",
      isExpired: false,
      usable: true
    });
  });

  it("marks credentials unusable when token is missing", () => {
    const { result } = setup({
      wallet: { isWalletConnected: true },
      providerJwt: { accessToken: null, isTokenExpired: false, generateToken: vi.fn().mockResolvedValue("new-token") }
    });

    expect(result.current.details.usable).toBe(false);
  });

  it("marks credentials unusable when token is expired", () => {
    const { result } = setup({
      wallet: { isWalletConnected: true },
      providerJwt: { accessToken: "stale-token", isTokenExpired: true, generateToken: vi.fn().mockResolvedValue("new-token") }
    });

    expect(result.current.details.usable).toBe(false);
  });

  it("auto-generates token when wallet is connected and token is missing", async () => {
    const generateToken = vi.fn().mockResolvedValue("new-token");

    setup({
      wallet: { isWalletConnected: true },
      providerJwt: { accessToken: null, isTokenExpired: false, generateToken }
    });

    await vi.waitFor(() => expect(generateToken).toHaveBeenCalledTimes(1));
  });

  it("does not auto-generate when wallet is disconnected", async () => {
    const generateToken = vi.fn().mockResolvedValue("new-token");

    setup({
      wallet: { isWalletConnected: false },
      providerJwt: { accessToken: null, isTokenExpired: false, generateToken }
    });

    await new Promise(resolve => setTimeout(resolve, 0));
    expect(generateToken).not.toHaveBeenCalled();
  });

  it("ensureToken returns existing token when fresh", async () => {
    const generateToken = vi.fn().mockResolvedValue("new-token");
    const { result } = setup({
      wallet: { isWalletConnected: true },
      providerJwt: { accessToken: "fresh-token", isTokenExpired: false, generateToken }
    });

    const token = await result.current.ensureToken();

    expect(token).toBe("fresh-token");
    expect(generateToken).not.toHaveBeenCalled();
  });

  it("ensureToken generates a new token when current one is expired", async () => {
    const generateToken = vi.fn().mockResolvedValue("fresh-token");
    const { result } = setup({
      wallet: { isWalletConnected: true },
      providerJwt: { accessToken: "stale-token", isTokenExpired: true, generateToken }
    });

    const token = await result.current.ensureToken();

    expect(token).toBe("fresh-token");
    expect(generateToken).toHaveBeenCalledTimes(1);
  });

  it("ensureToken deduplicates concurrent generation requests", async () => {
    const generateToken = vi.fn().mockResolvedValue("fresh-token");
    const { result } = setup({
      wallet: { isWalletConnected: true },
      providerJwt: { accessToken: null, isTokenExpired: false, generateToken }
    });

    await Promise.all([result.current.ensureToken(), result.current.ensureToken(), result.current.ensureToken()]);

    expect(generateToken).toHaveBeenCalledTimes(1);
  });

  function setup(input?: { wallet?: Partial<ReturnType<typeof useWallet>>; providerJwt?: Partial<UseProviderJwtResult> }) {
    return setupQuery(() =>
      useProviderCredentials({
        dependencies: {
          ...DEPENDENCIES,
          useWallet: () =>
            mock<ReturnType<typeof useWallet>>({
              isWalletConnected: true,
              ...input?.wallet
            }),
          useProviderJwt: () =>
            mock<UseProviderJwtResult>({
              accessToken: null,
              isTokenExpired: false,
              generateToken: vi.fn().mockResolvedValue("generated-token"),
              ...input?.providerJwt
            })
        }
      })
    );
  }
});
