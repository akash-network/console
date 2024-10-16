import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: "https://e756e9e5316f88fa972329632f5e6434@sentry.praetorapp.com/2",
  integrations: [Sentry.replayIntegration()],
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0
});

const originalConsoleError = console.error;

console.error = (...args) => {
  Sentry.captureMessage(args.join(" "), "error");
  originalConsoleError(...args);
};
