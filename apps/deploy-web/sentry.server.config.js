// This file configures the initialization of Sentry on the server.
// The config you add here will be used whenever the server handles a request.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

const SENTRY_DSN = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn: SENTRY_DSN,
  // Adjust this value in production, or use tracesSampler for greater control
  tracesSampleRate: 0.01,
  enabled: process.env.NEXT_PUBLIC_SENTRY_ENABLED === "true",
  integrations: [
    Sentry.thirdPartyErrorFilterIntegration({
      filterKeys: [process.env.NEXT_PUBLIC_SENTRY_APPLICATION_KEY],
      behaviour: "drop-error-if-contains-third-party-frames"
    })
  ]
  // ...
  // Note: if you want to override the automatic release value, do not set a
  // `release` value here - use the environment variable `SENTRY_RELEASE`, so
  // that it will also get attached to your source maps
});
