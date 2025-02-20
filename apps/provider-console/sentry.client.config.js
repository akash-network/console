import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,
  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration() // Use this instead of new Sentry.Replay()
  ],

  // Performance Monitoring
  tracesSampleRate: 1.0, // Capture all transactions (adjust in production)
  profilesSampleRate: 0.1, // Capture CPU profiles (useful for debugging performance)

  // Session Replay Configuration
  replaysSessionSampleRate: 0.1, // Capture 10% of sessions for replay
  replaysOnErrorSampleRate: 1.0, // Always capture sessions when an error occurs

  // Additional Debugging Options
  normalizeDepth: 5, // Increase depth of serialized objects for better error insights
  ignoreErrors: [
    "Non-Error promise rejection", // Ignore common harmless errors
    "ResizeObserver loop limit exceeded"
  ]
});
