import { HttpLoggerInterceptor } from "@akashnetwork/logging/hono";
import { describe, expect, it } from "vitest";

import { CertificateValidator } from "./services/CertificateValidator/CertificateValidator";
import { ProviderProxy } from "./services/ProviderProxy";
import { ProviderService } from "./services/ProviderService/ProviderService";
import { WebsocketStats } from "./services/WebsocketStats";
import { createContainer } from "./container";

describe(createContainer.name, () => {
  it("builds the service graph from a valid config", () => {
    const container = setup();

    expect(container.wsStats).toBeInstanceOf(WebsocketStats);
    expect(container.providerProxy).toBeInstanceOf(ProviderProxy);
    expect(container.certificateValidator).toBeInstanceOf(CertificateValidator);
    expect(container.providerService).toBeInstanceOf(ProviderService);
    expect(container.httpLoggerInterceptor).toBeInstanceOf(HttpLoggerInterceptor);
  });

  it("parses the untrusted config and applies defaults", () => {
    const container = setup({ REST_API_NODE_URL: "https://rest.example.com" });

    expect(container.appConfig.REST_API_NODE_URL).toBe("https://rest.example.com");
    expect(container.appConfig.PORT).toBe(3040);
    expect(container.appConfig.ALLOW_PROXY_TO_LOCAL_NETWORK).toBe(false);
  });

  it("disables loggers when running in the test environment", () => {
    const container = setup();

    expect(container.appLogger).toBeUndefined();
    expect(container.wsLogger).toBeUndefined();
    expect(container.httpLogger).toBeUndefined();
  });

  it("throws when the config is missing a required field", () => {
    expect(() => createContainer({})).toThrow();
  });

  function setup(config: Record<string, unknown> = { REST_API_NODE_URL: "https://rest.akash.network" }) {
    return createContainer(config);
  }
});
