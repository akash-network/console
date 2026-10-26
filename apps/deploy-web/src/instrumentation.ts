import { LoggerService } from "@akashnetwork/logging";

import { initServerSentry } from "./lib/sentry/initServerSentry/initServerSentry";

const logger = new LoggerService({ name: `instrumentation-${process.env.NEXT_RUNTIME}` });

export async function register() {
  // Note: if you want to override the automatic release value, do not set a
  // `release` value here - use the environment variable `SENTRY_RELEASE`, so
  // that it will also get attached to your source maps
  initServerSentry({ runtime: process.env.NEXT_RUNTIME, httpModule: await loadSentryHttpModule() });

  if (process.env.NEXT_RUNTIME === "nodejs") {
    try {
      const [, { serverEnvSchema }] = await Promise.all([import("@akashnetwork/env-loader"), import("./config/env-config.schema")]);

      serverEnvSchema.parse(process.env);
    } catch (error) {
      logger.error({ message: "Failed to validate server environment variables", error });
      process.exit(1);
    }
  }
}

async function loadSentryHttpModule() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { createTimeoutHttpModule } = await import("./lib/sentry/createTimeoutHttpModule/createTimeoutHttpModule");
    return createTimeoutHttpModule();
  }

  return undefined;
}
