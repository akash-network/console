import { createChainNodeWebSDK } from "@akashnetwork/chain-sdk/web";
import type { LoggerService } from "@akashnetwork/logging";
import { HttpLoggerInterceptor } from "@akashnetwork/logging/hono";
import { createOtelLogger } from "@akashnetwork/logging/otel";

import type { AppConfig } from "./config/env.config";
import { appConfigSchema } from "./config/env.config";
import { CertificateValidator, createCertificateValidatorInstrumentation } from "./services/CertificateValidator/CertificateValidator";
import { createProviderConnectionTrackerInstrumentation, ProviderConnectionTracker } from "./services/ProviderConnectionTracker/ProviderConnectionTracker";
import { ProviderProxy } from "./services/ProviderProxy";
import { ProviderService } from "./services/ProviderService/ProviderService";
import { WebsocketStats } from "./services/WebsocketStats";
import { createForbidPrivateNetworkLookup } from "./utils/createForbidPrivateNetworkLookup/createForbidPrivateNetworkLookup";

export interface Container {
  wsStats: WebsocketStats;
  providerProxy: ProviderProxy;
  certificateValidator: CertificateValidator;
  providerConnectionTracker: ProviderConnectionTracker | undefined;
  httpLogger: LoggerService | undefined;
  httpLoggerInterceptor: HttpLoggerInterceptor;
  wsLogger: LoggerService | undefined;
  appLogger: LoggerService | undefined;
  providerService: ProviderService;
  appConfig: AppConfig;
}

export function createContainer(untrustedConfig: Record<string, unknown>): Container {
  const appConfig = appConfigSchema.parse(untrustedConfig);
  const isLoggingDisabled = process.env.NODE_ENV === "test";

  const wsStats = new WebsocketStats();
  const appLogger = isLoggingDisabled ? undefined : createOtelLogger({ name: "app" });
  const chainSdk = createChainNodeWebSDK({
    query: {
      baseUrl: appConfig.REST_API_NODE_URL,
      transportOptions: {
        retry: {
          maxAttempts: 3
        }
      }
    }
  });
  const providerService = new ProviderService(chainSdk, appLogger);
  const certificateValidator = new CertificateValidator(
    Date.now,
    providerService,
    isLoggingDisabled ? undefined : createCertificateValidatorInstrumentation(createOtelLogger({ name: "cert-validator" }))
  );
  const providerConnectionTracker = appConfig.PROVIDER_UNREACHABLE_TRACKING_ENABLED
    ? new ProviderConnectionTracker(
        Date.now,
        {
          failureThreshold: appConfig.PROVIDER_UNREACHABLE_FAILURE_THRESHOLD,
          cooldownMs: appConfig.PROVIDER_UNREACHABLE_COOLDOWN_MS
        },
        isLoggingDisabled ? undefined : createProviderConnectionTrackerInstrumentation(createOtelLogger({ name: "connection-tracker" }))
      )
    : undefined;
  const providerProxy = new ProviderProxy(
    certificateValidator,
    appConfig.ALLOW_PROXY_TO_LOCAL_NETWORK ? undefined : createForbidPrivateNetworkLookup(),
    providerConnectionTracker
  );
  const wsLogger = isLoggingDisabled ? undefined : createOtelLogger({ name: "ws" });
  const httpLogger = isLoggingDisabled ? undefined : createOtelLogger({ name: "http" });
  const httpLoggerInterceptor = new HttpLoggerInterceptor(httpLogger);

  return {
    wsStats,
    providerProxy,
    certificateValidator,
    providerConnectionTracker,
    httpLogger,
    httpLoggerInterceptor,
    wsLogger,
    appLogger,
    providerService,
    appConfig
  };
}
