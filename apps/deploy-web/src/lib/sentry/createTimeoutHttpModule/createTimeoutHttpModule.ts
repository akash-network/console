import type { makeNodeTransport } from "@sentry/nextjs";
import http from "node:http";
import https from "node:https";

export type SentryHttpModule = NonNullable<Parameters<typeof makeNodeTransport>[0]["httpModule"]>;

/** Sentry's node transport never times out an upload, and every per-request flush leaks a promise reaction onto each upload still pending. */
export const SENTRY_UPLOAD_TIMEOUT_MS = 5_000;

export function createTimeoutHttpModule(timeoutMs = SENTRY_UPLOAD_TIMEOUT_MS): SentryHttpModule {
  return {
    request(options: http.RequestOptions, callback) {
      const request = options.protocol === "http:" ? http.request(options, callback) : https.request(options, callback);
      request.setTimeout(timeoutMs, () => request.destroy(new Error(`Sentry upload timed out after ${timeoutMs} ms`)));
      return request;
    }
  };
}
