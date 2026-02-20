// This file configures the initialization of Sentry on the browser.
// The config you add here will be used whenever a page is visited.
// https://docs.sentry.io/platforms/javascript/guides/react/

import { browserTracingIntegration, inboundFiltersIntegration, init as initSentry, thirdPartyErrorFilterIntegration } from "@sentry/react";

initSentry({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  // Adjust this value in production, or use tracesSampler for greater control
  tracesSampleRate: 0.1,
  enabled: import.meta.env.VITE_SENTRY_ENABLED === "true",
  integrations: [
    browserTracingIntegration(),
    // Filter out errors originating from browser extensions
    // Note: uses inboundFiltersIntegration (not eventFiltersIntegration) to override defaultIntegrations
    inboundFiltersIntegration({
      denyUrls: [/^chrome-extension:\/\//, /^moz-extension:\/\//]
    }),
    thirdPartyErrorFilterIntegration({
      filterKeys: [import.meta.env.VITE_SENTRY_APPLICATION_KEY || ""],
      behaviour: "drop-error-if-exclusively-contains-third-party-frames"
    })
  ]
  // ...
  // Note: if you want to override the automatic release value, do not set a
  // `release` value here - use the environment variable `SENTRY_RELEASE`, so
  // that it will also get attached to your source maps
});
