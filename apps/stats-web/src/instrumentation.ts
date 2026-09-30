import { init as initSentry, nativeNodeFetchIntegration } from "@sentry/nextjs";

import { createLogger } from "./lib/createLogger/createLogger";
import { isSentryEnvelopeUpload } from "./lib/sentry/isSentryEnvelopeUpload/isSentryEnvelopeUpload";

const logger = createLogger({ name: `instrumentation-${process.env.NEXT_RUNTIME}` });

/** At 0.1, stats-web's page traffic alone used most of the shared monthly Sentry span quota. */
const SERVER_TRACES_SAMPLE_RATE = 0.02;

export async function register() {
  // Note: if you want to override the automatic release value, do not set a
  // `release` value here - use the environment variable `SENTRY_RELEASE`, so
  // that it will also get attached to your source maps
  const sentryOptions = {
    dsn: process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN,
    enabled: process.env.NEXT_PUBLIC_SENTRY_ENABLED === "true"
  };

  if (process.env.NEXT_RUNTIME === "nodejs") {
    initSentry({
      ...sentryOptions,
      tracesSampleRate: SERVER_TRACES_SAMPLE_RATE,
      integrations: defaults => [...withoutConsoleIntegration(defaults), nativeNodeFetchIntegration({ ignoreOutgoingRequests: isSentryEnvelopeUpload })]
    });

    try {
      const [, { serverEnvSchema }] = await Promise.all([import("@akashnetwork/env-loader"), import("./config/env-config.schema")]);

      serverEnvSchema.parse(process.env);
    } catch (error) {
      logger.error({ message: "Failed to validate server environment variables", error });
      process.exit(1);
    }
  } else {
    initSentry({ ...sentryOptions, integrations: withoutConsoleIntegration });
  }
}

/** Sentry's console.error patch crashes the process when Node's util.inspect fails on Next.js internal error objects. */
function withoutConsoleIntegration<T extends { name: string }>(integrations: T[]) {
  return integrations.filter(integration => integration.name !== "Console");
}
