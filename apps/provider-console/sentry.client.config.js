import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,
  integrations: [
    Sentry.replayIntegration(),
    Sentry.browserTracingIntegration({
      tracePropagationTargets: ["localhost", /^https:\/\/provider-console.akash.network/]
    })
  ],
  // Session replay sampling rates
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,

  // Performance monitoring sampling rate
  tracesSampleRate: 0.2,

  // Enable automatic instrumentation for analytics
  enableAutoSessionTracking: true,
  sessionTrackingIntervalMillis: 30000
});
