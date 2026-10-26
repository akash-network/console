import * as Sentry from "@sentry/nextjs";

import type { SentryHttpModule } from "../createTimeoutHttpModule/createTimeoutHttpModule";
import { isSentryEnvelopeUpload } from "../isSentryEnvelopeUpload/isSentryEnvelopeUpload";

export function initServerSentry(input: { runtime: string | undefined; httpModule?: SentryHttpModule }, sentry: typeof Sentry = Sentry) {
  const options = {
    dsn: process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN,
    enabled: process.env.NEXT_PUBLIC_SENTRY_ENABLED === "true"
  };

  if (input.runtime !== "nodejs") {
    sentry.init(options);
    return;
  }

  sentry.init({
    ...options,
    tracesSampleRate: 0.1,
    transportOptions: { httpModule: input.httpModule },
    integrations: [sentry.nativeNodeFetchIntegration({ ignoreOutgoingRequests: isSentryEnvelopeUpload })]
  });
}
