import { LoggerService } from "@akashnetwork/logging";
import * as Sentry from "@sentry/nextjs";

import { isSentryEnvelopeUpload } from "./lib/sentry/isSentryEnvelopeUpload/isSentryEnvelopeUpload";

const logger = new LoggerService({ name: `instrumentation-${process.env.NEXT_RUNTIME}` });

export async function register() {
  // Note: if you want to override the automatic release value, do not set a
  // `release` value here - use the environment variable `SENTRY_RELEASE`, so
  // that it will also get attached to your source maps
  const sentryOptions = {
    dsn: process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN,
    enabled: process.env.NEXT_PUBLIC_SENTRY_ENABLED === "true"
  };

  if (process.env.NEXT_RUNTIME === "nodejs") {
    Sentry.init({
      ...sentryOptions,
      tracesSampleRate: 0.1,
      integrations: [Sentry.nativeNodeFetchIntegration({ ignoreOutgoingRequests: isSentryEnvelopeUpload })]
    });

    try {
      const [, { serverEnvSchema }] = await Promise.all([import("@akashnetwork/env-loader"), import("./config/env-config.schema")]);

      serverEnvSchema.parse(process.env);
    } catch (error) {
      logger.error({ message: "Failed to validate server environment variables", error });
      process.exit(1);
    }
  } else {
    Sentry.init(sentryOptions);
  }
}
