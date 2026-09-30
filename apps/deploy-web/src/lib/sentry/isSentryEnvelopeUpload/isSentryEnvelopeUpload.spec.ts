import { describe, expect, it } from "vitest";

import { isSentryEnvelopeUpload } from "./isSentryEnvelopeUpload";

describe(isSentryEnvelopeUpload.name, () => {
  it("matches an envelope upload to the Sentry ingest", () => {
    const url = "https://o877251.ingest.sentry.io/api/4504/envelope/?sentry_version=7&sentry_key=publicKey&sentry_client=sentry.javascript.nextjs%2F9.47.1";

    expect(isSentryEnvelopeUpload(url)).toBe(true);
  });

  it.each([
    "https://o877251.ingest.sentry.io/api/4504/envelope/?sentry_key=publicKey",
    "https://o877251.ingest.sentry.io/api/4504/envelope/?sentry_client=sentry.javascript.nextjs%2F9.47.1"
  ])("does not match %s, which carries only one of the Sentry auth params", url => {
    expect(isSentryEnvelopeUpload(url)).toBe(false);
  });

  it("does not match a request to the console api", () => {
    expect(isSentryEnvelopeUpload("http://console-api-mainnet-service.prod:3000/v1/bids?dseq=1")).toBe(false);
  });
});
