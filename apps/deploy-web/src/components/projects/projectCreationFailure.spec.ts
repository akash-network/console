import { ApiError } from "@akashnetwork/openapi-sdk";
import { describe, expect, it } from "vitest";

import { describeProjectCreationFailure } from "./projectCreationFailure";

describe(describeProjectCreationFailure.name, () => {
  it("tells the organization's project limit and where to ask for more", () => {
    const error = new ApiError(403, { code: "project_limit_reached", data: { limit: 10 } }, "POST → 403");

    expect(describeProjectCreationFailure(error)).toBe(
      "This organization has reached its limit of 10 projects. Delete a project it no longer needs, or contact support@akash.network to raise the limit."
    );
  });

  it.each([
    ["no data", { code: "project_limit_reached" }],
    ["a limit that is not a number", { code: "project_limit_reached", data: { limit: "10" } }],
    ["a limit of zero", { code: "project_limit_reached", data: { limit: 0 } }],
    ["a fractional limit", { code: "project_limit_reached", data: { limit: 2.5 } }]
  ])("tells the organization reached its project limit when the api reports %s", (_, body) => {
    const error = new ApiError(403, body, "POST → 403");

    expect(describeProjectCreationFailure(error)).toBe(
      "This organization has reached the number of projects it can have. Delete a project it no longer needs, or contact support@akash.network to raise the limit."
    );
  });

  it.each([
    ["another refusal", new ApiError(403, { code: "forbidden", data: { limit: 10 } }, "POST → 403")],
    ["a failure that is not from the api", new Error("network down")]
  ])("asks to try again after %s", (_, error) => {
    expect(describeProjectCreationFailure(error)).toBe("Try again in a moment.");
  });
});
