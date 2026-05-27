import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { useWallet } from "@src/context/WalletProvider";
import type { useNotificator } from "@src/hooks/useNotificator";
import type { UseProviderJwtResult } from "../useProviderJwt/useProviderJwt";
import { DEPENDENCIES, useProviderCredentials } from "./useProviderCredentials";

import { act } from "@testing-library/react";
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
      usable: true,
      error: null
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

  it("does not auto-generate while not hydrated", async () => {
    const generateToken = vi.fn().mockResolvedValue("new-token");

    setup({
      wallet: { isWalletConnected: true },
      providerJwt: { accessToken: null, isTokenExpired: false, generateToken, isHydrated: false }
    });

    await new Promise(resolve => setTimeout(resolve, 0));
    expect(generateToken).not.toHaveBeenCalled();
  });

  it("auto-generates after hydration completes with a missing token", async () => {
    const generateToken = vi.fn().mockResolvedValue("new-token");

    setup({
      wallet: { isWalletConnected: true },
      providerJwt: { accessToken: null, isTokenExpired: false, generateToken, isHydrated: true }
    });

    await vi.waitFor(() => expect(generateToken).toHaveBeenCalledTimes(1));
  });

  it("retries generateToken on transient failure and surfaces no toast when it eventually succeeds", async () => {
    const generateToken = vi
      .fn()
      .mockRejectedValueOnce(new Error("blip 1"))
      .mockRejectedValueOnce(new Error("blip 2"))
      .mockResolvedValueOnce("recovered-token");
    const notificatorError = vi.fn();

    const { result } = setup({
      wallet: { isWalletConnected: true },
      providerJwt: { accessToken: null, isTokenExpired: false, generateToken },
      notificator: { error: notificatorError }
    });

    const token = await result.current.ensureToken();

    expect(token).toBe("recovered-token");
    expect(generateToken).toHaveBeenCalledTimes(3);
    expect(notificatorError).not.toHaveBeenCalled();
    expect(result.current.details.error).toBeNull();
  });

  it("surfaces toast and populates details.error after retry exhaustion", async () => {
    const generateToken = vi.fn().mockRejectedValue(new Error("permanent failure"));
    const notificatorError = vi.fn();

    const { result } = setup({
      wallet: { isWalletConnected: true },
      providerJwt: { accessToken: null, isTokenExpired: false, generateToken },
      notificator: { error: notificatorError }
    });

    await expect(result.current.ensureToken()).rejects.toThrow(/permanent failure/);

    expect(generateToken.mock.calls.length).toBeGreaterThanOrEqual(3);
    expect(notificatorError).toHaveBeenCalledTimes(1);
    expect(notificatorError.mock.calls[0][0]).toMatch(/Failed to authorize with the provider/i);
    await vi.waitFor(() => expect(result.current.details.error).toBeInstanceOf(Error));
  });

  it("clears details.error when the wallet address changes", async () => {
    const generateToken = vi.fn().mockRejectedValue(new Error("permanent failure"));
    const addressRef = { current: "akash1aaa" };

    const { result, rerender } = setup({
      wallet: { isWalletConnected: true },
      providerJwt: { accessToken: null, isTokenExpired: false, generateToken },
      addressRef
    });

    await expect(result.current.ensureToken()).rejects.toThrow();
    await vi.waitFor(() => expect(result.current.details.error).toBeInstanceOf(Error));

    addressRef.current = "akash1bbb";
    await act(async () => {
      rerender();
    });

    expect(result.current.details.error).toBeNull();
  });

  function setup(input?: {
    wallet?: Partial<ReturnType<typeof useWallet>>;
    providerJwt?: Partial<UseProviderJwtResult>;
    notificator?: Partial<ReturnType<typeof useNotificator>>;
    addressRef?: { current: string };
  }) {
    return setupQuery(() =>
      useProviderCredentials({
        dependencies: {
          ...DEPENDENCIES,
          useWallet: () =>
            mock<ReturnType<typeof useWallet>>({
              isWalletConnected: true,
              ...input?.wallet,
              address: input?.addressRef?.current ?? input?.wallet?.address ?? "akash1aaa"
            }),
          useProviderJwt: () =>
            mock<UseProviderJwtResult>({
              accessToken: null,
              isTokenExpired: false,
              isHydrated: true,
              generateToken: vi.fn().mockResolvedValue("generated-token"),
              ...input?.providerJwt
            }),
          useNotificator: () =>
            mock<ReturnType<typeof useNotificator>>({
              error: vi.fn(),
              success: vi.fn(),
              ...input?.notificator
            })
        }
      })
    );
  }
});
