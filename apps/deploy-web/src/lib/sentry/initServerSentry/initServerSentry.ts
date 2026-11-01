import * as Sentry from "@sentry/nextjs";

import type { SentryHttpModule } from "../createTimeoutHttpModule/createTimeoutHttpModule";
import { isSentryEnvelopeUpload } from "../isSentryEnvelopeUpload/isSentryEnvelopeUpload";

export function initServerSentry(input: { runtime: string | undefined; httpModule?: SentryHttpModule }, sentry: typeof Sentry = Sentry) {
  const options = {
    dsn: process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN,
    enabled: process.env.NEXT_PUBLIC_SENTRY_ENABLED === "true",
    beforeSend: withoutRequestCredentials,
    beforeSendTransaction: withoutRequestCredentials
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

/** Sentry attaches the request of a failing API route to its event, and its body, cookies and authorization must stay on the server. */
function withoutRequestCredentials<T extends Sentry.Event>(event: T): T {
  if (!event.request) return event;

  const { data, cookies, headers, ...request } = event.request;
  const { cookie, authorization, ...safeHeaders } = headers ?? {};

  return { ...event, request: { ...request, headers: safeHeaders } };
}
