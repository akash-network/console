import { describe, expect, it } from "vitest";

import { redactUrlCredentials } from "./redact-url-credentials";

describe(redactUrlCredentials.name, () => {
  it("replaces the value of a token parameter", () => {
    expect(redactUrlCredentials("https://api.test/v1/product-update-unsubscriptions?token=user-1.signature")).toBe(
      "https://api.test/v1/product-update-unsubscriptions?token=REDACTED"
    );
  });

  it.each(["access_token", "client_secret", "password", "X-Goog-Signature", "api_key", "apiKey", "api-key"])("replaces the value of %s", name => {
    expect(redactUrlCredentials(`/callback?${name}=value-1`)).toBe(`/callback?${name}=REDACTED`);
  });

  it("keeps parameters that carry no credential", () => {
    expect(redactUrlCredentials("https://api.test/v1/deployments?dseq=42&limit=10")).toBe("https://api.test/v1/deployments?dseq=42&limit=10");
  });

  it("replaces only the credential among several parameters", () => {
    expect(redactUrlCredentials("/status/caches?verbose=1&token=shared-1&page=2")).toBe("/status/caches?verbose=1&token=REDACTED&page=2");
  });

  it("keeps the fragment after a credential", () => {
    expect(redactUrlCredentials("/unsubscribe?token=user-1.signature#done")).toBe("/unsubscribe?token=REDACTED#done");
  });

  it("leaves a path that only looks like a credential untouched", () => {
    expect(redactUrlCredentials("https://api.test/v1/api-keys/token")).toBe("https://api.test/v1/api-keys/token");
  });
});
