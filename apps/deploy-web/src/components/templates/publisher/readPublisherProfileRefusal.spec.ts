import { ApiError } from "@akashnetwork/openapi-sdk";
import { describe, expect, it } from "vitest";

import { describePublisherProfileRefusal, readPublisherProfileRefusal } from "./readPublisherProfileRefusal";

describe(readPublisherProfileRefusal.name, () => {
  it("reads the server's issues from a 400, naming the field each is about", () => {
    const error = new ApiError(
      400,
      {
        error: "BadRequestError",
        code: "validation_error",
        data: [
          { path: ["data", "bio"], message: "String must contain at most 300 character(s)" },
          { path: ["data", "links", 0, "url"], message: "The link must start with https://" },
          { path: ["data", "links", 2, "label"], message: "The name cannot contain control characters" },
          { path: ["data", "links"], message: "Array must contain at most 3 element(s)" },
          { path: ["data"], message: "Change the bio or the links" }
        ]
      },
      "PATCH /v1/template-publishers/current → 400"
    );

    expect(readPublisherProfileRefusal(error)).toEqual({
      kind: "invalid",
      issues: [
        "Bio: String must contain at most 300 character(s)",
        "Link 1: The link must start with https://",
        "Link 3 label: The name cannot contain control characters",
        "Links: Array must contain at most 3 element(s)",
        "Change the bio or the links"
      ]
    });
  });

  it("skips an issue without a message and one with no path", () => {
    const error = new ApiError(400, { data: [{ path: ["data", "bio"] }, { path: ["data", "bio"], message: "" }, { message: "Something else" }, null] }, "400");

    expect(readPublisherProfileRefusal(error)).toEqual({ kind: "invalid", issues: ["Something else"] });
  });

  it("skips an issue whose message is not text and names a field by its name whatever follows it", () => {
    const error = new ApiError(
      400,
      {
        data: [
          { path: ["data", "bio"], message: 42 },
          { path: ["data", "bio", 0], message: "Unexpected" }
        ]
      },
      "400"
    );

    expect(readPublisherProfileRefusal(error)).toEqual({ kind: "invalid", issues: ["Bio: Unexpected"] });
  });

  it("leaves a field it does not know unnamed", () => {
    const error = new ApiError(400, { data: [{ path: ["data", "avatar"], message: "Unrecognized key" }] }, "400");

    expect(readPublisherProfileRefusal(error)).toEqual({ kind: "invalid", issues: ["Unrecognized key"] });
  });

  it.each([null, "Bad Request", { message: "Validation error" }, { data: "nope" }])("reads a 400 whose body %j lists no issues", body => {
    expect(readPublisherProfileRefusal(new ApiError(400, body, "400"))).toEqual({ kind: "invalid", issues: [] });
  });

  it.each([
    [401, "signed_out"],
    [403, "forbidden"],
    [404, "not_publisher"]
  ])("reads a %i as %s", (status, kind) => {
    expect(readPublisherProfileRefusal(new ApiError(status, { message: "x" }, String(status)))).toEqual({ kind });
  });

  it.each([409, 429, 500, 503])("leaves a %i to the caller's fallback", status => {
    expect(readPublisherProfileRefusal(new ApiError(status, null, String(status)))).toBeUndefined();
  });

  it("leaves a request that never arrived to the caller's fallback", () => {
    expect(readPublisherProfileRefusal(new TypeError("Failed to fetch"))).toBeUndefined();
    expect(readPublisherProfileRefusal(undefined)).toBeUndefined();
  });

  describe(describePublisherProfileRefusal.name, () => {
    it("lists the server's issues", () => {
      expect(describePublisherProfileRefusal({ kind: "invalid", issues: ["Bio: too long", "Link 1: The link must start with https://"] })).toBe(
        "The profile wasn't saved. Bio: too long; Link 1: The link must start with https://."
      );
    });

    it("asks to check the profile when the server named no issue", () => {
      expect(describePublisherProfileRefusal({ kind: "invalid", issues: [] })).toBe("The profile wasn't saved. Check the bio and the links and try again.");
    });

    it("words each refusal on its own", () => {
      expect(describePublisherProfileRefusal({ kind: "signed_out" })).toBe("Your session ended. Sign in again to save the profile.");
      expect(describePublisherProfileRefusal({ kind: "forbidden" })).toBe("Only an owner or admin of the organization can change its publisher profile.");
      expect(describePublisherProfileRefusal({ kind: "not_publisher" })).toBe(
        "This organization has not published a template yet, so it has no publisher profile to change."
      );
    });

    it("asks to try again after a failure that is not a refusal", () => {
      expect(describePublisherProfileRefusal(undefined)).toBe("Couldn't save the profile. Try again in a moment.");
    });
  });
});
