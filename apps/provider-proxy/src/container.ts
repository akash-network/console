import { HttpLoggerInterceptor } from "@akashnetwork/logging/hono";
import { createOtelLogger } from "@akashnetwork/logging/otel";

import { appConfigSchema } from "./config/env.config";
import { CertificateValidator, createCertificateValidatorInstrumentation } from "./services/CertificateValidator/CertificateValidator";
import { ProviderProxy } from "./services/ProviderProxy";
import { ProviderService } from "./services/ProviderService/ProviderService";
import { WebsocketStats } from "./services/WebsocketStats";

export function createContainer(untrustedConfig: Record<string, unknown>) {
  const appConfig = appConfigSchema.parse(untrustedConfig);
  const isLoggingDisabled = process.env.NODE_ENV === "test";

  const wsStats = new WebsocketStats();
  const appLogger = isLoggingDisabled ? undefined : createOtelLogger({ name: "app" });
  const providerService = new ProviderService(appConfig.REST_API_NODE_URL, fetch, appLogger);
  const certificateValidator = new CertificateValidator(
    Date.now,
    providerService,
    isLoggingDisabled ? undefined : createCertificateValidatorInstrumentation(createOtelLogger({ name: "cert-validator" }))
  );
  const providerProxy = new ProviderProxy(certificateValidator);
  const wsLogger = isLoggingDisabled ? undefined : createOtelLogger({ name: "ws" });
  const httpLogger = isLoggingDisabled ? undefined : createOtelLogger({ name: "http" });
  const httpLoggerInterceptor = new HttpLoggerInterceptor(httpLogger);

  return {
    wsStats,
    providerProxy,
    certificateValidator,
    httpLogger,
    httpLoggerInterceptor,
    wsLogger,
    appLogger,
    providerService,
    appConfig
  };
}

export type Container = ReturnType<typeof createContainer>;
