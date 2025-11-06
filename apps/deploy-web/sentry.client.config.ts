// This file configures the initialization of Sentry on the browser.
// The config you add here will be used whenever a page is visited.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import { eventFiltersIntegration, init as initSentry, thirdPartyErrorFilterIntegration } from "@sentry/nextjs";

initSentry({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  // Adjust this value in production, or use tracesSampler for greater control
  tracesSampleRate: 0.1,
  enabled: process.env.NEXT_PUBLIC_SENTRY_ENABLED === "true",
  // propagate sentry-trace and baggage headers to internal API only
  // everything else will be done with custom interceptor
  tracePropagationTargets: [/^\/api\//],
  integrations: [
    eventFiltersIntegration({
      allowUrls: [/https?:\/\/[^.]+\.akash\.network/],
      denyUrls: [/^chrome-extension:\/\//]
    }),
    thirdPartyErrorFilterIntegration({
      filterKeys: [process.env.NEXT_PUBLIC_SENTRY_APPLICATION_KEY!],
      behaviour: "drop-error-if-exclusively-contains-third-party-frames"
    })
  ]
  // ...
  // Note: if you want to override the automatic release value, do not set a
  // `release` value here - use the environment variable `SENTRY_RELEASE`, so
  // that it will also get attached to your source maps
});
