import type { JwtTokenPayload } from "@akashnetwork/chain-sdk/web";
import type { HttpClient } from "@akashnetwork/http-sdk";
import { createStore, Provider as JotaiProvider } from "jotai";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { ContextType as WalletContext } from "@src/context/WalletProvider";
import type { useUser } from "@src/hooks/useUser";
import type { CustomUserProfile } from "@src/types/user";
import { DEPENDENCIES, REFRESH_SKEW_SECONDS, useProviderJwt } from "./useProviderJwt";

import { act } from "@testing-library/react";
import { buildWallet } from "@tests/seeders";
import { setupQuery } from "@tests/unit/query-client";

describe(useProviderJwt.name, () => {
  it("holds no token before one is generated", () => {
    const { result } = setup();

    expect(result.current.first.accessToken).toBeNull();
    expect(result.current.first.isTokenExpired).toBe(false);
  });

  it("generates a token via the API and holds it", async () => {
    const token = genFakeToken();
    const { result, consoleApiHttpClient } = setup({ issuedToken: token });

    await act(() => result.current.first.generateToken());

    expect(consoleApiHttpClient.post).toHaveBeenCalledWith("/v1/create-jwt-token", {
      data: {
        ttl: 1800,
        leases: {
          access: "scoped",
          scope: ["status", "shell", "events", "logs", "send-manifest", "get-manifest"]
        }
      }
    });
    expect(result.current.first.accessToken).toBe(token);
  });

  it("shares the token it generates with every other user of the hook", async () => {
    const token = genFakeToken();
    const { result } = setup({ issuedToken: token });

    await act(() => result.current.first.generateToken());

    expect(result.current.second.accessToken).toBe(token);
  });

  it("keeps the token out of browser storage", async () => {
    const token = genFakeToken();
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    const { result } = setup({ issuedToken: token });

    await act(() => result.current.first.generateToken());
    const tokenWrites = setItem.mock.calls.filter(([, value]) => value.includes(token));
    setItem.mockRestore();

    expect(tokenWrites).toEqual([]);
  });

  it("does not hand one user's token to the next user signed in", async () => {
    const userRef = { current: "user-1" };
    const { result, rerender } = setup({ issuedToken: genFakeToken(), userRef });
    await act(() => result.current.first.generateToken());

    userRef.current = "user-2";
    rerender();

    expect(result.current.first.accessToken).toBeNull();
  });

  it("holds a token generated after the user changed for the new user", async () => {
    const userRef = { current: "user-1" };
    const { result, rerender } = setup({ issuedToken: genFakeToken(), userRef });

    userRef.current = "user-2";
    rerender();
    await act(() => result.current.first.generateToken());

    expect(result.current.first.accessToken).not.toBeNull();
  });

  it("throws when generating a token while wallet is disconnected", async () => {
    const { result, consoleApiHttpClient } = setup({ wallet: { hasWallet: false } });

    await expect(result.current.first.generateToken()).rejects.toThrow(/user has no wallet/i);
    expect(consoleApiHttpClient.post).not.toHaveBeenCalled();
  });

  it("throws when generating a token without an authenticated user", async () => {
    const { result, consoleApiHttpClient } = setup({ user: null });

    await expect(result.current.first.generateToken()).rejects.toThrow(/user is not authenticated/i);
    expect(consoleApiHttpClient.post).not.toHaveBeenCalled();
  });

  it("generates a per-provider granular token without replacing the shared one", async () => {
    const token = genFakeToken();
    const { result, consoleApiHttpClient } = setup({ issuedToken: token });

    const returned = await act(() => result.current.first.generateScopedProviderToken({ provider: "akash1provider", scope: ["attestation"] }));

    expect(returned).toBe(token);
    expect(consoleApiHttpClient.post).toHaveBeenCalledWith("/v1/create-jwt-token", {
      data: {
        ttl: 1800,
        leases: {
          access: "granular",
          permissions: [{ provider: "akash1provider", access: "scoped", scope: ["attestation"] }]
        }
      }
    });
    expect(result.current.first.accessToken).toBeNull();
  });

  it("throws when generating a scoped provider token while wallet is disconnected", async () => {
    const { result, consoleApiHttpClient } = setup({ wallet: { hasWallet: false } });

    await expect(result.current.first.generateScopedProviderToken({ provider: "akash1provider", scope: ["attestation"] })).rejects.toThrow(
      /user has no wallet/i
    );
    expect(consoleApiHttpClient.post).not.toHaveBeenCalled();
  });

  it("throws when generating a scoped provider token without an authenticated user", async () => {
    const { result, consoleApiHttpClient } = setup({ user: null });

    await expect(result.current.first.generateScopedProviderToken({ provider: "akash1provider", scope: ["attestation"] })).rejects.toThrow(
      /user is not authenticated/i
    );
    expect(consoleApiHttpClient.post).not.toHaveBeenCalled();
  });

  it("detects expired token correctly", async () => {
    const { result } = setup({ issuedToken: genFakeToken({ exp: Math.floor(Date.now() / 1000) - 100 }) });

    await act(() => result.current.first.generateToken());

    expect(result.current.first.isTokenExpired).toBe(true);
  });

  it("detects valid token correctly", async () => {
    const { result } = setup({ issuedToken: genFakeToken({ exp: Math.floor(Date.now() / 1000) + 3600 }) });

    await act(() => result.current.first.generateToken());

    expect(result.current.first.isTokenExpired).toBe(false);
  });

  it("treats token within refresh skew window as expired", async () => {
    const { result } = setup({ issuedToken: genFakeToken({ exp: Math.floor(Date.now() / 1000) + REFRESH_SKEW_SECONDS - 5 }) });

    await act(() => result.current.first.generateToken());

    expect(result.current.first.isTokenExpired).toBe(true);
  });

  it("treats token outside refresh skew window as valid", async () => {
    const { result } = setup({ issuedToken: genFakeToken({ exp: Math.floor(Date.now() / 1000) + REFRESH_SKEW_SECONDS + 60 }) });

    await act(() => result.current.first.generateToken());

    expect(result.current.first.isTokenExpired).toBe(false);
  });

  function setup(input?: { wallet?: Partial<WalletContext>; user?: null; userRef?: { current: string }; issuedToken?: string }) {
    const store = createStore();
    const consoleApiHttpClient = mock<HttpClient>({
      post: vi.fn().mockResolvedValue({ data: { data: { token: input?.issuedToken ?? genFakeToken() } } })
    } as unknown as HttpClient);
    const dependencies: typeof DEPENDENCIES = {
      ...DEPENDENCIES,
      useWallet: () => buildWallet({ hasWallet: true, ...input?.wallet }),
      useUser: () =>
        mock<ReturnType<typeof useUser>>({
          user: input?.user === null ? undefined : ({ id: input?.userRef?.current ?? "user-1" } as CustomUserProfile)
        })
    };

    const rendered = setupQuery(
      () => ({
        first: useProviderJwt({ dependencies }),
        second: useProviderJwt({ dependencies })
      }),
      {
        services: { consoleApiHttpClient: () => consoleApiHttpClient },
        wrapper: ({ children }) => <JotaiProvider store={store}>{children}</JotaiProvider>
      }
    );

    return { ...rendered, consoleApiHttpClient };
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
