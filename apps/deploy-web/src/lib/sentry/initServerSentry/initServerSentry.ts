import * as Sentry from "@sentry/nextjs";

import { isSentryEnvelopeUpload } from "../isSentryEnvelopeUpload/isSentryEnvelopeUpload";

export function initServerSentry(runtime: string | undefined, sentry: typeof Sentry = Sentry) {
  const options = {
    dsn: process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN,
    enabled: process.env.NEXT_PUBLIC_SENTRY_ENABLED === "true"
  };

  if (runtime !== "nodejs") {
    sentry.init(options);
    return;
  }

  sentry.init({
    ...options,
    tracesSampleRate: 0.1,
    integrations: [sentry.nativeNodeFetchIntegration({ ignoreOutgoingRequests: isSentryEnvelopeUpload })]
  });
}
