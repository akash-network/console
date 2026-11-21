import type * as unleashModule from "@unleash/nextjs";
import type { GetServerSidePropsContext } from "next";
import { describe, expect, it, type Mock, vi } from "vitest";
import type { MockProxy } from "vitest-mock-extended";
import { mock } from "vitest-mock-extended";

import type { ServerEnvConfig } from "@src/config/env-config.schema";
import { FeatureFlagService } from "./feature-flag.service";

describe(FeatureFlagService.name, () => {
  describe("getFlag", () => {
    it("returns true if config enables all", async () => {
      const { service } = setup({ enableAll: true });
      const result = await service.getFlag("test-flag");
      expect(result).toBe(true);
    });

    it("evaluates flag and returns true", async () => {
      const { service, unleash, flagsClient } = setup();
      flagsClient.isEnabled.mockReturnValue(true);
      const flag = "feature-x";
      const context = { sessionId: "abc123" };

      const result = await service.getFlag(flag, context);

      expect(unleash.getDefinitions).toHaveBeenCalled();
      expect(unleash.evaluateFlags).toHaveBeenCalled();
      expect(unleash.flagsClient).toHaveBeenCalled();
      expect(flagsClient.isEnabled).toHaveBeenCalledWith(flag);
      expect(result).toBe(true);
    });
  });

  describe("extractSessionId", () => {
    it("extracts session ID from cookies", () => {
      const { service } = setup();
      const ctx = createCtx("unleash-session-id=session123; foo=bar");
      expect(service.extractSessionId(ctx)).toBe("session123");
    });

    it("returns undefined when session ID is missing", () => {
      const { service } = setup();
      const ctx = createCtx("foo=bar; test=value");
      expect(service.extractSessionId(ctx)).toBeUndefined();
    });
  });

  describe("isEnabledForCtx", () => {
    it("returns true if config enables all", async () => {
      const { service } = setup({ enableAll: true });
      const result = await service.isEnabledForCtx("my-flag", createCtx(""));
      expect(result).toBe(true);
    });

    it("evaluates flag and returns result", async () => {
      const { service } = setup();
      const getFlagSpy = vi.spyOn(service, "getFlag").mockResolvedValue(true);
      const ctx = createCtx("unleash-session-id=abc123");

      const result = await service.isEnabledForCtx("my-flag", ctx);

      expect(service.extractSessionId).toHaveBeenCalledWith(ctx);
      expect(getFlagSpy).toHaveBeenCalledWith("my-flag", { sessionId: "abc123" });
      expect(result).toBe(true);
    });
  });

  describe("evaluateTogglesForCtx", () => {
    it("answers no flags when the config enables all, without asking Unleash", async () => {
      const { service, unleash } = setup({ enableAll: true });

      expect(await service.evaluateTogglesForCtx(createCtx("unleash-session-id=abc123"))).toEqual([]);
      expect(unleash.getDefinitions).not.toHaveBeenCalled();
    });

    it("answers every flag as the request's visitor gets it", async () => {
      const { service, unleash } = setup();
      const toggles = [{ name: "template_marketplace", enabled: true, variant: { name: "disabled", enabled: false }, impressionData: false }];
      vi.mocked(unleash.evaluateFlags).mockReturnValue({ toggles });

      expect(await service.evaluateTogglesForCtx(createCtx("unleash-session-id=abc123"), { userId: "user-1" })).toEqual(toggles);
      expect(unleash.getDefinitions).toHaveBeenCalledWith({ fetchOptions: { next: { revalidate: 15 } } });
      expect(unleash.evaluateFlags).toHaveBeenCalledWith({ features: [], version: 1 }, { sessionId: "abc123", userId: "user-1" });
    });

    it("evaluates for a visitor who has no flag session yet", async () => {
      const { service, unleash } = setup();

      await service.evaluateTogglesForCtx(createCtx(""));

      expect(unleash.evaluateFlags).toHaveBeenCalledWith({ features: [], version: 1 }, { sessionId: undefined });
    });
  });

  type UnleashClient = ReturnType<typeof unleashModule.flagsClient>;
  function setup(options?: { enableAll?: boolean; isEnabled?: Mock }): {
    service: FeatureFlagService;
    unleash: typeof unleashModule;
    flagsClient: MockProxy<UnleashClient>;
  } {
    const unleash = mock<typeof unleashModule>();

    const flagsClient = mock<UnleashClient>();
    unleash.getDefinitions.mockResolvedValue({ features: [], version: 1 });
    unleash.evaluateFlags.mockReturnValue({ toggles: [] });
    unleash.flagsClient.mockReturnValue(flagsClient);
    flagsClient.isEnabled.mockReturnValue(!!options?.isEnabled);

    const config = {
      NEXT_PUBLIC_UNLEASH_ENABLE_ALL: options?.enableAll ?? false
    } as ServerEnvConfig;

    const service = new FeatureFlagService(unleash, config);
    vi.spyOn(service, "extractSessionId");

    return { service, unleash, flagsClient };
  }

  function createCtx(cookie: string): GetServerSidePropsContext {
    return {
      req: {
        headers: {
          cookie
        }
      }
    } as unknown as GetServerSidePropsContext;
  }
});
