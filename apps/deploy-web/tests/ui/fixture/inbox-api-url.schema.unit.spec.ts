import { describe, expect, it } from "vitest";

import { inboxApiUrlSchema } from "./inbox-api-url.schema";

describe("inboxApiUrlSchema", () => {
  it("accepts an https URL and strips trailing slashes", () => {
    expect(inboxApiUrlSchema.parse("https://console-e2e-inbox.example.workers.dev/")).toBe("https://console-e2e-inbox.example.workers.dev");
  });

  it("trims surrounding whitespace before validating", () => {
    expect(inboxApiUrlSchema.parse("  https://inbox.test  ")).toBe("https://inbox.test");
  });

  it("accepts http only for loopback hosts used in local development", () => {
    expect(inboxApiUrlSchema.parse("http://localhost:8787")).toBe("http://localhost:8787");
    expect(inboxApiUrlSchema.parse("http://127.0.0.1:8787")).toBe("http://127.0.0.1:8787");
    expect(inboxApiUrlSchema.parse("http://[::1]:8787")).toBe("http://[::1]:8787");
  });

  it("rejects http on a non-loopback host", () => {
    expect(() => inboxApiUrlSchema.parse("http://inbox.example.com")).toThrow(/must use https/);
  });

  it("rejects non-http schemes", () => {
    expect(() => inboxApiUrlSchema.parse("ftp://inbox.example.com")).toThrow(/must use https/);
  });

  it("rejects a relative or malformed URL", () => {
    expect(() => inboxApiUrlSchema.parse("/messages")).toThrow(/must be an absolute URL/);
  });

  it("rejects an empty value", () => {
    expect(() => inboxApiUrlSchema.parse("")).toThrow();
  });
});
