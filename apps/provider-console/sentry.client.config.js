import * as Sentry from "@sentry/nextjs";

console.log(process.env.SENTRY_AUTH_TOKEN);

Sentry.init({
  dsn: "https://e756e9e5316f88fa972329632f5e6434@sentry.praetorapp.com/2",
  enabled: process.env.NODE_ENV !== 'development', // Disable Sentry on localhost
  integrations: [Sentry.replayIntegration()],
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0
});

const originalConsoleError = console.error;

console.error = (...args) => {
  Sentry.captureMessage(args.join(" "), "error");
  originalConsoleError(...args);
};
