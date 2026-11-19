import { ApiError } from "@akashnetwork/openapi-sdk";
import { describe, expect, it } from "vitest";

import { readReportRefusal } from "./readReportRefusal";

const RATE_LIMIT_MESSAGE = "You reached the limit of 10 reports per day. Try again in 3 hours.";

describe(readReportRefusal.name, () => {
  it.each([
    [409, "template_already_reported", "already_reported"],
    [409, "template_not_reportable", "not_reportable"],
    [403, "template_report_own_organization", "own_organization"]
  ] as const)("reads a %i %s as %s", (status, code, kind) => {
    expect(readReportRefusal(new ApiError(status, { code, message: "Refused" }, String(status)))).toEqual({ kind });
  });

  it("reads a removed template", () => {
    const error = new ApiError(410, { code: "template_removed", message: "This template was removed", data: { title: "Open WebUI" } }, "410");

    expect(readReportRefusal(error)).toEqual({ kind: "removed" });
  });

  it("passes the server's wording of a rate limit on", () => {
    expect(readReportRefusal(new ApiError(429, { code: "template_rate_limited", message: RATE_LIMIT_MESSAGE }, "429"))).toEqual({
      kind: "rate_limited",
      message: RATE_LIMIT_MESSAGE
    });
  });

  it.each([
    [400, "invalid"],
    [401, "signed_out"],
    [403, "not_readable"],
    [404, "not_readable"]
  ] as const)("reads a %i without a report code as %s", (status, kind) => {
    expect(readReportRefusal(new ApiError(status, { code: "something_else" }, String(status)))).toEqual({ kind });
    expect(readReportRefusal(new ApiError(status, null, String(status)))).toEqual({ kind });
    expect(readReportRefusal(new ApiError(status, { code: 7 }, String(status)))).toEqual({ kind });
  });

  it.each([
    ["a 409 without a report code", new ApiError(409, { code: "conflict" }, "409")],
    ["a 410 without the removed code", new ApiError(410, { code: "gone" }, "410")],
    ["a 429 without the rate limit code", new ApiError(429, { message: "Slow down" }, "429")],
    ["a server error", new ApiError(503, { message: "Unavailable" }, "503")],
    ["a network failure", new TypeError("Failed to fetch")]
  ])("has nothing to say about %s", (_, error) => {
    expect(readReportRefusal(error)).toBeUndefined();
  });
});
