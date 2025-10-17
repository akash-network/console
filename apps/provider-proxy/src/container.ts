import { LoggerService } from "@akashnetwork/logging";
import { HttpLoggerIntercepter } from "@akashnetwork/logging/hono";
import { createOtelLogger } from "@akashnetwork/logging/otel";
import type { SupportedChainNetworks } from "@akashnetwork/net";
import { netConfig } from "@akashnetwork/net";

import { CertificateValidator, createCertificateValidatorInstrumentation } from "./services/CertificateValidator/CertificateValidator";
import { ProviderProxy } from "./services/ProviderProxy";
import { ProviderService } from "./services/ProviderService/ProviderService";
import { WebsocketStats } from "./services/WebsocketStats";

export function createContainer() {
  const isLoggingDisabled = process.env.NODE_ENV === "test";

  const wsStats = new WebsocketStats();
  const appLogger = isLoggingDisabled ? undefined : createOtelLogger({ name: "app" });
  const providerService = new ProviderService(
    (network: SupportedChainNetworks) => {
      // TEST_CHAIN_NETWORK_URL is hack for functional tests
      // there is no good way to mock external server in nodejs
      // both nock and msw do not work well when I need to use low level API like X509 certificate validation
      // for some reason when those libraries are used I receive MockSocket instead of TLSSocket
      // @see https://github.com/mswjs/msw/discussions/2416
      return process.env.TEST_CHAIN_NETWORK_URL || netConfig.getBaseAPIUrl(network);
    },
    fetch,
    appLogger
  );
  const certificateValidator = new CertificateValidator(
    Date.now,
    providerService,
    isLoggingDisabled ? undefined : createCertificateValidatorInstrumentation(createOtelLogger({ name: "cert-validator" }))
  );
  const providerProxy = new ProviderProxy(certificateValidator);
  const wsLogger = isLoggingDisabled ? undefined : createOtelLogger({ name: "ws" });
  const httpLogger = isLoggingDisabled ? undefined : createOtelLogger({ name: "http" });
  const httpLoggerInterceptor = new HttpLoggerIntercepter(httpLogger);

  return {
    wsStats,
    providerProxy,
    certificateValidator,
    httpLogger,
    httpLoggerInterceptor,
    wsLogger,
    netConfig,
    appLogger,
    providerService
  };
}

export type Container = ReturnType<typeof createContainer>;
