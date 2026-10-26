import type { makeNodeTransport } from "@sentry/nextjs";
import https from "node:https";

type SentryHttpModule = NonNullable<Parameters<typeof makeNodeTransport>[0]["httpModule"]>;

/** Sentry's node transport never times out an upload, and every per-request flush leaks a promise reaction onto each upload still pending. */
export const SENTRY_UPLOAD_TIMEOUT_MS = 5_000;

/** Sentry passes its own agent with every upload, and without a proxy that agent picks the protocol, so https.request also carries http DSNs. */
export function createTimeoutHttpModule(timeoutMs = SENTRY_UPLOAD_TIMEOUT_MS): SentryHttpModule {
  return {
    request(options, callback) {
      const request = https.request(options, callback);
      request.setTimeout(timeoutMs, () => request.destroy(new Error(`Sentry upload timed out after ${timeoutMs} ms`)));
      return request;
    }
  };
}
