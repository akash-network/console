import type { AxiosResponse } from "axios";
import { AxiosError } from "axios";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { ActiveOrganization } from "@src/context/OrganizationProvider/OrganizationProvider";
import type { useWallet } from "@src/context/WalletProvider";
import type { useNotificator } from "@src/hooks/useNotificator";
import type { OrganizationOutput } from "@src/types/organization";
import type { UseProviderJwtResult } from "../useProviderJwt/useProviderJwt";
import { REFRESH_SKEW_SECONDS, TOKEN_TTL_SECONDS } from "../useProviderJwt/useProviderJwt";
import type { LeaseAccess } from "./useProviderCredentials";
import { DEPENDENCIES, isLeaseStatusWithheld, useProviderCredentials } from "./useProviderCredentials";

import { act } from "@testing-library/react";
import { setupQuery } from "@tests/unit/query-client";

describe(useProviderCredentials.name, () => {
  const SHELL_ACCESS: LeaseAccess = { provider: "akash1provider", dseqs: ["123"], scope: ["shell"] };

  it("returns usable JWT credentials when token is fresh", () => {
    const { result } = setup({
      wallet: { hasWallet: true },
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
      wallet: { hasWallet: true },
      providerJwt: { accessToken: null, isTokenExpired: false, generateToken: vi.fn().mockResolvedValue("new-token") }
    });

    expect(result.current.details.usable).toBe(false);
  });

  it("marks credentials unusable when token is expired", () => {
    const { result } = setup({
      wallet: { hasWallet: true },
      providerJwt: { accessToken: "stale-token", isTokenExpired: true, generateToken: vi.fn().mockResolvedValue("new-token") }
    });

    expect(result.current.details.usable).toBe(false);
  });

  it("auto-generates token when wallet is connected and token is missing", async () => {
    const generateToken = vi.fn().mockResolvedValue("new-token");

    setup({
      wallet: { hasWallet: true },
      providerJwt: { accessToken: null, isTokenExpired: false, generateToken }
    });

    await vi.waitFor(() => expect(generateToken).toHaveBeenCalledTimes(1));
  });

  it("does not auto-generate when wallet is disconnected", async () => {
    const generateToken = vi.fn().mockResolvedValue("new-token");

    setup({
      wallet: { hasWallet: false },
      providerJwt: { accessToken: null, isTokenExpired: false, generateToken }
    });

    await new Promise(resolve => setTimeout(resolve, 0));
    expect(generateToken).not.toHaveBeenCalled();
  });

  it("ensureToken returns existing token when fresh", async () => {
    const generateToken = vi.fn().mockResolvedValue("new-token");
    const { result } = setup({
      wallet: { hasWallet: true },
      providerJwt: { accessToken: "fresh-token", isTokenExpired: false, generateToken }
    });

    const token = await result.current.ensureToken();

    expect(token).toBe("fresh-token");
    expect(generateToken).not.toHaveBeenCalled();
  });

  it("ensureToken generates a new token when current one is expired", async () => {
    const generateToken = vi.fn().mockResolvedValue("fresh-token");
    const { result } = setup({
      wallet: { hasWallet: true },
      providerJwt: { accessToken: "stale-token", isTokenExpired: true, generateToken }
    });

    const token = await result.current.ensureToken();

    expect(token).toBe("fresh-token");
    expect(generateToken).toHaveBeenCalledTimes(1);
  });

  it("ensureToken generates a new token when the current one expires after the last render", async () => {
    const generateToken = vi.fn().mockResolvedValue("fresh-token");
    const isTokenExpiredRef = { current: false };
    const { result } = setup({
      wallet: { hasWallet: true },
      providerJwt: { accessToken: "stale-token", generateToken },
      isTokenExpiredRef
    });

    isTokenExpiredRef.current = true;
    const token = await result.current.ensureToken();

    expect(token).toBe("fresh-token");
    expect(generateToken).toHaveBeenCalledTimes(1);
  });

  it("ensureToken regenerates a token that is still fresh when forced", async () => {
    const generateToken = vi.fn().mockResolvedValue("forced-token");
    const { result } = setup({
      wallet: { hasWallet: true },
      providerJwt: { accessToken: "fresh-token", isTokenExpired: false, generateToken }
    });

    const token = await result.current.ensureToken({ force: true });

    expect(token).toBe("forced-token");
    expect(generateToken).toHaveBeenCalledTimes(1);
  });

  it("ensureToken deduplicates concurrent forced generation requests", async () => {
    const generateToken = vi.fn().mockResolvedValue("forced-token");
    const { result } = setup({
      wallet: { hasWallet: true },
      providerJwt: { accessToken: "fresh-token", isTokenExpired: false, generateToken }
    });

    await Promise.all([result.current.ensureToken({ force: true }), result.current.ensureToken({ force: true })]);

    expect(generateToken).toHaveBeenCalledTimes(1);
  });

  it("ensureToken deduplicates concurrent generation requests", async () => {
    const generateToken = vi.fn().mockResolvedValue("fresh-token");
    const { result } = setup({
      wallet: { hasWallet: true },
      providerJwt: { accessToken: null, isTokenExpired: false, generateToken }
    });

    await Promise.all([result.current.ensureToken(), result.current.ensureToken(), result.current.ensureToken()]);

    expect(generateToken).toHaveBeenCalledTimes(1);
  });

  it("auto-generates a token when none is held", async () => {
    const generateToken = vi.fn().mockResolvedValue("new-token");

    setup({
      wallet: { hasWallet: true },
      providerJwt: { accessToken: null, isTokenExpired: false, generateToken }
    });

    await vi.waitFor(() => expect(generateToken).toHaveBeenCalledTimes(1));
  });

  it("auto-generates a token once a wallet arrives after mount", async () => {
    const generateToken = vi.fn().mockResolvedValue("new-token");
    const hasWalletRef = { current: false };
    const { rerender } = setup({ providerJwt: { accessToken: null, isTokenExpired: false, generateToken }, hasWalletRef });

    hasWalletRef.current = true;
    await act(async () => {
      rerender();
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
      wallet: { hasWallet: true },
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
      wallet: { hasWallet: true },
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
      wallet: { hasWallet: true },
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

  describe("when the caller is limited to some projects", () => {
    it("treats credentials as usable with a wallet and never generates a token for every lease", async () => {
      const generateToken = vi.fn().mockResolvedValue("shared-token");
      const { result } = setup({ organization: { role: "member" }, providerJwt: { accessToken: null, generateToken } });

      await new Promise(resolve => setTimeout(resolve, 0));

      expect(result.current.tokenMode).toBe("per-deployment");
      expect(result.current.details.usable).toBe(true);
      expect(generateToken).not.toHaveBeenCalled();
    });

    it("treats credentials as unusable without a wallet", () => {
      const { result } = setup({ organization: { role: "member" }, wallet: { hasWallet: false } });

      expect(result.current.details.usable).toBe(false);
    });

    it("generates a token for the deployments and actions named", async () => {
      const generateDeploymentToken = vi.fn().mockResolvedValue("deployment-token");
      const { result } = setup({ organization: { role: "member" }, providerJwt: { generateDeploymentToken } });

      const token = await result.current.ensureToken({ access: SHELL_ACCESS });

      expect(token).toBe("deployment-token");
      expect(generateDeploymentToken).toHaveBeenCalledWith(SHELL_ACCESS);
    });

    it("reuses the token for the same provider, deployments and actions in any order", async () => {
      const generateDeploymentToken = vi.fn().mockResolvedValue("deployment-token");
      const { result } = setup({ organization: { role: "member" }, providerJwt: { generateDeploymentToken } });

      await result.current.ensureToken({ access: { provider: "akash1provider", dseqs: ["1", "2"], scope: ["logs", "events"] } });
      const token = await result.current.ensureToken({ access: { provider: "akash1provider", dseqs: ["2", "1"], scope: ["events", "logs"] } });

      expect(token).toBe("deployment-token");
      expect(generateDeploymentToken).toHaveBeenCalledTimes(1);
    });

    it.each([
      { name: "provider", access: { ...SHELL_ACCESS, provider: "akash1other" } },
      { name: "deployments", access: { ...SHELL_ACCESS, dseqs: ["456"] } },
      { name: "actions", access: { ...SHELL_ACCESS, scope: ["status" as const] } }
    ])("generates another token for other $name", async ({ access }) => {
      const generateDeploymentToken = vi.fn().mockResolvedValueOnce("first-token").mockResolvedValueOnce("second-token");
      const { result } = setup({ organization: { role: "member" }, providerJwt: { generateDeploymentToken } });

      await result.current.ensureToken({ access: SHELL_ACCESS });
      const token = await result.current.ensureToken({ access });

      expect(token).toBe("second-token");
      expect(generateDeploymentToken).toHaveBeenCalledTimes(2);
    });

    it("generates another token in another organization", async () => {
      const generateDeploymentToken = vi.fn().mockResolvedValueOnce("first-token").mockResolvedValueOnce("second-token");
      const organizationRef = { current: "org-1" };
      const { result, rerender } = setup({ organization: { role: "member" }, organizationRef, providerJwt: { generateDeploymentToken } });

      await result.current.ensureToken({ access: SHELL_ACCESS });
      organizationRef.current = "org-2";
      rerender();
      const token = await result.current.ensureToken({ access: SHELL_ACCESS });

      expect(token).toBe("second-token");
    });

    it("generates another token for another wallet", async () => {
      const generateDeploymentToken = vi.fn().mockResolvedValueOnce("first-token").mockResolvedValueOnce("second-token");
      const addressRef = { current: "akash1aaa" };
      const { result, rerender } = setup({ organization: { role: "member" }, addressRef, providerJwt: { generateDeploymentToken } });

      await result.current.ensureToken({ access: SHELL_ACCESS });
      addressRef.current = "akash1bbb";
      rerender();
      const token = await result.current.ensureToken({ access: SHELL_ACCESS });

      expect(token).toBe("second-token");
    });

    it("keeps the same ensureToken when the active organization is reloaded unchanged", () => {
      const { result, rerender } = setup({ organization: { role: "member" } });
      const { ensureToken } = result.current;

      rerender();

      expect(result.current.ensureToken).toBe(ensureToken);
    });

    it("keeps the token until shortly before it expires", async () => {
      const generateDeploymentToken = vi.fn().mockResolvedValueOnce("first-token").mockResolvedValueOnce("second-token");
      const { result } = setup({ organization: { role: "member" }, providerJwt: { generateDeploymentToken } });
      await result.current.ensureToken({ access: SHELL_ACCESS });
      const issuedAt = Date.now();
      const now = vi.spyOn(Date, "now");

      now.mockReturnValue(issuedAt + (TOKEN_TTL_SECONDS - REFRESH_SKEW_SECONDS) * 1000 - 1000);
      const keptToken = await result.current.ensureToken({ access: SHELL_ACCESS });
      now.mockReturnValue(issuedAt + (TOKEN_TTL_SECONDS - REFRESH_SKEW_SECONDS) * 1000 + 1000);
      const refreshedToken = await result.current.ensureToken({ access: SHELL_ACCESS });
      now.mockRestore();

      expect(keptToken).toBe("first-token");
      expect(refreshedToken).toBe("second-token");
    });

    it("keeps the token in the cache while it is fresh, even when nothing else uses it", async () => {
      vi.useFakeTimers();
      const generateDeploymentToken = vi.fn().mockResolvedValueOnce("first-token").mockResolvedValueOnce("second-token");
      const { result } = setup({ organization: { role: "member" }, providerJwt: { generateDeploymentToken } });

      await result.current.ensureToken({ access: SHELL_ACCESS });
      await vi.advanceTimersByTimeAsync((TOKEN_TTL_SECONDS - REFRESH_SKEW_SECONDS) * 1000 - 1000);
      const token = await result.current.ensureToken({ access: SHELL_ACCESS });
      vi.useRealTimers();

      expect(token).toBe("first-token");
    });

    it("generates another token when forced", async () => {
      const generateDeploymentToken = vi.fn().mockResolvedValueOnce("first-token").mockResolvedValueOnce("second-token");
      const { result } = setup({ organization: { role: "member" }, providerJwt: { generateDeploymentToken } });

      await result.current.ensureToken({ access: SHELL_ACCESS });
      const token = await result.current.ensureToken({ access: SHELL_ACCESS, force: true });

      expect(token).toBe("second-token");
    });

    it("remembers a refused token instead of asking again, until forced", async () => {
      const refusal = new AxiosError("Forbidden", "403", undefined, undefined, mock<AxiosResponse>({ status: 403 }));
      const generateDeploymentToken = vi.fn().mockRejectedValueOnce(refusal).mockResolvedValueOnce("granted-token");
      const { result } = setup({ organization: { role: "member" }, providerJwt: { generateDeploymentToken } });

      await expect(result.current.ensureToken({ access: SHELL_ACCESS })).rejects.toBe(refusal);
      await expect(result.current.ensureToken({ access: SHELL_ACCESS })).rejects.toBe(refusal);
      expect(generateDeploymentToken).toHaveBeenCalledTimes(1);

      const token = await result.current.ensureToken({ access: SHELL_ACCESS, force: true });

      expect(token).toBe("granted-token");
    });

    it("asks again after a server error", async () => {
      const failure = new AxiosError("Unavailable", "503", undefined, undefined, mock<AxiosResponse>({ status: 503 }));
      const generateDeploymentToken = vi.fn().mockRejectedValueOnce(failure).mockResolvedValueOnce("granted-token");
      const { result } = setup({ organization: { role: "member" }, providerJwt: { generateDeploymentToken } });

      await expect(result.current.ensureToken({ access: SHELL_ACCESS })).rejects.toBe(failure);
      const token = await result.current.ensureToken({ access: SHELL_ACCESS });

      expect(token).toBe("granted-token");
    });

    it("refuses a token that names no deployment", async () => {
      const generateDeploymentToken = vi.fn().mockResolvedValue("deployment-token");
      const { result } = setup({ organization: { role: "member" }, providerJwt: { generateDeploymentToken } });

      await expect(result.current.ensureToken()).rejects.toThrow(/no deployment named/i);
      expect(generateDeploymentToken).not.toHaveBeenCalled();
    });

    it("surfaces a refused token in details.error without a toast and clears it once a token is granted", async () => {
      const generateDeploymentToken = vi.fn().mockRejectedValueOnce("refused").mockResolvedValueOnce("deployment-token");
      const notificatorError = vi.fn();
      const { result } = setup({ organization: { role: "member" }, providerJwt: { generateDeploymentToken }, notificator: { error: notificatorError } });

      await expect(result.current.ensureToken({ access: SHELL_ACCESS })).rejects.toThrow("refused");
      await vi.waitFor(() => expect(result.current.details.error).toBeInstanceOf(Error));
      await result.current.ensureToken({ access: SHELL_ACCESS });

      await vi.waitFor(() => expect(result.current.details.error).toBeNull());
      expect(notificatorError).not.toHaveBeenCalled();
    });
  });

  describe("when the caller only views a team", () => {
    it.each(["viewer", "billing"] as const)("treats a %s's credentials as unusable and never asks for a token", async role => {
      const generateToken = vi.fn().mockResolvedValue("shared-token");
      const generateDeploymentToken = vi.fn().mockResolvedValue("deployment-token");
      const { result } = setup({ organization: { role }, providerJwt: { accessToken: null, generateToken, generateDeploymentToken } });

      await expect(result.current.ensureToken({ access: SHELL_ACCESS })).rejects.toThrow(/view-only access/i);

      expect(result.current.tokenMode).toBe("view-only");
      expect(result.current.details).toMatchObject({ usable: false, error: null });
      expect(generateToken).not.toHaveBeenCalled();
      expect(generateDeploymentToken).not.toHaveBeenCalled();
    });
  });

  it.each([
    { name: "loading", organizationState: { isLoading: true }, tokenMode: "pending" },
    { name: "failing to load", organizationState: { isError: true }, tokenMode: "organization-unavailable" },
    { name: "failing to load while still loading", organizationState: { isLoading: true, isError: true }, tokenMode: "organization-unavailable" }
  ])("waits without a token while the active organization is $name", async ({ organizationState, tokenMode }) => {
    const generateToken = vi.fn().mockResolvedValue("shared-token");
    const { result } = setup({ organizationState, providerJwt: { accessToken: "shared-token", generateToken } });

    await expect(result.current.ensureToken()).rejects.toThrow(/not known yet/i);

    expect(result.current.tokenMode).toBe(tokenMode);
    expect(result.current.details.usable).toBe(false);
    expect(generateToken).not.toHaveBeenCalled();
  });

  it.each([
    { name: "an owner of a team", organization: { type: "team" as const, role: "owner" as const } },
    { name: "an admin of a team", organization: { type: "team" as const, role: "admin" as const } },
    { name: "the owner of a personal organization", organization: { type: "personal" as const, role: "owner" as const } }
  ])("gives $name the token for every lease whatever the deployments named", async ({ organization }) => {
    const generateDeploymentToken = vi.fn().mockResolvedValue("deployment-token");
    const { result } = setup({ organization, providerJwt: { accessToken: "shared-token", isTokenExpired: false, generateDeploymentToken } });

    const token = await result.current.ensureToken({ access: SHELL_ACCESS });

    expect(token).toBe("shared-token");
    expect(result.current.tokenMode).toBe("shared");
    expect(result.current.details.usable).toBe(true);
    expect(generateDeploymentToken).not.toHaveBeenCalled();
  });

  describe(isLeaseStatusWithheld.name, () => {
    const refusal = new AxiosError("Forbidden", "403", undefined, undefined, mock<AxiosResponse>({ status: 403 }));
    const outage = new AxiosError("Unavailable", "503", undefined, undefined, mock<AxiosResponse>({ status: 503 }));

    it.each([
      { tokenMode: "view-only", error: null, expected: true },
      { tokenMode: "per-deployment", error: refusal, expected: true },
      { tokenMode: "per-deployment", error: outage, expected: false },
      { tokenMode: "per-deployment", error: null, expected: false },
      { tokenMode: "shared", error: refusal, expected: false },
      { tokenMode: "pending", error: null, expected: false }
    ] as const)("answers $expected for $tokenMode polls failing with $error", ({ tokenMode, error, expected }) => {
      expect(isLeaseStatusWithheld(tokenMode, [{ error: null }, { error }])).toBe(expected);
    });
  });

  function setup(input?: {
    wallet?: Partial<ReturnType<typeof useWallet>>;
    providerJwt?: Partial<UseProviderJwtResult>;
    notificator?: Partial<ReturnType<typeof useNotificator>>;
    addressRef?: { current: string };
    hasWalletRef?: { current: boolean };
    isTokenExpiredRef?: { current: boolean };
    organization?: Partial<Pick<OrganizationOutput, "type" | "role">>;
    organizationRef?: { current: string };
    organizationState?: { isLoading?: boolean; isError?: boolean };
  }) {
    const organization = input?.organization;
    const hasOrganizationState = !!organization || !!input?.organizationState;

    return setupQuery(() =>
      useProviderCredentials({
        dependencies: {
          ...DEPENDENCIES,
          ...(hasOrganizationState && {
            useActiveOrganization: () =>
              mock<ActiveOrganization>({
                activeOrganization: organization
                  ? mock<OrganizationOutput>({ id: input?.organizationRef?.current ?? "org-1", type: "team", ...organization })
                  : undefined,
                isLoading: false,
                isError: false,
                ...input?.organizationState
              })
          }),
          useWallet: () =>
            mock<ReturnType<typeof useWallet>>({
              hasWallet: true,
              ...input?.wallet,
              ...(input?.hasWalletRef && { hasWallet: input.hasWalletRef.current }),
              address: input?.addressRef?.current ?? input?.wallet?.address ?? "akash1aaa"
            }),
          useProviderJwt: () => {
            const jwt = mock<UseProviderJwtResult>({
              accessToken: null,
              isTokenExpired: false,
              generateToken: vi.fn().mockResolvedValue("generated-token"),
              ...input?.providerJwt
            });
            const isTokenExpiredRef = input?.isTokenExpiredRef;
            if (isTokenExpiredRef) {
              Object.defineProperty(jwt, "isTokenExpired", { get: () => isTokenExpiredRef.current, configurable: true });
            }
            return jwt;
          },
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
