import { ApiError } from "@akashnetwork/openapi-sdk";
import { describe, expect, it } from "vitest";

import { readPublishRefusal, readTemplateRateLimit } from "./readPublishRefusal";

const RATE_LIMIT_MESSAGE = "You reached the limit of 10 published templates per day. Try again in 3 hours.";

describe(readPublishRefusal.name, () => {
  it.each([
    [403, "template_publish_requirements_unmet", "requirements_unmet"],
    [400, "template_publish_checks_failed", "checks_failed"],
    [409, "template_terms_version_mismatch", "terms_changed"]
  ] as const)("reads a %i %s as %s", (status, code, kind) => {
    expect(readPublishRefusal(new ApiError(status, { code, message: "Refused" }, String(status)))).toEqual({ kind });
  });

  it("passes the server's wording of a rate limit on", () => {
    expect(readPublishRefusal(new ApiError(429, { code: "template_rate_limited", message: RATE_LIMIT_MESSAGE }, "429"))).toEqual({
      kind: "rate_limited",
      message: RATE_LIMIT_MESSAGE
    });
  });

  it.each([403, 404])("reads a %i without a publish code as no longer allowed", status => {
    expect(readPublishRefusal(new ApiError(status, { code: "organization_forbidden" }, String(status)))).toEqual({ kind: "not_allowed" });
    expect(readPublishRefusal(new ApiError(status, null, String(status)))).toEqual({ kind: "not_allowed" });
  });

  it.each([
    ["a validation failure", new ApiError(400, { code: "validation_error" }, "400")],
    ["a refusal whose code is not text", new ApiError(400, { code: 7 }, "400")],
    ["a refusal with a text body", new ApiError(400, "template_publish_checks_failed", "400")],
    ["a server error", new ApiError(503, { message: "Unavailable" }, "503")],
    ["a network failure", new TypeError("Failed to fetch")]
  ])("has nothing to say about %s", (_, error) => {
    expect(readPublishRefusal(error)).toBeUndefined();
  });
});

describe(readTemplateRateLimit.name, () => {
  it("returns the server's message", () => {
    expect(readTemplateRateLimit(new ApiError(429, { code: "template_rate_limited", message: RATE_LIMIT_MESSAGE }, "429"))).toBe(RATE_LIMIT_MESSAGE);
  });

  it.each([
    ["missing", undefined],
    ["blank", ""],
    ["not text", 12]
  ])("falls back to its own wording when the message is %s", (_, message) => {
    expect(readTemplateRateLimit(new ApiError(429, { code: "template_rate_limited", message }, "429"))).toBe(
      "You reached a limit on templates. Try again later."
    );
  });

  it.each([
    ["another 429", new ApiError(429, { code: "too_many_requests", message: "Slow down" }, "429")],
    ["a 429 without a body", new ApiError(429, null, "429")],
    ["another failure", new Error("template_rate_limited")]
  ])("ignores %s", (_, error) => {
    expect(readTemplateRateLimit(error)).toBeUndefined();
  });
});
