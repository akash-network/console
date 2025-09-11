import { mock } from "jest-mock-extended";
import type { Unleash, UnleashConfig } from "unleash-client";

import type { envConfig } from "@src/core/config/env.config";
import type { ClientInfoContextVariables } from "@src/middlewares/clientInfoMiddleware";
import type { CoreConfigService } from "../core-config/core-config.service";
import type { ExecutionContextService } from "../execution-context/execution-context.service";
import type { FeatureFlagValue } from "./feature-flags";
import { FeatureFlags } from "./feature-flags";
import { FeatureFlagsService } from "./feature-flags.service";

describe(FeatureFlagsService.name, () => {
  it("creates Unleash instance with correct config", async () => {
    const config = {
      UNLEASH_SERVER_API_URL: "http://localhost:4242/api",
      UNLEASH_SERVER_API_TOKEN: "default:development"
    } as const;
    const createClient = jest.fn(() => createUnleashMockClient());
    await setup({
      config,
      createClient
    });

    expect(createClient).toHaveBeenCalledWith(
      expect.objectContaining({
        url: config.UNLEASH_SERVER_API_URL,
        customHeaders: { Authorization: config.UNLEASH_SERVER_API_TOKEN }
      })
    );
  });

  it("skips initialization if FEATURE_FLAGS_ENABLE_ALL is true", async () => {
    const createClient = jest.fn(() => createUnleashMockClient());
    const service = await setup({
      config: { FEATURE_FLAGS_ENABLE_ALL: true },
      skipInitialization: true,
      createClient
    });

    await service.initialize();

    expect(createClient).not.toHaveBeenCalled();
    expect(service.isEnabled(FeatureFlags.NOTIFICATIONS_ALERT_CREATE)).toBe(true);
  });

  it("throws an error if service was not initialized but trying to check feature flag", async () => {
    const service = await setup({ skipInitialization: true });
    expect(() => service.isEnabled(FeatureFlags.NOTIFICATIONS_ALERT_CREATE)).toThrow(/was not initialized/);
  });

  it("calls onChanged callback when feature flag is changed", async () => {
    const client = createUnleashMockClient({
      isEnabledFeatureFlag: jest.fn(() => false)
    });
    const service = await setup({ createClient: () => client });

    const callback = () => {};
    service.onChanged(callback);

    expect(client.on).toHaveBeenCalledTimes(1);
    expect(client.on).toHaveBeenCalledWith("changed", callback);
  });

  it("clears event listeners and destroys client when dispose is called", async () => {
    const client = createUnleashMockClient();
    const service = await setup({ createClient: () => client });

    service.dispose();

    expect(client.destroyWithFlush).toHaveBeenCalledTimes(1);
    expect(client.removeAllListeners).toHaveBeenCalledTimes(1);
  });

  describe("isEnabled", () => {
    it("passes user and environment specific context to Unleash", async () => {
      const client = createUnleashMockClient({
        isEnabledFeatureFlag: jest.fn(() => false)
      });
      const createClient = jest.fn(() => client);
      const currentUser = { id: "123" };
      const httpClientInfo: ClientInfoContextVariables["clientInfo"] = {
        ip: "127.0.0.1",
        userAgent: "test",
        fingerprint: "test"
      };
      const config = {
        DEPLOYMENT_ENV: "development",
        NODE_ENV: "development",
        NETWORK: "mainnet"
      } as const;
      const service = await setup({
        config,
        createClient,
        currentUser,
        httpClientInfo
      });

      service.isEnabled(FeatureFlags.NOTIFICATIONS_ALERT_CREATE);

      expect(client.isEnabled).toHaveBeenCalledWith(FeatureFlags.NOTIFICATIONS_ALERT_CREATE, {
        currentTime: expect.any(Date),
        remoteAddress: httpClientInfo.ip,
        userId: currentUser.id,
        sessionId: undefined,
        environment: config.DEPLOYMENT_ENV,
        properties: {
          userAgent: httpClientInfo.userAgent,
          fingerprint: httpClientInfo.fingerprint,
          nodeEnv: config.NODE_ENV,
          chainNetwork: config.NETWORK
        }
      });
    });

    it("includes sessionId from Unleash cookie in context", async () => {
      const client = createUnleashMockClient({
        isEnabledFeatureFlag: jest.fn(() => false)
      });
      const createClient = jest.fn(() => client);
      const currentUser = { id: "123" };
      const httpClientInfo: ClientInfoContextVariables["clientInfo"] = {
        ip: "127.0.0.1",
        userAgent: "test",
        fingerprint: "test"
      };
      const config = {
        DEPLOYMENT_ENV: "development",
        NODE_ENV: "development",
        NETWORK: "mainnet"
      } as const;
      const service = await setup({
        config,
        createClient,
        currentUser,
        httpClientInfo,
        unleashSessionId: "test-session-123"
      });

      service.isEnabled(FeatureFlags.NOTIFICATIONS_ALERT_CREATE);

      expect(client.isEnabled).toHaveBeenCalledWith(FeatureFlags.NOTIFICATIONS_ALERT_CREATE, {
        currentTime: expect.any(Date),
        remoteAddress: httpClientInfo.ip,
        userId: currentUser.id,
        sessionId: "test-session-123",
        environment: config.DEPLOYMENT_ENV,
        properties: {
          userAgent: httpClientInfo.userAgent,
          fingerprint: httpClientInfo.fingerprint,
          nodeEnv: config.NODE_ENV,
          chainNetwork: config.NETWORK
        }
      });
    });

    it("returns false when feature flag is disabled", async () => {
      const createClient = jest.fn(() =>
        createUnleashMockClient({
          isEnabledFeatureFlag: () => false
        })
      );
      const service = await setup({ createClient });
      const result = service.isEnabled(FeatureFlags.NOTIFICATIONS_ALERT_CREATE);

      expect(result).toBe(false);
    });

    it("return true when feature flag is enabled", async () => {
      const createClient = jest.fn(() =>
        createUnleashMockClient({
          isEnabledFeatureFlag: () => true
        })
      );
      const service = await setup({ createClient });
      const result = service.isEnabled(FeatureFlags.NOTIFICATIONS_ALERT_CREATE);

      expect(result).toBe(true);
    });

    it("returns true for all feature flags if FEATURE_FLAGS_ENABLE_ALL is true", async () => {
      const service = await setup({ config: { FEATURE_FLAGS_ENABLE_ALL: true } });
      expect(service.isEnabled(`unknown-flag-${Date.now()}` as FeatureFlagValue)).toBe(true);
    });
  });

  async function setup(input: {
    config?: Partial<typeof envConfig>;
    createClient?: (config: UnleashConfig) => Unleash;
    currentUser?: { id: string };
    httpClientInfo?: ClientInfoContextVariables["clientInfo"];
    unleashSessionId?: string;
    skipInitialization?: boolean;
  }) {
    const service = new FeatureFlagsService(
      mock<CoreConfigService>({
        get: key =>
          (
            ({
              FEATURE_FLAGS_ENABLE_ALL: false,
              UNLEASH_SERVER_API_URL: "http://localhost:4242/api",
              UNLEASH_SERVER_API_TOKEN: "default:development",
              DEPLOYMENT_ENV: "development",
              NODE_ENV: "development",
              NETWORK: "mainnet",
              ...input.config
            }) as Record<string, any>
          )[key]
      }),
      mock<ExecutionContextService>({
        get: key =>
          (
            ({
              CURRENT_USER: input.currentUser ?? { id: "123" },
              HTTP_CONTEXT: {
                get: (key: string) =>
                  (
                    ({
                      clientInfo: input.httpClientInfo
                    }) as Record<string, unknown>
                  )[key],
                req: {
                  header: (headerName: string) => {
                    if (headerName === "cookie" && input.unleashSessionId) {
                      return `unleash-session-id=${input.unleashSessionId}`;
                    }
                    return undefined;
                  }
                }
              }
            }) as any
          )[key]
      }),
      input.createClient ?? (() => createUnleashMockClient())
    );

    if (!input.skipInitialization) {
      await service.initialize();
    }

    return service;
  }

  function createUnleashMockClient(input?: { isEnabledFeatureFlag?: (featureFlag: FeatureFlagValue) => boolean }) {
    return mock<Unleash>({
      once(event, callback) {
        if (event === "synchronized") {
          process.nextTick(callback);
        }
        return this as Unleash;
      },
      isEnabled: input?.isEnabledFeatureFlag ? input.isEnabledFeatureFlag : () => false
    });
  }
});
