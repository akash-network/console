import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: "http://e756e9e5316f88fa972329632f5e6434@192.168.1.95:9000/2",
  integrations: [Sentry.replayIntegration()],
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0
});
