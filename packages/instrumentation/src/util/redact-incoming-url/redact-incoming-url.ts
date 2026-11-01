import { redactUrlCredentials } from "@akashnetwork/logging/url";
import type { Attributes } from "@opentelemetry/api";
import type { IncomingMessage } from "node:http";

/** HttpInstrumentation redacts query parameters only on outgoing spans, so incoming spans get their URL attributes rewritten here. */
export function redactIncomingUrlCredentials(request: IncomingMessage): Attributes {
  const target = request.url ?? "/";
  const redactedTarget = redactUrlCredentials(target);
  if (redactedTarget === target) return {};

  const redactedUrl = new URL(redactedTarget, `http://${request.headers.host}`);

  return {
    "http.target": redactedTarget,
    "http.url": redactedUrl.toString(),
    "url.query": redactedUrl.search.slice(1)
  };
}
