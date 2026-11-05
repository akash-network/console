import type { AxiosResponse } from "axios";
import { AxiosError } from "axios";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { ActiveOrganization } from "@src/context/OrganizationProvider/OrganizationProvider";
import type { useWallet } from "@src/context/WalletProvider";
import type { OrganizationOutput } from "@src/types/organization";
import type { UseProviderJwtResult } from "../useProviderJwt/useProviderJwt";
import { REFRESH_SKEW_SECONDS, TOKEN_TTL_SECONDS } from "../useProviderJwt/useProviderJwt";
import type { LeaseAccess } from "./useProviderCredentials";
import { canRequestScope, DEPENDENCIES, isLeaseStatusWithheld, useProviderCredentials } from "./useProviderCredentials";

import { act } from "@testing-library/react";
import { setupQuery } from "@tests/unit/query-client";

describe(useProviderCredentials.name, () => {
  const SHELL_ACCESS: LeaseAccess = { provider: "akash1provider", dseqs: ["123"], scope: ["shell"] };
  const PROVIDER_WIDE_SCOPE = ["status", "shell", "events", "logs", "send-manifest", "get-manifest"];

  describe("when the caller reaches every project", () => {
    it("treats credentials as usable with a wallet and asks for no token until a lease needs one", async () => {
      const { result, generateScopedProviderToken } = setup();

      await new Promise(resolve => setTimeout(resolve, 0));

      expect(result.current.tokenMode).toBe("shared");
      expect(result.current.details).toEqual({ usable: true, error: null });
      expect(generateScopedProviderToken).not.toHaveBeenCalled();
    });

    it("treats credentials as unusable without a wallet", () => {
      const { result } = setup({ wallet: { hasWallet: false } });

      expect(result.current.details.usable).toBe(false);
    });

    it("treats credentials as usable once a wallet arrives after mount", async () => {
      const hasWalletRef = { current: false };
      const { result, rerender } = setup({ hasWalletRef });

      hasWalletRef.current = true;
      await act(async () => {
        rerender();
      });

      expect(result.current.details.usable).toBe(true);
    });

    it("asks for a token bound to the provider named that covers status, logs, events, shell and manifests", async () => {
      const { result, generateScopedProviderToken, generateDeploymentToken } = setup();

      const token = await result.current.ensureToken({ access: SHELL_ACCESS });

      expect(token).toBe("token-for-akash1provider");
      expect(generateScopedProviderToken).toHaveBeenCalledWith({ provider: "akash1provider", scope: PROVIDER_WIDE_SCOPE });
      expect(generateDeploymentToken).not.toHaveBeenCalled();
    });

    it.each([
      { name: "status", scope: ["status" as const] },
      { name: "logs and events", scope: ["logs" as const, "events" as const] },
      { name: "a shell", scope: ["shell" as const] },
      { name: "sending a manifest", scope: ["send-manifest" as const] },
      { name: "reading a manifest", scope: ["get-manifest" as const] }
    ])("hands each provider only its own token for $name", async ({ scope }) => {
      const { result, generateScopedProviderToken } = setup();

      const firstToken = await result.current.ensureToken({ access: { provider: "akash1first", dseqs: ["1"], scope } });
      const secondToken = await result.current.ensureToken({ access: { provider: "akash1second", dseqs: ["2"], scope } });

      expect(firstToken).toBe("token-for-akash1first");
      expect(secondToken).toBe("token-for-akash1second");
      expect(generateScopedProviderToken.mock.calls.map(([{ provider }]) => provider)).toEqual(["akash1first", "akash1second"]);
    });

    it("reuses one token per provider whatever the deployments and actions named", async () => {
      const { result, generateScopedProviderToken } = setup();

      const tokens = [
        await result.current.ensureToken({ access: { provider: "akash1provider", dseqs: ["1"], scope: ["status"] } }),
        await result.current.ensureToken({ access: { provider: "akash1provider", dseqs: ["2"], scope: ["logs", "events"] } }),
        await result.current.ensureToken({ access: { provider: "akash1provider", dseqs: ["3"], scope: ["shell"] } })
      ];

      expect(tokens).toEqual(["token-for-akash1provider", "token-for-akash1provider", "token-for-akash1provider"]);
      expect(generateScopedProviderToken).toHaveBeenCalledTimes(1);
    });

    it("asks once per provider for leases that ask at the same time", async () => {
      const { result, generateScopedProviderToken } = setup();
      const accessAt = (provider: string, dseq: string): LeaseAccess => ({ provider, dseqs: [dseq], scope: ["status"] });

      const tokens = await Promise.all([
        result.current.ensureToken({ access: accessAt("akash1first", "1") }),
        result.current.ensureToken({ access: accessAt("akash1first", "2") }),
        result.current.ensureToken({ access: accessAt("akash1second", "3") }),
        result.current.ensureToken({ access: accessAt("akash1first", "4") }),
        result.current.ensureToken({ access: accessAt("akash1second", "5") })
      ]);

      expect(tokens).toEqual(["token-for-akash1first", "token-for-akash1first", "token-for-akash1second", "token-for-akash1first", "token-for-akash1second"]);
      expect(generateScopedProviderToken).toHaveBeenCalledTimes(2);
    });

    it("keeps a provider's token until shortly before it expires", async () => {
      const generateScopedProviderToken = vi.fn().mockResolvedValueOnce("first-token").mockResolvedValueOnce("second-token");
      const { result } = setup({ providerJwt: { generateScopedProviderToken } });
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

    it("asks for another token for the provider when forced", async () => {
      const generateScopedProviderToken = vi.fn().mockResolvedValueOnce("first-token").mockResolvedValueOnce("second-token");
      const { result } = setup({ providerJwt: { generateScopedProviderToken } });

      await result.current.ensureToken({ access: SHELL_ACCESS });
      const token = await result.current.ensureToken({ access: SHELL_ACCESS, force: true });

      expect(token).toBe("second-token");
    });

    it("asks once for forced refreshes of a provider's token that happen at the same time", async () => {
      const { result, generateScopedProviderToken } = setup();

      await Promise.all([result.current.ensureToken({ access: SHELL_ACCESS, force: true }), result.current.ensureToken({ access: SHELL_ACCESS, force: true })]);

      expect(generateScopedProviderToken).toHaveBeenCalledTimes(1);
    });

    it("asks for another token in another organization", async () => {
      const generateScopedProviderToken = vi.fn().mockResolvedValueOnce("first-token").mockResolvedValueOnce("second-token");
      const organizationRef = { current: "org-1" };
      const { result, rerender } = setup({ organization: { role: "owner" }, organizationRef, providerJwt: { generateScopedProviderToken } });

      await result.current.ensureToken({ access: SHELL_ACCESS });
      organizationRef.current = "org-2";
      rerender();
      const token = await result.current.ensureToken({ access: SHELL_ACCESS });

      expect(token).toBe("second-token");
    });

    it("asks for another token for another wallet", async () => {
      const generateScopedProviderToken = vi.fn().mockResolvedValueOnce("first-token").mockResolvedValueOnce("second-token");
      const addressRef = { current: "akash1aaa" };
      const { result, rerender } = setup({ addressRef, providerJwt: { generateScopedProviderToken } });

      await result.current.ensureToken({ access: SHELL_ACCESS });
      addressRef.current = "akash1bbb";
      rerender();
      const token = await result.current.ensureToken({ access: SHELL_ACCESS });

      expect(token).toBe("second-token");
    });

    it("retries a transient failure and surfaces no error once a token is granted", async () => {
      vi.useFakeTimers();
      const generateScopedProviderToken = vi
        .fn()
        .mockRejectedValueOnce(new Error("blip 1"))
        .mockRejectedValueOnce(new Error("blip 2"))
        .mockResolvedValueOnce("recovered-token");
      const { result } = setup({ providerJwt: { generateScopedProviderToken } });

      const pending = result.current.ensureToken({ access: SHELL_ACCESS });
      await vi.advanceTimersByTimeAsync(10_000);
      const token = await pending;
      vi.useRealTimers();

      expect(token).toBe("recovered-token");
      expect(generateScopedProviderToken).toHaveBeenCalledTimes(3);
      expect(result.current.details.error).toBeNull();
    });

    it("surfaces the failure in details.error once retries are exhausted and clears it once a token is granted", async () => {
      vi.useFakeTimers();
      const generateScopedProviderToken = vi.fn().mockRejectedValue(new Error("permanent failure"));
      const { result } = setup({ providerJwt: { generateScopedProviderToken } });

      const failure = expect(result.current.ensureToken({ access: SHELL_ACCESS })).rejects.toThrow(/permanent failure/);
      await vi.advanceTimersByTimeAsync(10_000);
      await failure;
      vi.useRealTimers();
      await vi.waitFor(() => expect(result.current.details.error).toBeInstanceOf(Error));
      generateScopedProviderToken.mockResolvedValueOnce("granted-token");
      const token = await result.current.ensureToken({ access: SHELL_ACCESS });

      expect(token).toBe("granted-token");
      await vi.waitFor(() => expect(result.current.details.error).toBeNull());
    });

    it("remembers a refused token instead of asking again, until forced", async () => {
      vi.useFakeTimers();
      const refusal = new AxiosError("Bad Request", "400", undefined, undefined, mock<AxiosResponse>({ status: 400 }));
      const generateScopedProviderToken = vi.fn().mockRejectedValue(refusal);
      const { result } = setup({ providerJwt: { generateScopedProviderToken } });

      const firstRefusal = expect(result.current.ensureToken({ access: SHELL_ACCESS })).rejects.toBe(refusal);
      await vi.advanceTimersByTimeAsync(10_000);
      await firstRefusal;
      vi.useRealTimers();
      const attemptsBeforeRemembered = generateScopedProviderToken.mock.calls.length;
      await expect(result.current.ensureToken({ access: SHELL_ACCESS })).rejects.toBe(refusal);
      generateScopedProviderToken.mockResolvedValueOnce("granted-token");
      const token = await result.current.ensureToken({ access: SHELL_ACCESS, force: true });

      expect(generateScopedProviderToken).toHaveBeenCalledTimes(attemptsBeforeRemembered + 1);
      expect(token).toBe("granted-token");
    });

    it("refuses a token that names no lease", async () => {
      const { result, generateScopedProviderToken } = setup();

      await expect(result.current.ensureToken()).rejects.toThrow(/no deployment named/i);
      expect(generateScopedProviderToken).not.toHaveBeenCalled();
    });

    it("clears details.error when the wallet address changes", async () => {
      const addressRef = { current: "akash1aaa" };
      const { result, rerender } = setup({ addressRef });

      await expect(result.current.ensureToken()).rejects.toThrow();
      await vi.waitFor(() => expect(result.current.details.error).toBeInstanceOf(Error));

      addressRef.current = "akash1bbb";
      await act(async () => {
        rerender();
      });

      expect(result.current.details.error).toBeNull();
    });

    it("keeps the token out of browser storage", async () => {
      const setItem = vi.spyOn(Storage.prototype, "setItem");
      const { result } = setup();

      const token = await result.current.ensureToken({ access: SHELL_ACCESS });
      const tokenWrites = setItem.mock.calls.filter(([, value]) => value.includes(token));
      setItem.mockRestore();

      expect(tokenWrites).toEqual([]);
    });

    it.each([
      { name: "an owner of a team", organization: { type: "team" as const, role: "owner" as const } },
      { name: "an admin of a team", organization: { type: "team" as const, role: "admin" as const } },
      { name: "the owner of a personal organization", organization: { type: "personal" as const, role: "owner" as const } }
    ])("gives $name a token bound to the provider whatever the deployments named", async ({ organization }) => {
      const { result, generateScopedProviderToken, generateDeploymentToken } = setup({ organization });

      const token = await result.current.ensureToken({ access: SHELL_ACCESS });

      expect(token).toBe("token-for-akash1provider");
      expect(result.current.tokenMode).toBe("shared");
      expect(result.current.details.usable).toBe(true);
      expect(generateScopedProviderToken).toHaveBeenCalledWith({ provider: "akash1provider", scope: PROVIDER_WIDE_SCOPE });
      expect(generateDeploymentToken).not.toHaveBeenCalled();
    });
  });

  describe("when the caller is limited to some projects", () => {
    it("treats credentials as usable with a wallet and never generates a token for every lease of a provider", async () => {
      const { result, generateScopedProviderToken } = setup({ organization: { role: "member" } });

      await result.current.ensureToken({ access: SHELL_ACCESS });

      expect(result.current.tokenMode).toBe("per-deployment");
      expect(result.current.details.usable).toBe(true);
      expect(generateScopedProviderToken).not.toHaveBeenCalled();
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

    it("surfaces a refused token in details.error and clears it once a token is granted", async () => {
      const generateDeploymentToken = vi.fn().mockRejectedValueOnce("refused").mockResolvedValueOnce("deployment-token");
      const { result } = setup({ organization: { role: "member" }, providerJwt: { generateDeploymentToken } });

      await expect(result.current.ensureToken({ access: SHELL_ACCESS })).rejects.toThrow("refused");
      await vi.waitFor(() => expect(result.current.details.error).toBeInstanceOf(Error));
      await result.current.ensureToken({ access: SHELL_ACCESS });

      await vi.waitFor(() => expect(result.current.details.error).toBeNull());
    });
  });

  describe("when the caller views a team", () => {
    it.each([
      { name: "status", scope: ["status" as const] },
      { name: "logs and events", scope: ["logs" as const, "events" as const] }
    ])("asks for a token that reads the $name of the deployment named", async ({ scope }) => {
      const generateDeploymentToken = vi.fn().mockResolvedValue("deployment-token");
      const { result, generateScopedProviderToken } = setup({ organization: { role: "viewer" }, providerJwt: { generateDeploymentToken } });
      const access = { provider: "akash1provider", dseqs: ["123"], scope };

      const token = await result.current.ensureToken({ access });

      expect(token).toBe("deployment-token");
      expect(result.current.tokenMode).toBe("read-only");
      expect(result.current.details.usable).toBe(true);
      expect(generateDeploymentToken).toHaveBeenCalledWith(access);
      expect(generateScopedProviderToken).not.toHaveBeenCalled();
    });

    it.each([
      { name: "a shell", scope: ["shell" as const] },
      { name: "a shell alongside logs", scope: ["logs" as const, "shell" as const] },
      { name: "an attestation", scope: ["attestation" as const] }
    ])("refuses a token for $name without asking for it", async ({ scope }) => {
      const generateDeploymentToken = vi.fn().mockResolvedValue("deployment-token");
      const { result } = setup({ organization: { role: "viewer" }, providerJwt: { generateDeploymentToken } });

      await expect(result.current.ensureToken({ access: { provider: "akash1provider", dseqs: ["123"], scope } })).rejects.toThrow(/view-only access/i);
      expect(generateDeploymentToken).not.toHaveBeenCalled();
    });

    it("refuses a token that names no deployment", async () => {
      const generateDeploymentToken = vi.fn().mockResolvedValue("deployment-token");
      const { result } = setup({ organization: { role: "viewer" }, providerJwt: { generateDeploymentToken } });

      await expect(result.current.ensureToken()).rejects.toThrow(/no deployment named/i);
      expect(generateDeploymentToken).not.toHaveBeenCalled();
    });

    it("treats credentials as unusable without a wallet", () => {
      const { result } = setup({ organization: { role: "viewer" }, wallet: { hasWallet: false } });

      expect(result.current.details.usable).toBe(false);
    });
  });

  describe("when the caller handles a team's billing", () => {
    it("treats credentials as unusable and never asks for a token", async () => {
      const { result, generateScopedProviderToken, generateDeploymentToken } = setup({ organization: { role: "billing" } });

      await expect(result.current.ensureToken({ access: { ...SHELL_ACCESS, scope: ["status"] } })).rejects.toThrow(/view-only access/i);

      expect(result.current.tokenMode).toBe("view-only");
      expect(result.current.details).toEqual({ usable: false, error: null });
      expect(generateScopedProviderToken).not.toHaveBeenCalled();
      expect(generateDeploymentToken).not.toHaveBeenCalled();
    });
  });

  it.each([
    { name: "loading", organizationState: { isLoading: true }, tokenMode: "pending" },
    { name: "failing to load", organizationState: { isError: true }, tokenMode: "organization-unavailable" },
    { name: "failing to load while still loading", organizationState: { isLoading: true, isError: true }, tokenMode: "organization-unavailable" }
  ])("waits without a token while the active organization is $name", async ({ organizationState, tokenMode }) => {
    const { result, generateScopedProviderToken } = setup({ organizationState });

    await expect(result.current.ensureToken({ access: SHELL_ACCESS })).rejects.toThrow(/not known yet/i);

    expect(result.current.tokenMode).toBe(tokenMode);
    expect(result.current.details.usable).toBe(false);
    expect(generateScopedProviderToken).not.toHaveBeenCalled();
  });

  describe(isLeaseStatusWithheld.name, () => {
    const refusal = new AxiosError("Forbidden", "403", undefined, undefined, mock<AxiosResponse>({ status: 403 }));
    const outage = new AxiosError("Unavailable", "503", undefined, undefined, mock<AxiosResponse>({ status: 503 }));

    it.each([
      { tokenMode: "view-only", error: null, expected: true },
      { tokenMode: "per-deployment", error: refusal, expected: true },
      { tokenMode: "per-deployment", error: outage, expected: false },
      { tokenMode: "per-deployment", error: null, expected: false },
      { tokenMode: "read-only", error: refusal, expected: true },
      { tokenMode: "read-only", error: null, expected: false },
      { tokenMode: "shared", error: refusal, expected: false },
      { tokenMode: "pending", error: null, expected: false }
    ] as const)("answers $expected for $tokenMode polls failing with $error", ({ tokenMode, error, expected }) => {
      expect(isLeaseStatusWithheld(tokenMode, [{ error: null }, { error }])).toBe(expected);
    });
  });

  describe(canRequestScope.name, () => {
    it.each([
      { tokenMode: "shared", scope: ["shell"], expected: true },
      { tokenMode: "per-deployment", scope: ["shell"], expected: true },
      { tokenMode: "read-only", scope: ["status", "events", "logs"], expected: true },
      { tokenMode: "read-only", scope: ["logs", "shell"], expected: false },
      { tokenMode: "read-only", scope: ["send-manifest"], expected: false },
      { tokenMode: "view-only", scope: ["status"], expected: false }
    ] as const)("answers $expected for $scope with $tokenMode tokens", ({ tokenMode, scope, expected }) => {
      expect(canRequestScope(tokenMode, scope)).toBe(expected);
    });
  });

  function setup(input?: {
    wallet?: Partial<ReturnType<typeof useWallet>>;
    providerJwt?: Partial<UseProviderJwtResult>;
    addressRef?: { current: string };
    hasWalletRef?: { current: boolean };
    organization?: Partial<Pick<OrganizationOutput, "type" | "role">>;
    organizationRef?: { current: string };
    organizationState?: { isLoading?: boolean; isError?: boolean };
  }) {
    const organization = input?.organization;
    const hasOrganizationState = !!organization || !!input?.organizationState;
    const generateScopedProviderToken =
      input?.providerJwt?.generateScopedProviderToken ?? vi.fn(async ({ provider }: { provider: string }) => `token-for-${provider}`);
    const generateDeploymentToken = input?.providerJwt?.generateDeploymentToken ?? vi.fn().mockResolvedValue("deployment-token");

    const rendered = setupQuery(() =>
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
          useProviderJwt: () => mock<UseProviderJwtResult>({ generateScopedProviderToken, generateDeploymentToken })
        }
      })
    );

    return {
      ...rendered,
      generateScopedProviderToken: vi.mocked(generateScopedProviderToken),
      generateDeploymentToken: vi.mocked(generateDeploymentToken)
    };
  }
});
