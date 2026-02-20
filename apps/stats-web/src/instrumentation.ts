import { init as initSentry } from "@sentry/nextjs";

import { createLogger } from "./lib/createLogger/createLogger";

const logger = createLogger({ name: `instrumentation-${process.env.NEXT_RUNTIME}` });

export async function register() {
  // Note: if you want to override the automatic release value, do not set a
  // `release` value here - use the environment variable `SENTRY_RELEASE`, so
  // that it will also get attached to your source maps
  initSentry({
    dsn: process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN,
    // Adjust this value in production, or use tracesSampler for greater control
    tracesSampleRate: 0.1,
    enabled: process.env.NEXT_PUBLIC_SENTRY_ENABLED === "true",
    // Disable consoleIntegration on the server to prevent Sentry's console.error patch
    // from crashing the process when Node's util.inspect fails on Next.js internal error objects
    integrations: defaults => defaults.filter(i => i.name !== "Console")
  });

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
