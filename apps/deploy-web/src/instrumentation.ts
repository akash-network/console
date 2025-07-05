import * as Sentry from "@sentry/nextjs";

export async function register() {
  // Note: if you want to override the automatic release value, do not set a
  // `release` value here - use the environment variable `SENTRY_RELEASE`, so
  // that it will also get attached to your source maps
  Sentry.init({
    dsn: process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN,
    // Adjust this value in production, or use tracesSampler for greater control
    tracesSampleRate: 0.01,
    enabled: process.env.NEXT_PUBLIC_SENTRY_ENABLED === "true"
  });

  if (process.env.NEXT_RUNTIME === "nodejs") {
    try {
      await import("@akashnetwork/env-loader");
      const { serverEnvSchema } = await import("./config/env-config.schema");

      serverEnvSchema.parse(process.env);
    } catch (error) {
      console.error("Failed to validate server environment variables", error);
      process.exit(1);
    }
  }
}
