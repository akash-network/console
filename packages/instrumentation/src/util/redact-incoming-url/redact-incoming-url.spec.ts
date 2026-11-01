import type { IncomingMessage } from "node:http";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import { redactIncomingUrlCredentials } from "./redact-incoming-url";

describe(redactIncomingUrlCredentials.name, () => {
  it("rewrites the url attributes of a request that carries a credential in its query string", () => {
    const request = incomingRequest({ url: "/v1/product-update-unsubscriptions?token=user-1.signature&lang=en" });

    expect(redactIncomingUrlCredentials(request)).toEqual({
      "http.target": "/v1/product-update-unsubscriptions?token=REDACTED&lang=en",
      "http.url": "http://console-api.test/v1/product-update-unsubscriptions?token=REDACTED&lang=en",
      "url.query": "token=REDACTED&lang=en"
    });
  });

  it("adds no attribute for a request without a credential", () => {
    expect(redactIncomingUrlCredentials(incomingRequest({ url: "/v1/deployments?dseq=42" }))).toEqual({});
  });

  it("adds no attribute for a request without a url", () => {
    expect(redactIncomingUrlCredentials(incomingRequest({ url: undefined }))).toEqual({});
  });

  function incomingRequest(input: { url: string | undefined }) {
    return mock<IncomingMessage>({ url: input.url, headers: { host: "console-api.test" } });
  }
});
