import type * as unleashModule from "@unleash/nextjs";
import type { MockProxy } from "jest-mock-extended";
import { mock } from "jest-mock-extended";
import type { GetServerSidePropsContext } from "next";
import type { UnleashClient } from "unleash-proxy-client";

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

      const result = await service.getFlag("feature-x", "abc123");

      expect(unleash.getDefinitions).toHaveBeenCalled();
      expect(unleash.evaluateFlags).toHaveBeenCalled();
      expect(unleash.flagsClient).toHaveBeenCalled();
      expect(flagsClient.isEnabled).toHaveBeenCalledWith("feature-x");
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
      const getFlagSpy = jest.spyOn(service, "getFlag").mockResolvedValue(true);
      const ctx = createCtx("unleash-session-id=abc123");

      const result = await service.isEnabledForCtx("my-flag", ctx);

      expect(service.extractSessionId).toHaveBeenCalledWith(ctx);
      expect(getFlagSpy).toHaveBeenCalledWith("my-flag", "abc123");
      expect(result).toBe(true);
    });
  });

  describe("showIfEnabled", () => {
    it("returns props if flag is enabled", async () => {
      const { service } = setup();
      jest.spyOn(service, "isEnabledForCtx").mockResolvedValue(true);

      const result = await service.showIfEnabled("my-flag")(createCtx(""));

      expect(service.isEnabledForCtx).toHaveBeenCalledWith("my-flag", expect.anything());
      expect(result).toEqual({ props: {} });
    });

    it("returns notFound if flag is disabled", async () => {
      const { service } = setup();
      jest.spyOn(service, "isEnabledForCtx").mockResolvedValue(false);

      const result = await service.showIfEnabled("my-flag")(createCtx(""));

      expect(service.isEnabledForCtx).toHaveBeenCalledWith("my-flag", expect.anything());
      expect(result).toEqual({ notFound: true });
    });
  });

  function setup(options?: { enableAll?: boolean; isEnabled?: jest.Mock }): {
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
    jest.spyOn(service, "extractSessionId");

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
