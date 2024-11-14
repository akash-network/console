import * as Sentry from "@sentry/nextjs";

console.log(process.env.SENTRY_AUTH_TOKEN);

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,
  integrations: [Sentry.replayIntegration()],
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0
});

const originalConsoleError = console.error;

console.error = (...args) => {
  Sentry.captureMessage(args.join(" "), "error");
  originalConsoleError(...args);
};
