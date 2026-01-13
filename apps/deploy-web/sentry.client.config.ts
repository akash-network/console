// This file configures the initialization of Sentry on the browser.
// The config you add here will be used whenever a page is visited.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import type { Event } from "@sentry/nextjs";
import { init as initSentry, thirdPartyErrorFilterIntegration } from "@sentry/nextjs";

function hasExtensionFrames(event: Event): boolean {
  return (
    event.exception?.values?.some(value =>
      value.stacktrace?.frames?.some(frame => frame.filename?.startsWith("chrome-extension://") || frame.filename?.startsWith("moz-extension://"))
    ) ?? false
  );
}

initSentry({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  // Adjust this value in production, or use tracesSampler for greater control
  tracesSampleRate: 0.1,
  enabled: process.env.NEXT_PUBLIC_SENTRY_ENABLED === "true",
  ignoreErrors: [
    // WalletConnect timeout - expected when users don't complete wallet connection
    /Proposal expired/
  ],
  // propagate sentry-trace and baggage headers to internal API only
  // everything else will be done with custom interceptor
  tracePropagationTargets: [/^\/api\//, /^\/_next\//],
  beforeSend(event) {
    // Drop errors that originate from browser extensions
    if (hasExtensionFrames(event)) {
      return null;
    }
    return event;
  },
  integrations: [
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
