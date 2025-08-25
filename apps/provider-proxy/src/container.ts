import { LoggerService } from "@akashnetwork/logging";
import { HttpLoggerIntercepter } from "@akashnetwork/logging/hono";
import type { SupportedChainNetworks } from "@akashnetwork/net";
import { createNetConfig } from "@akashnetwork/net";

import { CertificateValidator, createCertificateValidatorInstrumentation } from "./services/CertificateValidator";
import { FeatureFlags } from "./services/feature-flags/feature-flags";
import { FeatureFlagsService } from "./services/feature-flags/feature-flags.service";
import { ProviderProxy } from "./services/ProviderProxy";
import { ProviderService } from "./services/ProviderService/ProviderService";
import { WebsocketStats } from "./services/WebsocketStats";

export function createContainer() {
  const isLoggingDisabled = process.env.NODE_ENV === "test";

  const wsStats = new WebsocketStats();
  const appLogger = isLoggingDisabled ? undefined : new LoggerService({ name: "app" });
  const featureFlagsService = new FeatureFlagsService();
  const netConfig = createNetConfig({ useProxyUrls: featureFlagsService.isEnabled(FeatureFlags.USE_PROXY_URLS) });

  const providerService = new ProviderService(
    (network: SupportedChainNetworks) => {
      // TEST_CHAIN_NETWORK_URL is hack for functional tests
      // there is no good way to mock external server in nodejs
      // both nock and msw do not work well when I need to use low level API like X509 certificate validation
      // for some reason when these libraries are used I receive MockSocket instead of TLSSocket
      // @see https://github.com/mswjs/msw/discussions/2416
      return process.env.TEST_CHAIN_NETWORK_URL || netConfig.getBaseAPIUrl(network);
    },
    fetch,
    appLogger
  );
  const certificateValidator = new CertificateValidator(
    Date.now,
    providerService,
    isLoggingDisabled ? undefined : createCertificateValidatorInstrumentation(new LoggerService({ name: "cert-validator" }))
  );
  const providerProxy = new ProviderProxy(certificateValidator);
  const wsLogger = isLoggingDisabled ? undefined : new LoggerService({ name: "ws" });
  const httpLogger = isLoggingDisabled ? undefined : new LoggerService({ name: "http" });
  const httpLoggerInterceptor = new HttpLoggerIntercepter(httpLogger);

  return {
    wsStats,
    providerProxy,
    certificateValidator,
    httpLogger,
    httpLoggerInterceptor,
    wsLogger,
    netConfig,
    featureFlagsService,
    appLogger,
    providerService
  };
}

export type Container = ReturnType<typeof createContainer>;
